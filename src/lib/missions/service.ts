import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  MissionsAnalytics,
  MissionsAnalyticsQuery,
  MissionsErrorCode,
  MissionsResult,
} from "./types";

type RpcError = { code?: string | null; message?: string | null } | null;

const MESSAGE_CODES: ReadonlyArray<[string, MissionsErrorCode]> = [
  ["hospital_manager_auth_required", "access_denied"],
  ["hospital_management_access_required", "access_denied"],
  ["missions_analytics_range_invalid", "invalid"],
  ["missions_analytics_status_invalid", "invalid"],
  ["missions_analytics_sort_invalid", "invalid"],
  ["missions_analytics_bucket_invalid", "invalid"],
];

export function mapMissionsError(error: RpcError): MissionsErrorCode {
  if (!error) return "unexpected";
  const message = (error.message ?? "").toLowerCase();
  for (const [needle, code] of MESSAGE_CODES) {
    if (message.includes(needle)) return code;
  }
  switch (error.code) {
    case "42883":
    case "42P01":
    case "42703":
    case "PGRST202":
      return "migration_pending";
    case "42501":
      return "access_denied";
    case "22023":
    case "23514":
    case "P0001":
      return "invalid";
    case undefined:
    case null:
    case "":
      return "network";
    default:
      return "unexpected";
  }
}

export async function fetchMissionsAnalytics(
  supabase: SupabaseClient,
  query: MissionsAnalyticsQuery,
): Promise<MissionsResult<MissionsAnalytics>> {
  const { data, error } = await supabase.rpc("hospital_manager_missions_analytics", {
    p_from: query.from,
    p_to: query.to,
    p_status: query.status === "all" ? null : query.status,
    p_search: query.search.trim() === "" ? null : query.search.trim(),
    p_sort: query.sort,
    p_page: query.page,
    p_page_size: query.pageSize,
    p_bucket: query.bucket,
  });
  if (error) return { ok: false, code: mapMissionsError(error) };
  if (!data) return { ok: false, code: "unexpected" };
  return { ok: true, data: data as MissionsAnalytics };
}
