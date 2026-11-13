import { createSupabaseServerClient } from "@/lib/supabase/server";

import { fetchBootstrap, type DashboardResult } from "./service";
import type { DashboardBootstrap } from "./types";

/**
 * First consistent overview + queue page for the initial render. The RPCs
 * authorize the caller and derive the hospital themselves, so nothing
 * hospital-scoped is read from a client-supplied id. When the paging draft is
 * not applied yet, the result is the legacy full snapshot with `paged: false`.
 */
export async function loadDashboardBootstrap(): Promise<
  DashboardResult<DashboardBootstrap>
> {
  try {
    const supabase = await createSupabaseServerClient();
    return await fetchBootstrap(supabase);
  } catch {
    return { ok: false, code: "network" };
  }
}
