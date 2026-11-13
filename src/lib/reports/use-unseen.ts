"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

import { fetchUnseenReports } from "./service";
import type { UnseenReportItem, UnseenReports } from "./types";

const POLL_MS = 30_000;
const TOAST_MS = 7_000;

/** Dispatched after a local seen/unseen toggle so the badge refreshes now. */
export const INBOX_CHANGED_EVENT = "ambulink:inbox-changed";

export type UnseenToast = {
  /** Patient name when exactly one report arrived, null for a batch. */
  name: string | null;
  count: number;
};

function keyOf(item: UnseenReportItem): string {
  return `${item.report_id}:${item.revision_no}`;
}

/**
 * Unread count for the manager's hospital plus a one-shot notice per genuinely
 * new transmission. The first successful load seeds the known keys, so opening
 * the app never replays reports the manager already had in the inbox.
 */
export function useUnseenReports() {
  const [unseenCount, setUnseenCount] = useState(0);
  const [toast, setToast] = useState<UnseenToast | null>(null);

  const knownRef = useRef<Set<string>>(new Set());
  const seededRef = useRef(false);
  const mountedRef = useRef(false);
  const inFlightRef = useRef(false);

  const apply = useCallback((data: UnseenReports, silent: boolean) => {
    const fresh: UnseenReportItem[] = [];
    for (const item of data.items) {
      const key = keyOf(item);
      if (!knownRef.current.has(key)) {
        knownRef.current.add(key);
        fresh.push(item);
      }
    }
    setUnseenCount(data.unseen_count);

    if (!seededRef.current) {
      seededRef.current = true;
      return;
    }
    if (silent || fresh.length === 0) return;

    const newest = fresh[0];
    setToast(
      fresh.length === 1
        ? { name: newest.patient_full_name, count: 1 }
        : { name: null, count: fresh.length },
    );
  }, []);

  const refresh = useCallback(
    async (options?: { silent?: boolean }) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        const supabase = createSupabaseBrowserClient();
        if (!supabase) return;
        const result = await fetchUnseenReports(supabase);
        if (!mountedRef.current || !result.ok) return;
        apply(result.data, options?.silent === true);
      } finally {
        inFlightRef.current = false;
      }
    },
    [apply],
  );

  useEffect(() => {
    mountedRef.current = true;
    void refresh();

    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const onInboxChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ silent?: boolean }>).detail;
      void refresh({ silent: detail?.silent === true });
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(INBOX_CHANGED_EVENT, onInboxChanged);
    return () => {
      mountedRef.current = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(INBOX_CHANGED_EVENT, onInboxChanged);
    };
  }, [refresh]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const dismissToast = useCallback(() => setToast(null), []);

  return { unseenCount, toast, dismissToast };
}
