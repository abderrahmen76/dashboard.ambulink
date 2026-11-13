import type { MessageKey } from "@/lib/i18n/dictionaries";

import type { CreateHospitalDriverErrorCode, DriverErrorCode } from "./types";

const ERROR_KEYS: Record<DriverErrorCode, MessageKey> = {
  migration_pending: "drivers.error.migration",
  access_denied: "drivers.error.access",
  not_found: "drivers.error.notFound",
  network: "drivers.error.network",
  unexpected: "drivers.error.unexpected",
  stale: "drivers.error.stale",
};

const CREATE_ERROR_KEYS: Record<CreateHospitalDriverErrorCode, MessageKey> = {
  validation_name: "drivers.create.error.name",
  validation_phone: "drivers.create.error.phone",
  validation_passwordLength: "drivers.create.error.passwordLength",
  validation_passwordMismatch: "drivers.create.error.passwordMismatch",
  validation_phoneOwnership: "drivers.create.error.phoneOwnership",
  phone_already_registered: "drivers.create.error.duplicate",
  phone_provider_disabled: "drivers.create.error.phoneDisabled",
  not_authorized: "drivers.create.error.access",
  hospital_not_found: "drivers.create.error.hospital",
  session_expired: "drivers.create.error.session",
  service_unavailable: "drivers.create.error.service",
  provisioning_failed: "drivers.create.error.provisioning",
  network: "drivers.create.error.network",
  unexpected: "drivers.create.error.unexpected",
};

export function driverErrorMessageKey(code: DriverErrorCode): MessageKey {
  return ERROR_KEYS[code];
}

export function driverCreateErrorMessageKey(
  code: CreateHospitalDriverErrorCode,
): MessageKey {
  return CREATE_ERROR_KEYS[code];
}
