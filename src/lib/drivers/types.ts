/**
 * Shapes returned by the `hospital_manager_*` driver RPCs in
 * `supabase/migrations/202611100021_hospital_manager_drivers.sql`
 * (draft, NOT APPLIED). The RPC derives the hospital from the caller's
 * membership; no hospital id is ever taken from the browser.
 */

import type { MissionStatus } from "@/lib/dashboard/types";

/** Exclusive state derived by the RPC from availability and the active mission. */
export type DriverOperationalStatus = "available" | "on_mission" | "offline";

export type DriverStatusFilter =
  | "all"
  | "on_duty"
  | "available"
  | "on_mission"
  | "offline";

/** `assigned` means "has an ambulance", never "mission-eligible". */
export type DriverAssignmentFilter = "all" | "assigned" | "unassigned";

export type DriverPageSize = 20 | 50 | 100;

export type DriversKpis = {
  total: number;
  online: number;
  available: number;
  on_mission: number;
};

export type DriverAmbulance = {
  id: string;
  label: string | null;
  plate_number: string | null;
  status: string;
  mileage: number | null;
  created_at: string | null;
};

export type DriverActiveMission = {
  id: string;
  status: MissionStatus;
  pickup_label: string | null;
  destination_label: string | null;
  created_at: string;
  accepted_at: string | null;
};

export type DriverRow = {
  id: string;
  full_name: string | null;
  /** Canonical `profiles.phone` (216XXXXXXXX); manager-scoped only. */
  phone: string | null;
  status: DriverOperationalStatus;
  availability: boolean | null;
  location_updated_at: string | null;
  ambulance: DriverAmbulance | null;
  active_mission: DriverActiveMission | null;
};

/** One hospital vehicle, for the reassignment dialog. */
export type DriverAmbulanceOption = {
  id: string;
  label: string | null;
  plate_number: string | null;
  driver_id: string | null;
  driver_name: string | null;
  on_mission: boolean;
};

export type DriversPage = {
  server_now: string;
  hospital: { id: string; name: string };
  kpis: DriversKpis;
  total_count: number;
  page_size: number;
  offset: number;
  items: DriverRow[];
  ambulances: DriverAmbulanceOption[];
};

/** Real mission history of the selected driver (hospital-scoped). */
export type DriverStats = {
  server_now: string;
  driver_id: string;
  assigned_count: number;
  completed_count: number;
  cancelled_count: number;
  first_assigned_at: string | null;
  last_completed_at: string | null;
  avg_accept_seconds: number | null;
};

export type DriverErrorCode =
  | "migration_pending"
  | "access_denied"
  | "not_found"
  | "network"
  | "unexpected"
  /** Client-only: a refresh failed but the last page is still displayed. */
  | "stale";

export type DriverResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: DriverErrorCode };

/** Result of the manager → Edge Function driver provisioning call. */
export type CreateHospitalDriverErrorCode =
  | "validation_name"
  | "validation_phone"
  | "validation_passwordLength"
  | "validation_passwordMismatch"
  | "validation_phoneOwnership"
  | "phone_already_registered"
  | "phone_provider_disabled"
  | "not_authorized"
  | "hospital_not_found"
  | "session_expired"
  | "service_unavailable"
  | "provisioning_failed"
  | "network"
  | "unexpected";

export type CreateHospitalDriverResult =
  | { ok: true; userId: string }
  | { ok: false; code: CreateHospitalDriverErrorCode };
