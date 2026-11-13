import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  ConsultReportResult,
  ReportDetail,
  ReportErrorCode,
  ReportPageSize,
  ReportResult,
  ReportReview,
  ReportsPage,
  ReportReviewFilter,
  ReportSort,
  ReportTypeFilter,
  SetSeenResult,
  UnseenReports,
  UnseenReportsResult,
} from "./types";

type RpcError = { code?: string | null; message?: string | null } | null;

const MIGRATION_CODES = new Set(["42883", "42P01", "42703", "PGRST202"]);

export function mapReportError(error: RpcError): ReportErrorCode {
  if (!error) return "unexpected";
  const message = (error.message ?? "").toLowerCase();

  if (
    message.includes("hospital_management_access_required") ||
    message.includes("hospital_manager_auth_required")
  ) {
    return "access_denied";
  }
  if (message.includes("medical_report_not_found")) return "not_found";
  if (MIGRATION_CODES.has(error.code ?? "")) return "migration_pending";
  if (error.code === "42501") return "access_denied";
  if (error.code === "P0002") return "not_found";
  if (!error.code) return "network";
  return "unexpected";
}

export type ReportsQuery = {
  search: string;
  review: ReportReviewFilter;
  type: ReportTypeFilter;
  driverId: string | null;
  from: string;
  to: string;
  sort: ReportSort;
};

export async function fetchReportsPage(
  supabase: SupabaseClient,
  query: ReportsQuery,
  pageSize: ReportPageSize,
  offset: number,
): Promise<ReportResult<ReportsPage>> {
  const { data, error } = await supabase.rpc("hospital_manager_medical_reports_page", {
    p_search: query.search.trim() === "" ? null : query.search.trim(),
    p_review_status: query.review,
    p_report_type: query.type,
    p_driver_id: query.driverId,
    p_from: query.from === "" ? null : query.from,
    p_to: query.to === "" ? null : query.to,
    p_sort: query.sort,
    p_page_size: pageSize,
    p_offset: offset,
  });
  if (error) return { ok: false, code: mapReportError(error) };

  const page = data as ReportsPage | null;
  if (
    !page ||
    typeof page.total_count !== "number" ||
    !Array.isArray(page.items) ||
    !page.hospital ||
    !page.kpis
  ) {
    return { ok: false, code: "unexpected" };
  }
  return { ok: true, data: page };
}

export async function fetchReportDetail(
  supabase: SupabaseClient,
  reportId: string,
  revisionNo: number | null,
): Promise<ReportResult<ReportDetail>> {
  const { data, error } = await supabase.rpc("hospital_manager_medical_report_detail", {
    p_report_id: reportId,
    p_revision_no: revisionNo,
  });
  if (error) return { ok: false, code: mapReportError(error) };

  const detail = data as ReportDetail | null;
  if (
    !detail ||
    !detail.report ||
    typeof detail.report.revision_no !== "number" ||
    !Array.isArray(detail.revisions) ||
    !Array.isArray(detail.medications)
  ) {
    return { ok: false, code: "unexpected" };
  }
  return { ok: true, data: detail };
}

export async function markReportConsulted(
  supabase: SupabaseClient,
  reportId: string,
  revisionNo: number,
): Promise<ConsultReportResult> {
  const { data, error } = await supabase.rpc(
    "hospital_manager_mark_medical_report_consulted",
    { p_report_id: reportId, p_revision_no: revisionNo },
  );
  if (error) return { ok: false, code: mapReportError(error) };

  const row = data as { consulted_at?: string; consulted_by?: string } | null;
  if (!row || typeof row.consulted_at !== "string") {
    return { ok: false, code: "unexpected" };
  }
  const review: ReportReview = {
    consulted_at: row.consulted_at,
    consulted_by_name: null,
  };
  return { ok: true, data: review };
}

/**
 * Toggles the review flag of one transmitted revision. The RPC scopes the
 * lookup to the caller's hospital and records who changed it.
 */
export async function setReportSeen(
  supabase: SupabaseClient,
  reportId: string,
  revisionNo: number,
  seen: boolean,
): Promise<SetSeenResult> {
  const { data, error } = await supabase.rpc(
    "hospital_manager_mark_medical_report_seen",
    { p_report_id: reportId, p_revision_no: revisionNo, p_seen: seen },
  );
  if (error) return { ok: false, code: mapReportError(error) };

  const row = data as { seen?: boolean; reviewed_at?: string | null } | null;
  if (!row || typeof row.seen !== "boolean") {
    return { ok: false, code: "unexpected" };
  }
  return {
    ok: true,
    data: {
      seen: row.seen,
      reviewed_at: typeof row.reviewed_at === "string" ? row.reviewed_at : null,
    },
  };
}

/** The manager's unread inbox entries, newest first. Never any clinical value. */
export async function fetchUnseenReports(
  supabase: SupabaseClient,
  limit = 20,
): Promise<UnseenReportsResult> {
  const { data, error } = await supabase.rpc(
    "hospital_manager_medical_reports_unseen",
    { p_limit: limit },
  );
  if (error) return { ok: false, code: mapReportError(error) };

  const inbox = data as UnseenReports | null;
  if (!inbox || typeof inbox.unseen_count !== "number" || !Array.isArray(inbox.items)) {
    return { ok: false, code: "unexpected" };
  }
  return { ok: true, data: inbox };
}
