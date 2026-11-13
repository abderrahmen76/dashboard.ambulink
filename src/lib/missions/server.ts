import { createSupabaseServerClient } from "@/lib/supabase/server";

import { bucketFor, rangeBounds } from "./format";
import { fetchMissionsAnalytics } from "./service";
import type { MissionsAnalytics, MissionsAnalyticsQuery, MissionsResult } from "./types";

export const DEFAULT_MISSIONS_QUERY: Omit<
  MissionsAnalyticsQuery,
  "from" | "to" | "bucket"
> = {
  status: "all",
  search: "",
  sort: "newest",
  page: 1,
  pageSize: 10,
};

/**
 * First render for the default period. The RPC derives the hospital from the
 * session, so this loader sends only a date window and table options. The exact
 * query is returned so the client hook can tell whether the payload it received
 * still matches the filters being restored from the previous visit.
 */
export async function loadMissionsAnalytics(): Promise<{
  result: MissionsResult<MissionsAnalytics>;
  query: MissionsAnalyticsQuery;
}> {
  const now = new Date().toISOString();
  const range = rangeBounds("30d", now);
  const query: MissionsAnalyticsQuery = {
    ...DEFAULT_MISSIONS_QUERY,
    ...range,
    bucket: bucketFor(range.from, range.to),
  };

  try {
    const supabase = await createSupabaseServerClient();
    return { result: await fetchMissionsAnalytics(supabase, query), query };
  } catch {
    return { result: { ok: false, code: "network" }, query };
  }
}
