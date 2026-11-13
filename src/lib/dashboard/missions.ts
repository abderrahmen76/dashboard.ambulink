import type { DashboardMission, MissionStatus } from "./types";

const MISSION_STATUSES: ReadonlySet<string> = new Set<MissionStatus>([
  "requested",
  "accepted",
  "en_route",
  "arrived",
  "in_progress",
  "completed",
  "cancelled",
]);

export function isTerminalStatus(status: string): boolean {
  return status === "completed" || status === "cancelled";
}

/** Newest first, id descending as the deterministic tiebreaker. */
export function compareMissions(a: DashboardMission, b: DashboardMission): number {
  const aTime = Date.parse(a.created_at);
  const bTime = Date.parse(b.created_at);
  if (aTime !== bTime) return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime);
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

/** Upsert by id and keep the queue ordering, so a page overlap cannot duplicate. */
export function mergeMissionLists(
  base: DashboardMission[],
  incoming: DashboardMission[],
): DashboardMission[] {
  if (!incoming.length) return base;
  const byId = new Map(base.map((mission) => [mission.id, mission]));
  for (const mission of incoming) byId.set(mission.id, mission);
  return Array.from(byId.values()).sort(compareMissions);
}

export function upsertMission(
  list: DashboardMission[],
  mission: DashboardMission,
): DashboardMission[] {
  return mergeMissionLists(list, [mission]);
}

export function removeMissionById(
  list: DashboardMission[],
  missionId: string,
): DashboardMission[] {
  const next = list.filter((mission) => mission.id !== missionId);
  return next.length === list.length ? list : next;
}

/**
 * Columns a Realtime payload may carry. Attempt data and the joined
 * driver/ambulance labels never come from the `missions` table, so they are
 * excluded here and preserved by the patch.
 */
export type MissionPatch = Partial<
  Pick<
    DashboardMission,
    | "status"
    | "dispatch_mode"
    | "manager_entry"
    | "patient_name"
    | "patient_phone"
    | "pickup_label"
    | "pickup_lat"
    | "pickup_lng"
    | "destination_label"
    | "destination_lat"
    | "destination_lng"
    | "symptoms"
    | "notes"
    | "created_at"
    | "accepted_at"
    | "completed_at"
    | "cancelled_at"
    | "driver_id"
    | "ambulance_id"
  >
>;

const STRING_KEYS = [
  "dispatch_mode",
  "patient_name",
  "patient_phone",
  "pickup_label",
  "destination_label",
  "symptoms",
  "notes",
] as const;

const NUMBER_KEYS = ["pickup_lat", "pickup_lng", "destination_lat", "destination_lng"] as const;

const TIME_KEYS = ["accepted_at", "completed_at", "cancelled_at"] as const;

const ID_KEYS = ["driver_id", "ambulance_id"] as const;

function asString(value: unknown): string | null | undefined {
  if (value === null) return null;
  return typeof value === "string" ? value : undefined;
}

function asNumber(value: unknown): number | null | undefined {
  if (value === null) return null;
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/**
 * Reads only the keys actually present in the payload. Supabase does not
 * promise an unchanged column is echoed on UPDATE, so `undefined` means "leave
 * the loaded value alone" rather than "clear it".
 */
export function missionPatchFromRow(
  row: Record<string, unknown>,
): { id: string; patch: MissionPatch } | null {
  if (typeof row.id !== "string") return null;
  const patch: MissionPatch = {};

  if ("status" in row) {
    if (typeof row.status !== "string" || !MISSION_STATUSES.has(row.status)) return null;
    patch.status = row.status as MissionStatus;
  }
  if ("manager_entry" in row) {
    if (typeof row.manager_entry !== "boolean") return null;
    patch.manager_entry = row.manager_entry;
  }
  if ("created_at" in row) {
    if (typeof row.created_at !== "string") return null;
    patch.created_at = row.created_at;
  }
  for (const key of STRING_KEYS) {
    if (!(key in row)) continue;
    const value = asString(row[key]);
    if (value === undefined) return null;
    patch[key] = value;
  }
  for (const key of NUMBER_KEYS) {
    if (!(key in row)) continue;
    const value = asNumber(row[key]);
    if (value === undefined) return null;
    patch[key] = value;
  }
  for (const key of TIME_KEYS) {
    if (!(key in row)) continue;
    const value = asString(row[key]);
    if (value === undefined) return null;
    patch[key] = value;
  }
  for (const key of ID_KEYS) {
    if (!(key in row)) continue;
    const value = asString(row[key]);
    if (value === undefined) return null;
    patch[key] = value;
  }

  return { id: row.id, patch };
}

/** Full mission built from an INSERT payload; the joined labels stay unknown. */
export function missionFromRow(
  row: Record<string, unknown>,
  names?: { driverName: string | null; ambulanceLabel: string | null },
): DashboardMission | null {
  const parsed = missionPatchFromRow(row);
  if (!parsed) return null;
  const patch = parsed.patch;
  const { status, created_at: createdAt } = patch;
  if (!status || !createdAt) return null;
  return {
    id: parsed.id,
    status,
    dispatch_mode: patch.dispatch_mode ?? null,
    manager_entry: patch.manager_entry ?? false,
    patient_name: patch.patient_name ?? null,
    patient_phone: patch.patient_phone ?? null,
    pickup_label: patch.pickup_label ?? null,
    pickup_lat: patch.pickup_lat ?? null,
    pickup_lng: patch.pickup_lng ?? null,
    destination_label: patch.destination_label ?? null,
    destination_lat: patch.destination_lat ?? null,
    destination_lng: patch.destination_lng ?? null,
    symptoms: patch.symptoms ?? null,
    notes: patch.notes ?? null,
    created_at: createdAt,
    accepted_at: patch.accepted_at ?? null,
    completed_at: patch.completed_at ?? null,
    cancelled_at: patch.cancelled_at ?? null,
    driver_id: patch.driver_id ?? null,
    driver_name: names?.driverName ?? null,
    ambulance_id: patch.ambulance_id ?? null,
    ambulance_label: names?.ambulanceLabel ?? null,
    attempt: null,
  };
}
