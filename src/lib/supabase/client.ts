"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseEnv } from "./env";

let cached: SupabaseClient | null = null;

/**
 * Single browser client per tab: Supabase keeps one Realtime socket per client,
 * so reusing it prevents duplicate channels and repeated auth refreshes.
 * Only the publishable key is used here.
 */
export function createSupabaseBrowserClient(): SupabaseClient | null {
  if (cached) return cached;
  const env = getSupabaseEnv();
  if (!env) return null;
  cached = createBrowserClient(env.url, env.key);
  return cached;
}
