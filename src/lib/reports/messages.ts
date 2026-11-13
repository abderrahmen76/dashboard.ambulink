import type { MessageKey } from "@/lib/i18n/dictionaries";

import type { ReportErrorCode, ReportReviewStatus, ReportType } from "./types";

export const REPORT_ERROR_KEYS: Record<ReportErrorCode, MessageKey> = {
  migration_pending: "reports.error.migration",
  access_denied: "reports.error.access",
  not_found: "reports.error.notFound",
  network: "reports.error.network",
  unexpected: "reports.error.unexpected",
};

export function reportErrorMessageKey(code: ReportErrorCode): MessageKey {
  return REPORT_ERROR_KEYS[code];
}

const REPORT_TYPE_KEYS: Record<ReportType, MessageKey> = {
  urgence: "reports.type.urgence",
  transfert: "reports.type.transfert",
  retour_domicile: "reports.type.retour_domicile",
  consultation: "reports.type.consultation",
  hospitalisation: "reports.type.hospitalisation",
  autre: "reports.type.autre",
};

const REPORT_TYPE_FALLBACK: Record<string, MessageKey> = REPORT_TYPE_KEYS;

export function reportTypeKey(value: string | null): MessageKey | null {
  if (!value) return null;
  return REPORT_TYPE_FALLBACK[value] ?? null;
}

const NEED_KEYS: Record<string, MessageKey> = {
  oxygen: "reports.need.oxygen",
  perfusion: "reports.need.perfusion",
  monitoring: "reports.need.monitoring",
  dressing: "reports.need.dressing",
  immobilization: "reports.need.immobilization",
  heart_rate: "reports.need.heart_rate",
  blood_pressure: "reports.need.blood_pressure",
  spo2: "reports.need.spo2",
  dextro: "reports.need.dextro",
};

export function needLabelKey(value: string): MessageKey | null {
  return NEED_KEYS[value] ?? null;
}

const SUPPORT_KEYS: Record<string, MessageKey> = {
  vni: "reports.support.vni",
  vc: "reports.support.vc",
};

export function supportLabelKey(value: string): MessageKey | null {
  return SUPPORT_KEYS[value] ?? null;
}

const PSE_KEYS: Record<string, MessageKey> = {
  noradrenaline: "reports.pse.noradrenaline",
  adrenaline: "reports.pse.adrenaline",
  sedation: "reports.pse.sedation",
  heparin: "reports.pse.heparin",
  rivotril: "reports.pse.rivotril",
};

export function pseLabelKey(value: string): MessageKey | null {
  return PSE_KEYS[value] ?? null;
}

const MISSION_STATUS_KEYS: Record<string, MessageKey> = {
  requested: "dc.status.requested",
  accepted: "dc.status.accepted",
  en_route: "dc.status.en_route",
  arrived: "dc.status.arrived",
  in_progress: "dc.status.in_progress",
  completed: "dc.status.completed",
  cancelled: "dc.status.cancelled",
};

export function missionStatusKey(value: string | null): MessageKey | null {
  if (!value) return null;
  return MISSION_STATUS_KEYS[value] ?? null;
}

export function reviewStatusKey(status: ReportReviewStatus): MessageKey {
  return status === "reviewed" ? "reports.review.reviewed" : "reports.review.pending";
}
