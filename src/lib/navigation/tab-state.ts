"use client";

import { useEffect, useState } from "react";

/**
 * In-memory per-tab UI state. It survives client-side tab switches because the
 * module lives for the whole document, and it is deliberately never written to
 * storage: filters can contain patient names, and nothing here may outlive the
 * tab or the signed-in session. A reload starts from the defaults.
 */
const store = new Map<string, unknown>();
let scope: string | null = null;

/**
 * Drops everything remembered for a previous sign-in. Called by the shell with
 * the current manager id, so a second account in the same document never sees
 * the first account's filters.
 */
export function ensureTabStateScope(next: string) {
  if (scope === next) return;
  scope = next;
  store.clear();
}

export function useTabState<T>(key: string, initial: T | (() => T)) {
  const [value, setValue] = useState<T>(() => {
    if (store.has(key)) return store.get(key) as T;
    return typeof initial === "function" ? (initial as () => T)() : initial;
  });

  useEffect(() => {
    store.set(key, value);
  }, [key, value]);

  return [value, setValue] as const;
}
