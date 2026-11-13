import { createSupabaseServerClient } from "@/lib/supabase/server";

import { fetchReportsPage, type ReportsQuery } from "./service";
import type { ReportResult, ReportsPage } from "./types";

export const DEFAULT_REPORTS_QUERY: ReportsQuery = {
  search: "",
  review: "all",
  type: "all",
  driverId: null,
  from: "",
  to: "",
  sort: "newest",
};

/**
 * First page for the initial render. The RPC authorizes the caller and derives
 * the hospital itself, so nothing hospital-scoped is read from a client id.
 */
export async function loadReportsPage(): Promise<ReportResult<ReportsPage>> {
  try {
    const supabase = await createSupabaseServerClient();
    return await fetchReportsPage(supabase, DEFAULT_REPORTS_QUERY, 20, 0);
  } catch {
    return { ok: false, code: "network" };
  }
}
