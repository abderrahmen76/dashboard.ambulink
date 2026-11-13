"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

import {
  fetchReportDetail,
  fetchReportsPage,
  markReportConsulted,
  setReportSeen,
  type ReportsQuery,
} from "./service";
import type {
  ConsultReportResult,
  ReportDetail,
  ReportErrorCode,
  ReportPageSize,
  ReportResult,
  ReportReview,
  ReportsPage,
  SetSeenResult,
} from "./types";

const FALLBACK_POLL_MS = 30_000;
const DEFAULT_PAGE_SIZE: ReportPageSize = 20;

type PageState = {
  key: string;
  data: ReportsPage | null;
  error: ReportErrorCode | null;
  refreshing: boolean;
};

function queryKeyOf(query: ReportsQuery, pageSize: ReportPageSize): string {
  return [
    query.search.trim(),
    query.review,
    query.type,
    query.driverId ?? "",
    query.from,
    query.to,
    query.sort,
    pageSize,
  ].join("|");
}

/**
 * Server-paged medical reports. The clinical tables are intentionally not in
 * the Realtime publication (202610270002), so this hook refreshes on demand and
 * on a single visibility-gated interval. Filters, page and selection live in
 * the caller, so a refresh never resets them.
 */
export function useReports(
  initial: ReportResult<ReportsPage>,
  query: ReportsQuery,
  initialQuery: ReportsQuery = query,
) {
  const [pageSize, setPageSizeState] = useState<ReportPageSize>(DEFAULT_PAGE_SIZE);
  const [paging, setPaging] = useState<{ key: string; page: number } | null>(null);
  // The server payload belongs to `initialQuery`. When the previous visit's
  // filters are restored they may differ, so the payload is only adopted if it
  // still answers the query being rendered.
  const firstQueryKey = `${queryKeyOf(query, DEFAULT_PAGE_SIZE)}:1`;
  const initialQueryKey = initial.ok
    ? `${queryKeyOf(initialQuery, DEFAULT_PAGE_SIZE)}:1`
    : null;
  const usableInitialData = initial.ok && initialQueryKey === firstQueryKey ? initial.data : null;
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
  const skipMountRef = useRef(usableInitialData !== null);

  const mountedRef = useRef(true);
  const inFlightRef = useRef(false);
  const queuedRef = useRef(false);

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
          ? await fetchReportsPage(supabase, query, pageSize, offset)
          : ({ ok: false, code: "unexpected" } as ReportResult<ReportsPage>);
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
          const lastPage = Math.max(1, Math.ceil(result.data.total_count / pageSize));
          if (page > lastPage) setPaging({ key: resetKey, page: lastPage });
        }

        if (queuedRef.current) runAgain = true;
      }
    } finally {
      inFlightRef.current = false;
    }
  }, [key, offset, page, pageSize, query, resetKey]);

  const refresh = useCallback(() => {
    setState((previous) =>
      previous === null ? previous : { ...previous, refreshing: true },
    );
    setRevision((value) => value + 1);
  }, []);

  useEffect(() => {
    if (skipMountRef.current) {
      skipMountRef.current = false;
      return;
    }
    void refetch();
  }, [refetch, revision]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, FALLBACK_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const current = state !== null && state.key === key ? state : null;

  const setPageSize = useCallback((value: ReportPageSize) => {
    setPageSizeState(value);
  }, []);

  const setPage = useCallback(
    (value: number) => {
      setPaging({ key: resetKey, page: Math.max(1, Math.floor(value)) });
    },
    [resetKey],
  );

  return {
    /** Last page received; while a new query loads it is the previous page. */
    data: state?.data ?? null,
    loading: current === null,
    refreshing: current?.refreshing ?? false,
    error: current?.error ?? null,
    page,
    pageSize,
    offset,
    totalCount: state?.data?.total_count ?? 0,
    revision,
    setPage,
    setPageSize,
    refresh,
  };
}

type DetailState = {
  key: string;
  data: ReportDetail | null;
  error: ReportErrorCode | null;
};

/**
 * Full report for one revision, fetched only when the row is selected. The key
 * includes the page revision so a refresh also reloads the detail without
 * clearing the reader's scroll position in the list.
 */
export function useReportDetail(
  reportId: string | null,
  revisionNo: number | null,
  revision: number,
) {
  const [state, setState] = useState<DetailState | null>(null);
  const key = reportId === null ? "" : `${reportId}:${revisionNo ?? "latest"}:${revision}`;

  useEffect(() => {
    if (reportId === null) return;
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();
    const request = supabase
      ? fetchReportDetail(supabase, reportId, revisionNo)
      : Promise.resolve<ReportResult<ReportDetail>>({
          ok: false,
          code: "unexpected" as const,
        });

    void request.then((result) => {
      if (cancelled) return;
      setState(
        result.ok
          ? { key, data: result.data, error: null }
          : { key, data: null, error: result.code },
      );
    });

    return () => {
      cancelled = true;
    };
  }, [key, reportId, revision, revisionNo]);

  const current = state !== null && state.key === key ? state : null;

  const applyReview = useCallback(
    (review: ReportReview | null) => {
      setState((previous) => {
        if (!previous || !previous.data) return previous;
        return {
          ...previous,
          data: { ...previous.data, review },
        };
      });
    },
    [],
  );

  const consult = useCallback(
    async (): Promise<ConsultReportResult> => {
      if (!current?.data) return { ok: false, code: "unexpected" };
      const supabase = createSupabaseBrowserClient();
      if (!supabase) return { ok: false, code: "unexpected" };
      const result = await markReportConsulted(
        supabase,
        current.data.report.id,
        current.data.report.revision_no,
      );
      if (result.ok) applyReview(result.data);
      return result;
    },
    [applyReview, current],
  );

  /** Clears the review flag of the revision being read, back to unseen. */
  const markUnseen = useCallback(async (): Promise<SetSeenResult> => {
    if (!current?.data) return { ok: false, code: "unexpected" };
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return { ok: false, code: "unexpected" };
    const result = await setReportSeen(
      supabase,
      current.data.report.id,
      current.data.report.revision_no,
      false,
    );
    if (result.ok) applyReview(null);
    return result;
  }, [applyReview, current]);

  return {
    detail: current?.data ?? null,
    loading: reportId !== null && current === null,
    error: current?.error ?? null,
    applyReview,
    consult,
    markUnseen,
  };
}
