import type { MessageKey } from "@/lib/i18n/dictionaries";

import type {
  FleetArchiveErrorCode,
  FleetAssignErrorCode,
  FleetErrorCode,
  FleetRecordSaveErrorCode,
  FleetSaveErrorCode,
} from "./types";

const ERROR_KEYS: Record<FleetErrorCode, MessageKey> = {
  migration_pending: "fleet.error.migration_pending",
  access_denied: "fleet.error.access_denied",
  not_found: "fleet.error.not_found",
  conflict: "fleet.error.conflict",
  network: "dc.error.network",
  unexpected: "dc.error.unexpected",
  stale: "dc.error.stale",
};

export function fleetErrorMessageKey(code: FleetErrorCode): MessageKey {
  return ERROR_KEYS[code];
}

const SAVE_KEYS: Record<FleetSaveErrorCode, MessageKey> = {
  label_required: "fleet.vehicle.error.label",
  mileage_invalid: "fleet.vehicle.error.mileage",
  status_invalid: "fleet.vehicle.error.unexpected",
  mission_active: "fleet.vehicle.error.missionActive",
  not_found: "fleet.vehicle.error.notFound",
  duplicate: "fleet.vehicle.error.duplicate",
  access_denied: "fleet.vehicle.error.access",
  migration_pending: "fleet.vehicle.error.migration",
  network: "fleet.vehicle.error.network",
  unexpected: "fleet.vehicle.error.unexpected",
};

export function fleetSaveErrorMessageKey(code: FleetSaveErrorCode): MessageKey {
  return SAVE_KEYS[code];
}

const ASSIGN_KEYS: Record<FleetAssignErrorCode, MessageKey> = {
  ambulance_mission_active: "fleet.assign.error.ambulanceMission",
  driver_mission_active: "fleet.assign.error.driverMission",
  driver_not_eligible: "fleet.assign.error.notEligible",
  ambulance_already_assigned: "fleet.error.conflict",
  driver_assigned_elsewhere: "fleet.error.conflict",
  access_denied: "fleet.assign.error.access",
  migration_pending: "fleet.assign.error.migration",
  not_found: "fleet.vehicle.error.notFound",
  network: "fleet.assign.error.network",
  unexpected: "fleet.assign.error.unexpected",
};

export function fleetAssignErrorMessageKey(code: FleetAssignErrorCode): MessageKey {
  return ASSIGN_KEYS[code];
}

const ARCHIVE_KEYS: Record<FleetArchiveErrorCode, MessageKey> = {
  ambulance_mission_active: "fleet.delete.error.mission",
  access_denied: "fleet.delete.error.access",
  migration_pending: "fleet.delete.error.migration",
  not_found: "fleet.delete.error.notFound",
  network: "fleet.delete.error.network",
  unexpected: "fleet.delete.error.unexpected",
};

export function fleetArchiveErrorMessageKey(
  code: FleetArchiveErrorCode,
): MessageKey {
  return ARCHIVE_KEYS[code];
}

const RECORD_KEYS: Record<FleetRecordSaveErrorCode, MessageKey> = {
  price_required: "fleet.record.error.priceRequired",
  mileage_required: "fleet.record.error.mileageRequired",
  price_invalid: "fleet.record.error.priceInvalid",
  mileage_invalid: "fleet.record.error.mileageInvalid",
  mileage_decrease: "fleet.record.error.decrease",
  not_found: "fleet.record.error.notFound",
  access_denied: "fleet.record.error.access",
  conflict: "fleet.record.error.conflict",
  migration_pending: "fleet.record.error.migration",
  network: "fleet.record.error.network",
  unexpected: "fleet.record.error.unexpected",
};

export function fleetRecordErrorMessageKey(
  code: FleetRecordSaveErrorCode,
): MessageKey {
  return RECORD_KEYS[code];
}
