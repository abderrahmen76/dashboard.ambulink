import type { ReportDetail, ReportErrorCode, ReportResult } from "./types";

export type DetailState = {
  key: string;
  data: ReportDetail | null;
  error: ReportErrorCode | null;
};

/**
 * The poll counter is deliberately absent: the same selected report keeps its
 * identity across list refreshes, so the viewer is never remounted by polling.
 */
export function detailIdentityKey(
  reportId: string | null,
  revisionNo: number | null,
): string {
  return reportId === null ? "" : `${reportId}:${revisionNo ?? "latest"}`;
}

/**
 * Detail identity is the report (plus the requested revision), never the list
 * poll counter: a 30 s list refresh must not blank the open report. A new
 * result replaces the content in place; a failed background refetch keeps the
 * last content for the same report so the viewer and its scroll stay mounted.
 */
export function applyDetailResult(
  previous: DetailState | null,
  key: string,
  result: ReportResult<ReportDetail>,
): DetailState {
  if (result.ok) return { key, data: result.data, error: null };
  return {
    key,
    data: previous !== null && previous.key === key ? previous.data : null,
    error: result.code,
  };
}

export function visibleDetailState(
  state: DetailState | null,
  key: string,
): DetailState | null {
  return state !== null && state.key === key ? state : null;
}
