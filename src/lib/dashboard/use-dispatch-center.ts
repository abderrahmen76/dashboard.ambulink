"use client";

import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
  SupabaseClient,
} from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

import {
  compareMissions,
  isTerminalStatus,
  mergeMissionLists,
  missionFromRow,
  missionPatchFromRow,
  removeMissionById,
  upsertMission,
  type MissionPatch,
} from "./missions";
import {
  createCompanyMission as createCompanyMissionRpc,
  createHospitalMission,
  fetchCompanyOptions,
  fetchCompanyOrigins,
  fetchCompanyRecipients,
  fetchMissionPage,
  fetchOverview,
  fetchSnapshot,
  MISSION_PAGE_SIZE,
  redispatchCompanyMission as redispatchCompanyMissionRpc,
  redispatchHospitalMission,
  type CreateCompanyMissionInput,
  type CreateMissionInput,
  type DashboardErrorCode,
  type DashboardResult,
} from "./service";
import type {
  CompanyMissionDispatchResult,
  CompanyOptions,
  CompanyOrigin,
  CompanyRecipients,
  DashboardBootstrap,
  DashboardDriver,
  DashboardMission,
  DashboardOverview,
  DashboardSnapshot,
  MissionsPage,
  MissionDispatchResult,
} from "./types";

export type ConnectionState = "connecting" | "live" | "reconnecting" | "offline";

type DriverRow = {
  id?: string;
  availability?: boolean | null;
  current_lat?: number | null;
  current_lng?: number | null;
  location_updated_at?: string | null;
  ambulance_id?: string | null;
};

const SNAPSHOT_DEBOUNCE_MS = 400;
const PAGE_RECONCILE_MS = 600;
const DRIVER_PATCH_MS = 900;
const FALLBACK_POLL_MS = 20_000;
const MAX_PAGE_SIZE = 50;

/**
 * Merges a fresh overview over the current one, keeping a driver fix that is
 * newer than the one the RPC returned (a GPS patch can land while the request
 * is in flight).
 */
function mergeOverview(
  current: DashboardOverview,
  next: DashboardOverview,
): DashboardOverview {
  const previous = new Map(current.drivers.map((driver) => [driver.id, driver]));
  return {
    ...next,
    drivers: next.drivers.map((driver) => {
      const before = previous.get(driver.id);
      if (!before) return driver;
      const beforeTs = before.location_updated_at ? Date.parse(before.location_updated_at) : NaN;
      const nextTs = driver.location_updated_at ? Date.parse(driver.location_updated_at) : NaN;
      const beforeIsNewer =
        Number.isFinite(beforeTs) && (!Number.isFinite(nextTs) || beforeTs > nextTs);
      if (!beforeIsNewer) return driver;
      return {
        ...driver,
        current_lat: before.current_lat,
        current_lng: before.current_lng,
        location_updated_at: before.location_updated_at,
      };
    }),
  };
}

function applyDriverPatches(
  drivers: DashboardDriver[],
  patches: Map<string, Partial<DashboardDriver>>,
): DashboardDriver[] {
  if (!patches.size) return drivers;
  return drivers.map((driver) => {
    const patch = patches.get(driver.id);
    return patch ? { ...driver, ...patch } : driver;
  });
}

function applyMissionPatch(
  mission: DashboardMission,
  patch: MissionPatch,
  overview: DashboardOverview | null,
): DashboardMission {
  const next: DashboardMission = { ...mission, ...patch };
  if (patch.driver_id !== undefined && patch.driver_id !== mission.driver_id) {
    next.driver_name =
      overview?.drivers.find((driver) => driver.id === patch.driver_id)?.full_name ?? null;
  }
  if (patch.ambulance_id !== undefined && patch.ambulance_id !== mission.ambulance_id) {
    next.ambulance_label =
      overview?.ambulances.find((vehicle) => vehicle.id === patch.ambulance_id)?.label ?? null;
  }
  return next;
}

/**
 * Realtime is used for targeted patches: mission rows are upserted/patched in
 * the loaded queue and the active list, driver GPS stays a local patch, and
 * only KPIs/drivers/fleet trigger an overview refetch. Mission pages are keyset
 * paged (202611110012); a page reset never discards already loaded pages.
 */
export function useDispatchCenter(initial: DashboardResult<DashboardBootstrap>) {
  const [overview, setOverview] = useState<DashboardOverview | null>(
    initial.ok ? initial.data.overview : null,
  );
  const [queue, setQueue] = useState<DashboardMission[]>(
    initial.ok ? initial.data.page.items : [],
  );
  const [activeMissions, setActiveMissions] = useState<DashboardMission[]>(
    initial.ok
      ? initial.data.page.active_items.filter((mission) => !isTerminalStatus(mission.status))
      : [],
  );
  const [missionTotal, setMissionTotal] = useState(
    initial.ok ? initial.data.page.total_count : 0,
  );
  const [hasMore, setHasMore] = useState(initial.ok ? initial.data.page.has_more : false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [missionError, setMissionError] = useState<DashboardErrorCode | null>(null);
  const [origins, setOrigins] = useState<Record<string, CompanyOrigin>>({});
  const [error, setError] = useState<DashboardErrorCode | null>(
    initial.ok ? null : initial.code,
  );
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [refreshing, setRefreshing] = useState(false);

  const clientRef = useRef<SupabaseClient | null>(null);
  const mountedRef = useRef(true);
  const pagedRef = useRef(initial.ok ? initial.data.paged : true);
  const inFlightRef = useRef(false);
  const queuedRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconcileTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const driverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const overviewRef = useRef<DashboardOverview | null>(
    initial.ok ? initial.data.overview : null,
  );
  const queueRef = useRef<DashboardMission[]>(initial.ok ? initial.data.page.items : []);
  const activeRef = useRef<DashboardMission[]>(
    initial.ok
      ? initial.data.page.active_items.filter((mission) => !isTerminalStatus(mission.status))
      : [],
  );
  const hasMoreRef = useRef(initial.ok ? initial.data.page.has_more : false);
  const missionTotalRef = useRef(initial.ok ? initial.data.page.total_count : 0);
  const loadingMoreRef = useRef(false);
  const driverPatchesRef = useRef(new Map<string, Partial<DashboardDriver>>());

  /** Bumped for every mission patched locally, so a slow page cannot clobber it. */
  const missionVersionsRef = useRef(new Map<string, number>());
  /** Bumped on every mission insert/delete/terminal move (total_count may move). */
  const missionsRevisionRef = useRef(0);
  const deletedIdsRef = useRef(new Set<string>());
  const overviewRequestSeqRef = useRef(0);
  const overviewAppliedSeqRef = useRef(0);
  const pageRequestSeqRef = useRef(0);
  const pageAppliedSeqRef = useRef(0);

  const hospitalId = overview?.hospital.id ?? null;

  const getClient = useCallback(() => {
    if (!clientRef.current) clientRef.current = createSupabaseBrowserClient();
    return clientRef.current;
  }, []);

  // Commits compute from the ref, which is updated synchronously. Realtime
  // handlers can therefore chain several events in one tick without reading a
  // stale queue, and no updater needs to be re-run to stay correct.
  const commitOverview = useCallback(
    (update: (current: DashboardOverview | null) => DashboardOverview | null) => {
      const next = update(overviewRef.current);
      overviewRef.current = next;
      setOverview(next);
    },
    [],
  );

  const commitQueue = useCallback(
    (update: (current: DashboardMission[]) => DashboardMission[]) => {
      const next = update(queueRef.current);
      queueRef.current = next;
      setQueue(next);
    },
    [],
  );

  const commitActive = useCallback(
    (update: (current: DashboardMission[]) => DashboardMission[]) => {
      const next = update(activeRef.current);
      activeRef.current = next;
      setActiveMissions(next);
    },
    [],
  );

  const commitTotal = useCallback((next: number) => {
    const safe = Math.max(0, next);
    missionTotalRef.current = safe;
    setMissionTotal(safe);
  }, []);

  const commitHasMore = useCallback((next: boolean) => {
    hasMoreRef.current = next;
    setHasMore(next);
  }, []);

  const bumpMission = useCallback((missionId: string) => {
    missionVersionsRef.current.set(
      missionId,
      (missionVersionsRef.current.get(missionId) ?? 0) + 1,
    );
  }, []);

  const applyOverview = useCallback(
    (next: DashboardOverview) => {
      commitOverview((current) => {
        const merged = current ? mergeOverview(current, next) : next;
        if (!driverPatchesRef.current.size) return merged;
        return {
          ...merged,
          drivers: applyDriverPatches(merged.drivers, driverPatchesRef.current),
        };
      });
      setError(null);
    },
    [commitOverview],
  );

  const applyLegacySnapshot = useCallback(
    (snapshot: DashboardSnapshot) => {
      const { missions, ...rest } = snapshot;
      commitOverview((current) => (current ? { ...current, ...rest } : rest));
      commitQueue(() => missions);
      commitActive(() => missions.filter((mission) => !isTerminalStatus(mission.status)));
      commitTotal(missions.length);
      commitHasMore(false);
      setError(null);
    },
    [commitActive, commitHasMore, commitOverview, commitQueue, commitTotal],
  );

  const applyServerPage = useCallback(
    (page: MissionsPage, seq: number, versionsAt: Map<string, number>) => {
      const changedSince = (missionId: string) =>
        (missionVersionsRef.current.get(missionId) ?? 0) !== (versionsAt.get(missionId) ?? 0);

      const items = page.items.filter((mission) => !deletedIdsRef.current.has(mission.id));
      commitQueue((current) => {
        const byId = new Map(current.map((mission) => [mission.id, mission]));
        for (const mission of items) {
          // A Realtime patch that landed during the request is newer than the
          // page snapshot; keep it instead of overwriting.
          if (byId.has(mission.id) && changedSince(mission.id)) continue;
          byId.set(mission.id, mission);
        }
        return Array.from(byId.values()).sort(compareMissions);
      });

      const actives = page.active_items.filter(
        (mission) => !deletedIdsRef.current.has(mission.id) && !isTerminalStatus(mission.status),
      );
      commitActive((current) => {
        const byId = new Map(current.map((mission) => [mission.id, mission]));
        const returned = new Set(actives.map((mission) => mission.id));
        for (const missionId of Array.from(byId.keys())) {
          if (!returned.has(missionId) && !changedSince(missionId)) byId.delete(missionId);
        }
        for (const mission of actives) {
          if (byId.has(mission.id) && changedSince(mission.id)) continue;
          byId.set(mission.id, mission);
        }
        return Array.from(byId.values()).sort(compareMissions);
      });

      if (seq >= pageAppliedSeqRef.current) {
        pageAppliedSeqRef.current = seq;
        commitHasMore(page.has_more);
        commitTotal(page.total_count);
        setMissionError(null);
      }
    },
    [commitActive, commitHasMore, commitQueue, commitTotal],
  );

  const applyOrigins = useCallback((list: CompanyOrigin[]) => {
    setOrigins(Object.fromEntries(list.map((origin) => [origin.mission_id, origin])));
  }, []);

  const reconcileQueue = useCallback(async () => {
    if (!pagedRef.current) return;
    const supabase = getClient();
    if (!supabase) return;
    const seq = ++pageRequestSeqRef.current;
    const versionsAt = new Map(missionVersionsRef.current);
    const result = await fetchMissionPage(supabase, { limit: MISSION_PAGE_SIZE });
    if (!mountedRef.current) return;
    if (result.ok) applyServerPage(result.data, seq, versionsAt);
  }, [applyServerPage, getClient]);

  const scheduleReconcile = useCallback(
    (delay = PAGE_RECONCILE_MS) => {
      if (reconcileTimerRef.current) clearTimeout(reconcileTimerRef.current);
      reconcileTimerRef.current = setTimeout(() => {
        reconcileTimerRef.current = null;
        void reconcileQueue();
      }, delay);
    },
    [reconcileQueue],
  );

  const refresh = useCallback(async () => {
    const supabase = getClient();
    if (!supabase) {
      setError("unexpected");
      setConnection("offline");
      return;
    }
    if (inFlightRef.current) {
      queuedRef.current = true;
      return;
    }
    inFlightRef.current = true;
    setRefreshing(true);
    try {
      let runAgain = true;
      while (runAgain && mountedRef.current) {
        runAgain = false;
        queuedRef.current = false;
        const originsPromise = fetchCompanyOrigins(supabase);

        if (!pagedRef.current) {
          const [result, originsResult] = await Promise.all([
            fetchSnapshot(supabase),
            originsPromise,
          ]);
          if (!mountedRef.current) return;
          if (originsResult.ok) applyOrigins(originsResult.data);
          if (result.ok) applyLegacySnapshot(result.data);
          else setError(result.code === "network" ? "stale" : result.code);
        } else {
          const versionsAt = new Map(missionVersionsRef.current);
          const revisionAt = missionsRevisionRef.current;
          const overviewSeq = ++overviewRequestSeqRef.current;
          const pageSeq = ++pageRequestSeqRef.current;
          const firstPageLimit = Math.min(
            MAX_PAGE_SIZE,
            Math.max(MISSION_PAGE_SIZE, queueRef.current.length),
          );
          const [overviewResult, pageResult, originsResult] = await Promise.all([
            fetchOverview(supabase),
            fetchMissionPage(supabase, { limit: firstPageLimit }),
            originsPromise,
          ]);
          if (!mountedRef.current) return;
          if (originsResult.ok) applyOrigins(originsResult.data);

          if (overviewResult.ok && pageResult.ok) {
            if (overviewSeq >= overviewAppliedSeqRef.current) {
              overviewAppliedSeqRef.current = overviewSeq;
              applyOverview(overviewResult.data);
            }
            applyServerPage(pageResult.data, pageSeq, versionsAt);
          } else {
            const failure = overviewResult.ok ? pageResult : overviewResult;
            if (!failure.ok && failure.code === "migration_pending") {
              const legacy = await fetchSnapshot(supabase);
              if (!mountedRef.current) return;
              if (legacy.ok) {
                pagedRef.current = false;
                applyLegacySnapshot(legacy.data);
              } else {
                setError(legacy.code === "network" ? "stale" : legacy.code);
              }
            } else if (!failure.ok) {
              setError(failure.code === "network" ? "stale" : failure.code);
            }
          }
          // A mission event raced the response; reconcile once the burst
          // settles instead of trusting the older total.
          if (revisionAt !== missionsRevisionRef.current && pagedRef.current) {
            scheduleReconcile(PAGE_RECONCILE_MS);
          }
        }
        if (queuedRef.current) runAgain = true;
      }
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current) setRefreshing(false);
    }
  }, [
    applyLegacySnapshot,
    applyOrigins,
    applyOverview,
    applyServerPage,
    getClient,
    scheduleReconcile,
  ]);

  const scheduleRefresh = useCallback(
    (delay = SNAPSHOT_DEBOUNCE_MS) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        void refresh();
      }, delay);
    },
    [refresh],
  );

  const refreshOverview = useCallback(async () => {
    const supabase = getClient();
    if (!supabase) return;
    const seq = ++overviewRequestSeqRef.current;
    const result = await fetchOverview(supabase);
    if (!mountedRef.current) return;
    if (!result.ok) {
      if (seq >= overviewAppliedSeqRef.current) {
        setError(result.code === "network" ? "stale" : result.code);
      }
      return;
    }
    if (seq < overviewAppliedSeqRef.current) return;
    overviewAppliedSeqRef.current = seq;
    applyOverview(result.data);
  }, [applyOverview, getClient]);

  const scheduleOverview = useCallback(
    (delay = SNAPSHOT_DEBOUNCE_MS) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        void refreshOverview();
      }, delay);
    },
    [refreshOverview],
  );

  const loadMore = useCallback(async () => {
    if (!pagedRef.current || loadingMoreRef.current || !hasMoreRef.current) return;
    const supabase = getClient();
    if (!supabase) {
      setMissionError("unexpected");
      return;
    }
    const last = queueRef.current[queueRef.current.length - 1];
    if (!last) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setMissionError(null);
    const seq = ++pageRequestSeqRef.current;
    const versionsAt = new Map(missionVersionsRef.current);
    try {
      const result = await fetchMissionPage(supabase, {
        limit: MISSION_PAGE_SIZE,
        beforeCreatedAt: last.created_at,
        beforeId: last.id,
      });
      if (!mountedRef.current) return;
      if (result.ok) applyServerPage(result.data, seq, versionsAt);
      else setMissionError(result.code === "network" ? "stale" : result.code);
    } finally {
      loadingMoreRef.current = false;
      if (mountedRef.current) setLoadingMore(false);
    }
  }, [applyServerPage, getClient]);

  const applyMutationSnapshot = useCallback(
    (next: DashboardSnapshot, missionId: string) => {
      if (!pagedRef.current) {
        applyLegacySnapshot(next);
        return;
      }
      const { missions, ...overviewNext } = next;
      applyOverview(overviewNext);
      const mission = missions.find((entry) => entry.id === missionId);
      if (mission) {
        bumpMission(mission.id);
        missionsRevisionRef.current += 1;
        commitQueue((current) => upsertMission(current, mission));
        if (!isTerminalStatus(mission.status)) {
          commitActive((current) => upsertMission(current, mission));
        } else {
          commitActive((current) => removeMissionById(current, mission.id));
        }
      }
      // The mutation RPC returns a full snapshot; only the affected mission is
      // taken from it. Page 1 reconciles the authoritative total and attempt.
      void reconcileQueue();
    },
    [
      applyLegacySnapshot,
      applyOverview,
      bumpMission,
      commitActive,
      commitQueue,
      reconcileQueue,
    ],
  );

  const redispatch = useCallback(
    async (
      missionId: string,
      driverId: string | null,
    ): Promise<DashboardErrorCode | null> => {
      const supabase = getClient();
      if (!supabase) return "unexpected";
      const result = await redispatchHospitalMission(supabase, missionId, driverId);
      if (!result.ok) {
        if (result.code === "migration_pending" || result.code === "access_denied") {
          setError(result.code);
        }
        return result.code;
      }
      applyMutationSnapshot(result.data.snapshot, result.data.mission_id);
      return null;
    },
    [applyMutationSnapshot, getClient],
  );

  const createMission = useCallback(
    async (
      input: CreateMissionInput,
    ): Promise<DashboardResult<MissionDispatchResult>> => {
      const supabase = getClient();
      if (!supabase) return { ok: false, code: "unexpected" };
      const result = await createHospitalMission(supabase, input);
      if (!result.ok) {
        if (result.code === "migration_pending" || result.code === "access_denied") {
          setError(result.code);
        }
        return result;
      }
      applyMutationSnapshot(result.data.snapshot, result.data.mission_id);
      return result;
    },
    [applyMutationSnapshot, getClient],
  );

  const applyOrigin = useCallback(
    (missionId: string, company: { id: string; name: string }) => {
      setOrigins((current) => ({
        ...current,
        [missionId]: {
          mission_id: missionId,
          company_id: company.id,
          company_name: company.name,
        },
      }));
    },
    [],
  );

  const createCompanyMission = useCallback(
    async (
      input: CreateCompanyMissionInput,
    ): Promise<DashboardResult<CompanyMissionDispatchResult>> => {
      const supabase = getClient();
      if (!supabase) return { ok: false, code: "unexpected" };
      const result = await createCompanyMissionRpc(supabase, input);
      if (!result.ok) {
        if (result.code === "migration_pending" || result.code === "access_denied") {
          setError(result.code);
        }
        return result;
      }
      applyMutationSnapshot(result.data.snapshot, result.data.mission_id);
      applyOrigin(result.data.mission_id, result.data.company);
      return result;
    },
    [applyMutationSnapshot, applyOrigin, getClient],
  );

  const redispatchCompany = useCallback(
    async (missionId: string): Promise<DashboardErrorCode | null> => {
      const supabase = getClient();
      if (!supabase) return "unexpected";
      const result = await redispatchCompanyMissionRpc(supabase, missionId);
      if (!result.ok) {
        if (result.code === "migration_pending" || result.code === "access_denied") {
          setError(result.code);
        }
        return result.code;
      }
      applyMutationSnapshot(result.data.snapshot, result.data.mission_id);
      applyOrigin(result.data.mission_id, result.data.company);
      return null;
    },
    [applyMutationSnapshot, applyOrigin, getClient],
  );

  const loadCompanyOptions = useCallback(async (): Promise<
    DashboardResult<CompanyOptions>
  > => {
    const supabase = getClient();
    if (!supabase) return { ok: false, code: "unexpected" };
    return fetchCompanyOptions(supabase);
  }, [getClient]);

  const loadCompanyRecipients = useCallback(
    async (companyId: string): Promise<DashboardResult<CompanyRecipients>> => {
      const supabase = getClient();
      if (!supabase) return { ok: false, code: "unexpected" };
      return fetchCompanyRecipients(supabase, companyId);
    },
    [getClient],
  );

  const flushDriverPatches = useCallback(() => {
    driverTimerRef.current = null;
    const batch = new Map(driverPatchesRef.current);
    if (!batch.size) return;
    driverPatchesRef.current.clear();
    commitOverview((current) =>
      current ? { ...current, drivers: applyDriverPatches(current.drivers, batch) } : current,
    );
  }, [commitOverview]);

  const queueDriverPatch = useCallback(
    (row: DriverRow) => {
      if (!row.id) return;
      const patch: Partial<DashboardDriver> = { ...driverPatchesRef.current.get(row.id) };
      if ("availability" in row) patch.availability = row.availability ?? null;
      if ("current_lat" in row) patch.current_lat = row.current_lat ?? null;
      if ("current_lng" in row) patch.current_lng = row.current_lng ?? null;
      if ("location_updated_at" in row) {
        patch.location_updated_at = row.location_updated_at ?? null;
      }
      if (!Object.keys(patch).length) return;
      driverPatchesRef.current.set(row.id, patch);
      if (!driverTimerRef.current) {
        driverTimerRef.current = setTimeout(flushDriverPatches, DRIVER_PATCH_MS);
      }
    },
    [flushDriverPatches],
  );

  const handleMissionEvent = useCallback(
    (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      if (!mountedRef.current) return;
      if (!pagedRef.current) {
        scheduleRefresh();
        return;
      }
      if (payload.eventType === "INSERT") {
        const row = payload.new;
        const mission = missionFromRow(row, {
          driverName:
            overviewRef.current?.drivers.find(
              (driver) => driver.id === (row.driver_id as string | null),
            )?.full_name ?? null,
          ambulanceLabel:
            overviewRef.current?.ambulances.find(
              (vehicle) => vehicle.id === (row.ambulance_id as string | null),
            )?.label ?? null,
        });
        if (!mission) return;
        const known =
          queueRef.current.some((entry) => entry.id === mission.id) ||
          activeRef.current.some((entry) => entry.id === mission.id);
        deletedIdsRef.current.delete(mission.id);
        bumpMission(mission.id);
        missionsRevisionRef.current += 1;
        commitQueue((current) => upsertMission(current, mission));
        if (!isTerminalStatus(mission.status)) {
          commitActive((current) => upsertMission(current, mission));
        }
        if (!known) commitTotal(missionTotalRef.current + 1);
        scheduleOverview();
        scheduleReconcile();
        return;
      }

      if (payload.eventType === "UPDATE") {
        const parsed = missionPatchFromRow(payload.new);
        if (!parsed) return;
        const { id, patch } = parsed;
        bumpMission(id);
        missionsRevisionRef.current += 1;
        const inQueue = queueRef.current.some((entry) => entry.id === id);
        const inActive = activeRef.current.some((entry) => entry.id === id);
        const apply = (entry: DashboardMission) =>
          entry.id === id ? applyMissionPatch(entry, patch, overviewRef.current) : entry;
        if (inQueue) commitQueue((current) => current.map(apply));
        if (inActive) commitActive((current) => current.map(apply));
        if (!inQueue && !inActive && patch.status && !isTerminalStatus(patch.status)) {
          // An older active mission that is not loaded yet must still reach the
          // map: `active_items` carries every nonterminal mission.
          scheduleReconcile();
        }
        if (patch.status && isTerminalStatus(patch.status)) {
          commitActive((current) => removeMissionById(current, id));
          scheduleReconcile();
        }
        scheduleOverview();
        return;
      }

      if (payload.eventType === "DELETE") {
        const id = (payload.old as { id?: string }).id;
        if (!id) return;
        const known =
          queueRef.current.some((entry) => entry.id === id) ||
          activeRef.current.some((entry) => entry.id === id);
        deletedIdsRef.current.add(id);
        bumpMission(id);
        missionsRevisionRef.current += 1;
        commitQueue((current) => removeMissionById(current, id));
        commitActive((current) => removeMissionById(current, id));
        if (known) commitTotal(missionTotalRef.current - 1);
        scheduleReconcile();
        scheduleOverview();
      }
    },
    [
      bumpMission,
      commitActive,
      commitQueue,
      commitTotal,
      scheduleOverview,
      scheduleReconcile,
      scheduleRefresh,
    ],
  );

  const handleAttemptEvent = useCallback(
    (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      if (!mountedRef.current) return;
      if (!pagedRef.current) {
        scheduleRefresh();
        return;
      }
      if (payload.eventType === "DELETE") return;
      const row = payload.new;
      const missionId = typeof row.mission_id === "string" ? row.mission_id : null;
      const attemptId = typeof row.id === "string" ? row.id : null;
      const state = row.state;
      if (!missionId || !attemptId) return;
      if (state !== "offering" && state !== "accepted" && state !== "expired") return;
      const deadlineAt = typeof row.deadline_at === "string" ? row.deadline_at : null;
      const attemptNumber =
        typeof row.attempt_number === "number" ? row.attempt_number : null;
      const acceptedDriverId =
        typeof row.accepted_driver_id === "string" ? row.accepted_driver_id : null;

      bumpMission(missionId);
      const patchAttempt = (mission: DashboardMission): DashboardMission => {
        if (mission.id !== missionId) return mission;
        const same = mission.attempt?.id === attemptId;
        return {
          ...mission,
          attempt: {
            id: attemptId,
            state,
            attempt_number: attemptNumber ?? mission.attempt?.attempt_number ?? 1,
            deadline_at: deadlineAt ?? mission.attempt?.deadline_at ?? mission.created_at,
            offered_count: same ? mission.attempt?.offered_count ?? 0 : 0,
            accepted_driver_id: acceptedDriverId,
          },
        };
      };
      if (queueRef.current.some((entry) => entry.id === missionId)) {
        commitQueue((current) => current.map(patchAttempt));
      }
      if (activeRef.current.some((entry) => entry.id === missionId)) {
        commitActive((current) => current.map(patchAttempt));
      }
    },
    [bumpMission, commitActive, commitQueue, scheduleRefresh],
  );

  const handleOfferEvent = useCallback(
    (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      if (!mountedRef.current) return;
      if (!pagedRef.current) {
        scheduleRefresh();
        return;
      }
      const delta = payload.eventType === "INSERT" ? 1 : payload.eventType === "DELETE" ? -1 : 0;
      if (!delta) return;
      const row = (payload.eventType === "DELETE" ? payload.old : payload.new) as {
        attempt_id?: string;
      };
      const attemptId = row.attempt_id;
      if (!attemptId) {
        // Under the default replica identity a DELETE payload carries only the
        // primary key, so the attempt is unknown and the page must reconcile.
        if (payload.eventType === "DELETE") scheduleReconcile();
        return;
      }
      const adjust = (mission: DashboardMission): DashboardMission =>
        mission.attempt?.id === attemptId
          ? {
              ...mission,
              attempt: {
                ...mission.attempt,
                offered_count: Math.max(0, mission.attempt.offered_count + delta),
              },
            }
          : mission;
      if (queueRef.current.some((entry) => entry.attempt?.id === attemptId)) {
        commitQueue((current) => current.map(adjust));
      }
      if (activeRef.current.some((entry) => entry.attempt?.id === attemptId)) {
        commitActive((current) => current.map(adjust));
      }
    },
    [commitActive, commitQueue, scheduleReconcile, scheduleRefresh],
  );

  const handleDriverEvent = useCallback(
    (payload: RealtimePostgresChangesPayload<DriverRow>) => {
      if (!mountedRef.current) return;
      if (!pagedRef.current) {
        scheduleRefresh();
        return;
      }
      if (payload.eventType === "UPDATE") {
        const row = payload.new as DriverRow;
        queueDriverPatch(row);
        if (row.id) {
          const current = overviewRef.current?.drivers.find((driver) => driver.id === row.id);
          // Only a real assignment change affects the fleet/KPIs; GPS and
          // availability are patched locally.
          if (
            "ambulance_id" in row &&
            (current?.ambulance_id ?? null) !== (row.ambulance_id ?? null)
          ) {
            scheduleOverview();
          }
        }
        return;
      }
      scheduleOverview();
    },
    [queueDriverPatch, scheduleOverview, scheduleRefresh],
  );

  const handleAmbulanceEvent = useCallback(() => {
    if (!mountedRef.current) return;
    if (!pagedRef.current) {
      scheduleRefresh();
      return;
    }
    scheduleOverview();
  }, [scheduleOverview, scheduleRefresh]);

  // A failed initial bootstrap (network, or the pending migration) has no
  // hospital id yet, so subscriptions cannot start; retrying is the only path.
  useEffect(() => {
    mountedRef.current = true;
    if (!initial.ok) void refresh();
    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hospitalId) return;
    const supabase = getClient();
    if (!supabase) return;

    let pollTimer: ReturnType<typeof setInterval> | null = null;
    const startPolling = () => {
      if (pollTimer) return;
      pollTimer = setInterval(() => void refresh(), FALLBACK_POLL_MS);
    };
    const stopPolling = () => {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };

    const handleStatus = (status: string) => {
      if (!mountedRef.current) return;
      if (status === "SUBSCRIBED") {
        setConnection("live");
        stopPolling();
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        setConnection("reconnecting");
        startPolling();
      } else if (status === "CLOSED") {
        setConnection("offline");
        startPolling();
      }
    };

    const channels: RealtimeChannel[] = [
      supabase
        .channel(`dc-missions-${hospitalId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "missions",
            filter: `target_hospital_id=eq.${hospitalId}`,
          },
          handleMissionEvent,
        )
        .subscribe(handleStatus),
      supabase
        .channel(`dc-attempts-${hospitalId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "mission_dispatch_attempts" },
          handleAttemptEvent,
        )
        .subscribe(handleStatus),
      supabase
        .channel(`dc-offers-${hospitalId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "mission_offers" },
          handleOfferEvent,
        )
        .subscribe(handleStatus),
      supabase
        .channel(`dc-drivers-${hospitalId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "drivers",
            filter: `hospital_id=eq.${hospitalId}`,
          },
          handleDriverEvent,
        )
        .subscribe(handleStatus),
      supabase
        .channel(`dc-ambulances-${hospitalId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "ambulances",
            filter: `hospital_id=eq.${hospitalId}`,
          },
          handleAmbulanceEvent,
        )
        .subscribe(handleStatus),
    ];

    const handleOnline = () => {
      setConnection("reconnecting");
      void refresh();
    };
    const handleOffline = () => setConnection("offline");
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      stopPolling();
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      if (reconcileTimerRef.current) {
        clearTimeout(reconcileTimerRef.current);
        reconcileTimerRef.current = null;
      }
      if (driverTimerRef.current) {
        clearTimeout(driverTimerRef.current);
        driverTimerRef.current = null;
      }
      for (const channel of channels) void supabase.removeChannel(channel);
    };
  }, [
    getClient,
    handleAmbulanceEvent,
    handleAttemptEvent,
    handleDriverEvent,
    handleMissionEvent,
    handleOfferEvent,
    hospitalId,
    refresh,
  ]);

  const snapshot = useMemo<DashboardSnapshot | null>(() => {
    if (!overview) return null;
    return { ...overview, missions: mergeMissionLists(queue, activeMissions) };
  }, [overview, queue, activeMissions]);

  const updatedAt = useMemo(
    () => (overview ? Date.parse(overview.server_now) : null),
    [overview],
  );

  return {
    snapshot,
    origins,
    error,
    connection,
    refreshing,
    updatedAt,
    missionTotal,
    hasMore,
    loadingMore,
    missionError,
    refresh,
    loadMore,
    redispatch,
    redispatchCompany,
    createMission,
    createCompanyMission,
    loadCompanyOptions,
    loadCompanyRecipients,
  };
}
