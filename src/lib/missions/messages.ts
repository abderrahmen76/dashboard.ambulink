import type { MessageKey } from "@/lib/i18n/dictionaries";

import type { MissionStatus, MissionsErrorCode } from "./types";

const STATUS_KEYS: Record<MissionStatus, MessageKey> = {
  requested: "dc.status.requested",
  accepted: "dc.status.accepted",
  en_route: "dc.status.en_route",
  arrived: "dc.status.arrived",
  in_progress: "dc.status.in_progress",
  completed: "dc.status.completed",
  cancelled: "dc.status.cancelled",
};

export function missionStatusLabel(status: MissionStatus): MessageKey {
  return STATUS_KEYS[status];
}

const ERROR_KEYS: Record<MissionsErrorCode, MessageKey> = {
  migration_pending: "ma.error.migration",
  access_denied: "ma.error.access",
  invalid: "ma.error.invalid",
  network: "ma.error.network",
  unexpected: "ma.error.unexpected",
  stale: "ma.error.stale",
};

export function missionsErrorKey(code: MissionsErrorCode): MessageKey {
  return ERROR_KEYS[code];
}
