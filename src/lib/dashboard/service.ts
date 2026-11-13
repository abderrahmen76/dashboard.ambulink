import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  CompanyMissionDispatchResult,
  CompanyOptions,
  CompanyOrigin,
  CompanyRecipients,
  DashboardBootstrap,
  DashboardOverview,
  DashboardSnapshot,
  DriverContact,
  MissionCancelResult,
  MissionDispatchResult,
  MissionsPage,
} from "./types";

export type DashboardErrorCode =
  | "migration_pending"
  | "access_denied"
  | "no_candidates"
  | "driver_not_eligible"
  | "dispatch_in_progress"
  | "conflict"
  | "not_found"
  | "network"
  | "unexpected"
  /** The selected company is no longer linked to this hospital. */
  | "company_unavailable"
  /** Client-only: a refresh failed but the last snapshot is still displayed. */
  | "stale";

export type DashboardResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: DashboardErrorCode };

type RpcError = { code?: string | null; message?: string | null } | null;

const MESSAGE_CODES: ReadonlyArray<[string, DashboardErrorCode]> = [
  ["driver_not_eligible", "driver_not_eligible"],
  ["mission_no_driver_candidates", "no_candidates"],
  ["dispatch_in_progress", "dispatch_in_progress"],
  ["mission_request_key_conflict", "conflict"],
  ["mission_not_found", "not_found"],
  ["mission_not_dispatchable", "conflict"],
  ["mission_required_fields_invalid", "conflict"],
  ["mission_pickup_coordinates_required", "conflict"],
  ["mission_destination_coordinates_invalid", "conflict"],
  ["mission_hospital_unavailable", "access_denied"],
  ["hospital_manager_auth_required", "access_denied"],
  ["hospital_management_access_required", "access_denied"],
  ["mission_company_not_linked", "company_unavailable"],
];

export function mapDashboardError(error: RpcError): DashboardErrorCode {
  if (!error) return "unexpected";
  const message = (error.message ?? "").toLowerCase();
  for (const [needle, code] of MESSAGE_CODES) {
    if (message.includes(needle)) return code;
  }
  switch (error.code) {
    case "42883":
    case "42P01":
    case "42703":
    case "PGRST202":
      return "migration_pending";
    case "42501":
      return "access_denied";
    case "23505":
      return "no_candidates";
    case "23514":
    case "P0001":
    case "22023":
    case "23503":
      return "conflict";
    case "P0002":
      return "not_found";
    case undefined:
    case null:
    case "":
      return "network";
    default:
      return "unexpected";
  }
}

export async function fetchSnapshot(
  supabase: SupabaseClient,
): Promise<DashboardResult<DashboardSnapshot>> {
  const { data, error } = await supabase.rpc("hospital_manager_dispatch_center");
  if (error) return { ok: false, code: mapDashboardError(error) };
  if (!data) return { ok: false, code: "unexpected" };
  return { ok: true, data: data as DashboardSnapshot };
}

/**
 * Overview only (202611110012). Realtime refreshes KPIs, drivers and fleet with
 * this instead of rebuilding up to 200 mission rows.
 */
export async function fetchOverview(
  supabase: SupabaseClient,
): Promise<DashboardResult<DashboardOverview>> {
  const { data, error } = await supabase.rpc("hospital_manager_dispatch_overview");
  if (error) return { ok: false, code: mapDashboardError(error) };
  if (!data) return { ok: false, code: "unexpected" };
  return { ok: true, data: data as DashboardOverview };
}

export const MISSION_PAGE_SIZE = 10;

export type MissionPageCursor = {
  limit?: number;
  /** Exclusive keyset cursor; both parts come from the last loaded mission. */
  beforeCreatedAt?: string | null;
  beforeId?: string | null;
};

export async function fetchMissionPage(
  supabase: SupabaseClient,
  cursor: MissionPageCursor = {},
): Promise<DashboardResult<MissionsPage>> {
  const { data, error } = await supabase.rpc("hospital_manager_dispatch_missions_page", {
    p_limit: cursor.limit ?? MISSION_PAGE_SIZE,
    p_before_created_at: cursor.beforeCreatedAt ?? null,
    p_before_id: cursor.beforeId ?? null,
  });
  if (error) return { ok: false, code: mapDashboardError(error) };
  if (!data) return { ok: false, code: "unexpected" };
  return { ok: true, data: data as MissionsPage };
}

/**
 * Contact of the driver assigned to one mission (202611130004, draft). The RPC
 * derives the hospital from the manager membership and reads `profiles` by the
 * mission's own `driver_id`, so company drivers are covered too. Called only
 * for the selected mission, never for queue rows.
 */
export async function fetchMissionDriverContact(
  supabase: SupabaseClient,
  missionId: string,
): Promise<DashboardResult<DriverContact>> {
  const { data, error } = await supabase.rpc("hospital_manager_mission_driver_contact", {
    p_mission_id: missionId,
  });
  if (error) return { ok: false, code: mapDashboardError(error) };
  if (!data) return { ok: false, code: "unexpected" };
  return { ok: true, data: data as DriverContact };
}

function toLegacyBootstrap(snapshot: DashboardSnapshot): DashboardBootstrap {
  const { missions, ...overview } = snapshot;
  return {
    paged: false,
    overview,
    page: {
      server_now: snapshot.server_now,
      total_count: missions.length,
      has_more: false,
      items: missions,
      active_items: missions.filter(
        (mission) => mission.status !== "completed" && mission.status !== "cancelled",
      ),
    },
  };
}

/**
 * Initial read. Prefers the split overview + first page (202611110012). If
 * either RPC is missing (migration not applied yet) it falls back to the
 * original single snapshot and reports `paged: false`, so the Dashboard keeps
 * working with the legacy full-list behaviour until the SQL is applied.
 */
export async function fetchBootstrap(
  supabase: SupabaseClient,
): Promise<DashboardResult<DashboardBootstrap>> {
  const [overview, page] = await Promise.all([
    fetchOverview(supabase),
    fetchMissionPage(supabase),
  ]);
  if (overview.ok && page.ok) {
    return {
      ok: true,
      data: { paged: true, overview: overview.data, page: page.data },
    };
  }

  const failure = !overview.ok ? overview : !page.ok ? page : null;
  if (failure && failure.code !== "migration_pending") return failure;

  const legacy = await fetchSnapshot(supabase);
  if (legacy.ok) return { ok: true, data: toLegacyBootstrap(legacy.data) };
  return failure ?? { ok: false, code: "unexpected" };
}

export type CreateMissionInput = {
  requestKey: string;
  patientName: string;
  patientPhone: string;
  pickupLabel: string;
  pickupLat: number;
  pickupLng: number;
  destinationLabel?: string | null;
  destinationLat?: number | null;
  destinationLng?: number | null;
  motif?: string | null;
  driverId?: string | null;
};

export async function createHospitalMission(
  supabase: SupabaseClient,
  input: CreateMissionInput,
): Promise<DashboardResult<MissionDispatchResult>> {
  const { data, error } = await supabase.rpc("hospital_manager_create_mission", {
    p_request_key: input.requestKey,
    p_patient_name: input.patientName,
    p_patient_phone: input.patientPhone,
    p_pickup_label: input.pickupLabel,
    p_pickup_lat: input.pickupLat,
    p_pickup_lng: input.pickupLng,
    p_destination_label: input.destinationLabel ?? null,
    p_destination_lat: input.destinationLat ?? null,
    p_destination_lng: input.destinationLng ?? null,
    p_motif: input.motif ?? null,
    p_driver_id: input.driverId ?? null,
  });
  if (error) return { ok: false, code: mapDashboardError(error) };
  if (!data) return { ok: false, code: "unexpected" };
  return { ok: true, data: data as MissionDispatchResult };
}

export async function redispatchHospitalMission(
  supabase: SupabaseClient,
  missionId: string,
  driverId: string | null,
): Promise<DashboardResult<MissionDispatchResult>> {
  const { data, error } = await supabase.rpc("hospital_manager_redispatch_mission", {
    p_mission_id: missionId,
    p_driver_id: driverId,
  });
  if (error) return { ok: false, code: mapDashboardError(error) };
  if (!data) return { ok: false, code: "unexpected" };
  return { ok: true, data: data as MissionDispatchResult };
}

/**
 * Cancels a pending mission whose dispatch window ended (202611130001,
 * draft). The RPC derives the hospital from the caller's membership, locks
 * the mission row and refuses a live offer or an already accepted mission.
 */
export async function cancelHospitalMission(
  supabase: SupabaseClient,
  missionId: string,
): Promise<DashboardResult<MissionCancelResult>> {
  const { data, error } = await supabase.rpc("hospital_manager_cancel_mission", {
    p_mission_id: missionId,
  });
  if (error) return { ok: false, code: mapDashboardError(error) };
  if (!data) return { ok: false, code: "unexpected" };
  return { ok: true, data: data as MissionCancelResult };
}

/**
 * Every approved ambulance company (202611110010). Resolved server-side from
 * the manager's membership; no hospital↔company link is required.
 */
export async function fetchCompanyOptions(
  supabase: SupabaseClient,
): Promise<DashboardResult<CompanyOptions>> {
  const { data, error } = await supabase.rpc("hospital_manager_company_options");
  if (error) return { ok: false, code: mapDashboardError(error) };
  if (!data) return { ok: false, code: "unexpected" };
  return { ok: true, data: data as CompanyOptions };
}

export async function fetchCompanyRecipients(
  supabase: SupabaseClient,
  companyId: string,
): Promise<DashboardResult<CompanyRecipients>> {
  const { data, error } = await supabase.rpc("hospital_manager_company_recipients", {
    p_company_id: companyId,
  });
  if (error) return { ok: false, code: mapDashboardError(error) };
  if (!data) return { ok: false, code: "unexpected" };
  return { ok: true, data: data as CompanyRecipients };
}

export async function fetchCompanyOrigins(
  supabase: SupabaseClient,
): Promise<DashboardResult<CompanyOrigin[]>> {
  const { data, error } = await supabase.rpc("hospital_manager_company_origins");
  if (error) return { ok: false, code: mapDashboardError(error) };
  if (!Array.isArray(data)) return { ok: false, code: "unexpected" };
  return { ok: true, data: data as CompanyOrigin[] };
}

export type CreateCompanyMissionInput = {
  requestKey: string;
  companyId: string;
  patientName: string;
  patientPhone: string;
  pickupLabel: string;
  pickupLat: number;
  pickupLng: number;
  destinationLabel?: string | null;
  destinationLat?: number | null;
  destinationLng?: number | null;
  motif?: string | null;
};

export async function createCompanyMission(
  supabase: SupabaseClient,
  input: CreateCompanyMissionInput,
): Promise<DashboardResult<CompanyMissionDispatchResult>> {
  const { data, error } = await supabase.rpc("hospital_manager_create_company_mission", {
    p_request_key: input.requestKey,
    p_company_id: input.companyId,
    p_patient_name: input.patientName,
    p_patient_phone: input.patientPhone,
    p_pickup_label: input.pickupLabel,
    p_pickup_lat: input.pickupLat,
    p_pickup_lng: input.pickupLng,
    p_destination_label: input.destinationLabel ?? null,
    p_destination_lat: input.destinationLat ?? null,
    p_destination_lng: input.destinationLng ?? null,
    p_motif: input.motif ?? null,
  });
  if (error) return { ok: false, code: mapDashboardError(error) };
  if (!data) return { ok: false, code: "unexpected" };
  return { ok: true, data: data as CompanyMissionDispatchResult };
}

export async function redispatchCompanyMission(
  supabase: SupabaseClient,
  missionId: string,
): Promise<DashboardResult<CompanyMissionDispatchResult>> {
  const { data, error } = await supabase.rpc("hospital_manager_redispatch_company_mission", {
    p_mission_id: missionId,
  });
  if (error) return { ok: false, code: mapDashboardError(error) };
  if (!data) return { ok: false, code: "unexpected" };
  return { ok: true, data: data as CompanyMissionDispatchResult };
}
