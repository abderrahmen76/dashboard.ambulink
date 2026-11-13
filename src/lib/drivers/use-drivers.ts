"use client";

import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
  SupabaseClient,
} from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";

import { assignHospitalAmbulanceDriver } from "@/lib/fleet/service";
import type { FleetAssignResult } from "@/lib/fleet/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

import { deactivateHospitalDriver, fetchDriverStats, fetchDriversPage } from "./service";
import type {
  DriverAssignmentFilter,
  DriverDeleteResult,
  DriverErrorCode,
  DriverPageSize,
  DriverResult,
  DriverStats,
  DriverStatusFilter,
  DriversPage,
} from "./types";

export type DriversConnectionState = "connecting" | "live" | "reconnecting" | "offline";

type PageState = {
  key: string;
  data: DriversPage | null;
  error: DriverErrorCode | null;
  refreshing: boolean;
};

type StatsState = {
  key: string;
  data: DriverStats | null;
  error: DriverErrorCode | null;
};

type DriverUpdate = {
  id?: string;
  availability?: boolean | null;
};

export type DriversQuery = {
  search: string;
  status: DriverStatusFilter;
  assignment: DriverAssignmentFilter;
};

const REFRESH_DEBOUNCE_MS = 500;
const FALLBACK_POLL_MS = 20_000;
const DEFAULT_PAGE_SIZE: DriverPageSize = 20;

function queryKeyOf(query: DriversQuery, pageSize: DriverPageSize): string {
  return `${query.search.trim()}|${query.status}|${query.assignment}|${pageSize}`;
}

/**
 * One Realtime socket, one channel per table, one debounced page refetch.
 * Driver UPDATEs caused only by a GPS write are ignored: only an availability
 * change alters the derived status or the KPI counts. Search, filters, page and
 * selection live in the caller, so a refresh never resets them.
 */
export function useDrivers(
  initial: DriverResult<DriversPage>,
  query: DriversQuery,
  initialQuery: DriversQuery = query,
) {
  const [pageSize, setPageSizeState] = useState<DriverPageSize>(DEFAULT_PAGE_SIZE);
  const [paging, setPaging] = useState<{ key: string; page: number } | null>(null);
  // See useReports: the server payload only answers `initialQuery`, so restored
  // filters invalidate it and the first render fetches instead of showing it.
  const firstQueryKey = `${queryKeyOf(query, DEFAULT_PAGE_SIZE)}:1`;
  const initialQueryKey = initial.ok
    ? `${queryKeyOf(initialQuery, DEFAULT_PAGE_SIZE)}:1`
    : null;
  const usableInitialData =
    initial.ok && initialQueryKey === firstQueryKey ? initial.data : null;
  const [state, setState] = useState<PageState | null>(() => {
    if (usableInitialData === null) return null;
    return {
      key: firstQueryKey,
      data: usableInitialData,
      error: null,
      refreshing: false,
    };
  });
  const [revision, setRevision] = useState(0);
  const [connection, setConnection] = useState<DriversConnectionState>("connecting");
  const [hospitalId, setHospitalId] = useState<string | null>(
    initial.ok ? initial.data.hospital.id : null,
  );
  const skipMountRef = useRef(usableInitialData !== null);

  const mountedRef = useRef(true);
  const availabilityRef = useRef(
    new Map<string, boolean | null>(
      initial.ok
        ? initial.data.items.map(
            (driver): [string, boolean | null] => [driver.id, driver.availability],
          )
        : [],
    ),
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(false);
  const queuedRef = useRef(false);
  const refetchRef = useRef<() => Promise<void>>(async () => {});

  const resetKey = queryKeyOf(query, pageSize);
  const page = paging !== null && paging.key === resetKey ? paging.page : 1;
  const key = `${resetKey}:${page}`;
  const offset = (page - 1) * pageSize;

  const refetch = useCallback(async () => {
    if (inFlightRef.current) {
      queuedRef.current = true;
      return;
    }
    inFlightRef.current = true;
    try {
      let runAgain = true;
      while (runAgain) {
        runAgain = false;
        queuedRef.current = false;
        const supabase = createSupabaseBrowserClient();
        const result = supabase
          ? await fetchDriversPage(
              supabase,
              query.search,
              query.status,
              query.assignment,
              pageSize,
              offset,
            )
          : ({ ok: false, code: "unexpected" } as DriverResult<DriversPage>);
        if (!mountedRef.current) return;

        setState((previous) => {
          if (result.ok) {
            return { key, data: result.data, error: null, refreshing: false };
          }
          return {
            key,
            data: previous?.key === key ? previous.data : null,
            error: result.code,
            refreshing: false,
          };
        });

        if (result.ok) {
          setHospitalId(result.data.hospital.id);
          availabilityRef.current = new Map(
            result.data.items.map(
              (driver): [string, boolean | null] => [driver.id, driver.availability],
            ),
          );
          const lastPage = Math.max(
            1,
            Math.ceil(result.data.total_count / pageSize),
          );
          if (page > lastPage) setPaging({ key: resetKey, page: lastPage });
        }

        if (queuedRef.current) runAgain = true;
      }
    } finally {
      inFlightRef.current = false;
    }
  }, [
    key,
    offset,
    page,
    pageSize,
    query.assignment,
    query.search,
    query.status,
    resetKey,
  ]);

  useEffect(() => {
    refetchRef.current = refetch;
  }, [refetch]);

  const scheduleRefresh = useCallback((delay = REFRESH_DEBOUNCE_MS) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      void refetchRef.current();
    }, delay);
  }, []);

  const refresh = useCallback(() => {
    setState((previous) =>
      previous === null ? previous : { ...previous, refreshing: true },
    );
    setRevision((value) => value + 1);
  }, []);

  // Every query/page/revision change loads exactly that page. State is only
  // written from the promise callback, never synchronously in the effect.
  useEffect(() => {
    if (skipMountRef.current) {
      skipMountRef.current = false;
    } else {
      void refetch();
    }
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [refetch, revision]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!hospitalId) return;
    const supabase: SupabaseClient | null = createSupabaseBrowserClient();
    if (!supabase) return;

    let pollTimer: ReturnType<typeof setInterval> | null = null;
    const startPolling = () => {
      if (pollTimer) return;
      pollTimer = setInterval(() => scheduleRefresh(0), FALLBACK_POLL_MS);
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
        .channel(`drivers-registry-${hospitalId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "drivers",
            filter: `hospital_id=eq.${hospitalId}`,
          },
          (payload: RealtimePostgresChangesPayload<DriverUpdate>) => {
            const row = payload.new as DriverUpdate;
            if (!row.id) return;
            const known = availabilityRef.current.get(row.id);
            const changed =
              availabilityRef.current.has(row.id) && known !== row.availability;
            availabilityRef.current.set(row.id, row.availability ?? null);
            if (changed) scheduleRefresh();
          },
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "drivers",
            filter: `hospital_id=eq.${hospitalId}`,
          },
          () => scheduleRefresh(),
        )
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "drivers",
            filter: `hospital_id=eq.${hospitalId}`,
          },
          () => scheduleRefresh(),
        )
        .subscribe(handleStatus),
      supabase
        .channel(`drivers-missions-${hospitalId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "missions",
            filter: `target_hospital_id=eq.${hospitalId}`,
          },
          () => scheduleRefresh(),
        )
        .subscribe(handleStatus),
      supabase
        .channel(`drivers-ambulances-${hospitalId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "ambulances",
            filter: `hospital_id=eq.${hospitalId}`,
          },
          () => scheduleRefresh(),
        )
        .subscribe(handleStatus),
      supabase
        .channel(`drivers-memberships-${hospitalId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "hospital_memberships",
            filter: `hospital_id=eq.${hospitalId}`,
          },
          () => scheduleRefresh(),
        )
        .subscribe(handleStatus),
    ];

    const handleOnline = () => {
      setConnection("reconnecting");
      scheduleRefresh(0);
    };
    const handleOffline = () => setConnection("offline");
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      stopPolling();
      for (const channel of channels) void supabase.removeChannel(channel);
    };
  }, [hospitalId, scheduleRefresh]);

  const current = state !== null && state.key === key ? state : null;

  const setPageSize = useCallback((value: DriverPageSize) => {
    setPageSizeState(value);
  }, []);

  const setPage = useCallback(
    (value: number) => {
      setPaging({ key: resetKey, page: Math.max(1, Math.floor(value)) });
    },
    [resetKey],
  );

  const assignDriver = useCallback(
    async (
      ambulanceId: string,
      driverId: string | null,
      confirmReplace: boolean,
    ): Promise<FleetAssignResult> => {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) return { ok: false, code: "unexpected" };
      const result = await assignHospitalAmbulanceDriver(
        supabase,
        ambulanceId,
        driverId,
        confirmReplace,
      );
      if (result.ok && mountedRef.current) refresh();
      return result;
    },
    [refresh],
  );

  const deleteDriver = useCallback(
    async (driverId: string): Promise<DriverDeleteResult> => {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) return { ok: false, code: "unexpected" };
      const result = await deactivateHospitalDriver(supabase, driverId);
      if (result.ok && mountedRef.current) refresh();
      return result;
    },
    [refresh],
  );

  return {
    /** Last page received; while a new query loads it is the previous page. */
    data: state?.data ?? null,
    loading: current === null,
    refreshing: current?.refreshing ?? false,
    error: current?.error ?? null,
    connection,
    page,
    pageSize,
    offset,
    totalCount: state?.data?.total_count ?? 0,
    revision,
    setPage,
    setPageSize,
    refresh,
    assignDriver,
    deleteDriver,
  };
}

/**
 * Real mission history of the selected driver. Keyed by driver so a newly
 * selected row never shows the previous driver's counts; `revision` refetches
 * after a registry refresh without clearing the current numbers.
 */
export function useDriverStats(driverId: string | null, revision: number) {
  const [state, setState] = useState<StatsState | null>(null);

  useEffect(() => {
    if (!driverId) return;
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();
    const request = supabase
      ? fetchDriverStats(supabase, driverId)
      : Promise.resolve<DriverResult<DriverStats>>({ ok: false, code: "unexpected" });

    void request.then((result) => {
      if (cancelled) return;
      setState(
        result.ok
          ? { key: driverId, data: result.data, error: null }
          : { key: driverId, data: null, error: result.code },
      );
    });

    return () => {
      cancelled = true;
    };
  }, [driverId, revision]);

  const current = state !== null && state.key === driverId ? state : null;
  return {
    stats: current?.data ?? null,
    loading: driverId !== null && current === null,
    error: current?.error ?? null,
  };
}
