"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

import { fetchFuelHistory, fetchMaintenanceHistory } from "./service";
import type {
  FleetErrorCode,
  FleetFuelHistoryPage,
  FleetHistoryPageSize,
  FleetHistoryPeriod,
  FleetMaintenanceHistoryPage,
  FleetResult,
} from "./types";

type HistoryPage = {
  total_count: number;
  items: unknown[];
};

type HistoryFetcher<T> = (
  supabase: SupabaseClient,
  ambulanceId: string,
  period: FleetHistoryPeriod,
  pageSize: FleetHistoryPageSize,
  offset: number,
) => Promise<FleetResult<T>>;

type SectionState<T> = {
  key: string;
  data: T | null;
  error: FleetErrorCode | null;
  refreshing: boolean;
};

export type HistorySection<T extends HistoryPage> = {
  period: FleetHistoryPeriod;
  pageSize: FleetHistoryPageSize;
  page: number;
  pageCount: number;
  totalCount: number;
  data: T | null;
  loading: boolean;
  refreshing: boolean;
  error: FleetErrorCode | null;
  setPeriod: (value: FleetHistoryPeriod) => void;
  setPageSize: (value: FleetHistoryPageSize) => void;
  setPage: (value: number) => void;
  refresh: () => void;
};

/**
 * One page of one section. `resetKey` folds ambulance, period and page size
 * together, so changing any of them derives page 1 on the same render: no
 * stale page is ever requested, and pagination resets without an extra fetch.
 */
function useHistorySection<T extends HistoryPage>(
  ambulanceId: string | null,
  fetcher: HistoryFetcher<T>,
): HistorySection<T> {
  const [period, setPeriodState] = useState<FleetHistoryPeriod>("all");
  const [pageSize, setPageSizeState] = useState<FleetHistoryPageSize>(20);
  const [paging, setPaging] = useState<{ key: string; page: number } | null>(null);
  const [state, setState] = useState<SectionState<T> | null>(null);
  const [revision, setRevision] = useState(0);

  const resetKey = `${ambulanceId ?? "none"}:${period}:${pageSize}`;
  const page = paging !== null && paging.key === resetKey ? paging.page : 1;
  const key = `${resetKey}:${page}`;
  const offset = (page - 1) * pageSize;

  useEffect(() => {
    if (!ambulanceId) return;
    let cancelled = false;

    const supabase = createSupabaseBrowserClient();
    const request = supabase
      ? fetcher(supabase, ambulanceId, period, pageSize, offset)
      : Promise.resolve<FleetResult<T>>({ ok: false, code: "unexpected" });

    void request.then((result) => {
      if (cancelled) return;

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

      // A record deletion can leave the current page past the end; step back
      // instead of showing an empty page with a valid total.
      if (result.ok) {
        const lastPage = Math.max(1, Math.ceil(result.data.total_count / pageSize));
        if (page > lastPage) setPaging({ key: resetKey, page: lastPage });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [ambulanceId, period, pageSize, offset, key, page, resetKey, revision, fetcher]);

  const current = state !== null && state.key === key ? state : null;
  const totalCount = current?.data?.total_count ?? 0;
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));

  const setPeriod = useCallback((value: FleetHistoryPeriod) => {
    setPeriodState(value);
  }, []);

  const setPageSize = useCallback((value: FleetHistoryPageSize) => {
    setPageSizeState(value);
  }, []);

  const setPage = useCallback(
    (value: number) => {
      setPaging({ key: resetKey, page: Math.max(1, Math.floor(value)) });
    },
    [resetKey],
  );

  const refresh = useCallback(() => {
    setState((previous) =>
      previous === null ? previous : { ...previous, refreshing: true },
    );
    setRevision((value) => value + 1);
  }, []);

  return {
    period,
    pageSize,
    page,
    pageCount,
    totalCount,
    data: current?.data ?? null,
    loading: ambulanceId !== null && current === null,
    refreshing: current?.refreshing ?? false,
    error: current?.error ?? null,
    setPeriod,
    setPageSize,
    setPage,
    refresh,
  };
}

export function useVehicleHistory(ambulanceId: string | null) {
  const fuel = useHistorySection<FleetFuelHistoryPage>(ambulanceId, fetchFuelHistory);
  const maintenance = useHistorySection<FleetMaintenanceHistoryPage>(
    ambulanceId,
    fetchMaintenanceHistory,
  );
  return { fuel, maintenance };
}
