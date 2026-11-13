"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

import { fetchMissionsAnalytics } from "./service";
import type {
  MissionsAnalytics,
  MissionsAnalyticsQuery,
  MissionsErrorCode,
  MissionsResult,
} from "./types";

type State = {
  /** Query key the payload below belongs to; a newer key means "loading". */
  key: string;
  data: MissionsAnalytics | null;
  error: MissionsErrorCode | null;
};

function queryKeyOf(query: MissionsAnalyticsQuery): string {
  return [
    query.from,
    query.to,
    query.bucket,
    query.status,
    query.search.trim(),
    query.sort,
    query.page,
    query.pageSize,
  ].join("|");
}

/**
 * Server-paged mission analytics. The caller owns the filters; this hook
 * refetches when their derived key changes or the user asks for a refresh, and
 * a cancelled response can never overwrite a newer one. The previous payload
 * stays on screen while the next key loads, so charts never blank out.
 */
export function useMissionsAnalytics(
  initial: MissionsResult<MissionsAnalytics>,
  query: MissionsAnalyticsQuery,
  initialQuery: MissionsAnalyticsQuery = query,
) {
  const [tick, setTick] = useState(0);
  const key = `${queryKeyOf(query)}:${tick}`;
  // The server payload belongs to `initialQuery`, not necessarily to the query
  // restored from the previous visit. It is only adopted when the two match.
  const firstQueryKey = `${queryKeyOf(query)}:0`;
  const initialQueryKey = initial.ok ? `${queryKeyOf(initialQuery)}:0` : null;
  const usableInitialData =
    initial.ok && initialQueryKey === firstQueryKey ? initial.data : null;

  const [state, setState] = useState<State>(() => ({
    key: firstQueryKey,
    data: usableInitialData,
    error: initial.ok ? null : initial.code,
  }));
  const skipInitialRef = useRef(usableInitialData !== null);

  useEffect(() => {
    if (skipInitialRef.current) {
      skipInitialRef.current = false;
      return;
    }

    let cancelled = false;
    const nextKey = `${queryKeyOf(query)}:${tick}`;
    const supabase = createSupabaseBrowserClient();
    const request = supabase
      ? fetchMissionsAnalytics(supabase, query)
      : Promise.resolve<MissionsResult<MissionsAnalytics>>({
          ok: false,
          code: "network",
        });

    void request.then((result) => {
      if (cancelled) return;
      setState((previous) =>
        result.ok
          ? { key: nextKey, data: result.data, error: null }
          : {
              key: nextKey,
              data: previous.data,
              error: previous.data ? "stale" : result.code,
            },
      );
    });

    return () => {
      cancelled = true;
    };
  }, [query, tick]);

  const refresh = useCallback(() => setTick((value) => value + 1), []);

  const current = state.key === key ? state : null;

  return {
    data: state.data,
    error: current?.error ?? null,
    refreshing: current === null && state.data !== null,
    loading: current === null && state.data === null,
    refresh,
  };
}
