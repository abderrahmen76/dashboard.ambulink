import type { MessageKey } from "@/lib/i18n/dictionaries";

import type { DashboardErrorCode } from "./service";

const ERROR_KEYS: Record<DashboardErrorCode, MessageKey> = {
  migration_pending: "dc.error.migration_pending",
  access_denied: "dc.error.access_denied",
  no_candidates: "dc.error.no_candidates",
  driver_not_eligible: "dc.error.driver_not_eligible",
  dispatch_in_progress: "dc.error.dispatch_in_progress",
  conflict: "dc.error.conflict",
  not_found: "dc.error.conflict",
  network: "dc.error.network",
  unexpected: "dc.error.unexpected",
  stale: "dc.error.stale",
  company_unavailable: "dc.error.company_unavailable",
};

export function dashboardErrorMessageKey(code: DashboardErrorCode): MessageKey {
  return ERROR_KEYS[code];
}
