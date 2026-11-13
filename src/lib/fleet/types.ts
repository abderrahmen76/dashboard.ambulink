/**
 * Shapes returned by the `hospital_manager_*` fleet RPCs in
 * `supabase/migrations/202611100016_hospital_manager_fleet.sql`
 * (draft, NOT APPLIED). The RPC derives the hospital from the caller's
 * membership; no hospital id is ever taken from the browser.
 */

import type { MissionStatus } from "@/lib/dashboard/types";

export type FleetStoredStatus = "available" | "on_mission" | "maintenance";

/** Exclusive state shown in the registry and counted by the KPIs. */
export type FleetVehicleState =
  | "available"
  | "on_mission"
  | "maintenance"
  | "offline"
  | "unassigned";

/** Filter values exposed by the toolbar. `assigned` means "has a driver". */
export type FleetFilter =
  | "all"
  | "available"
  | "assigned"
  | "on_mission"
  | "maintenance"
  | "offline";

export type FleetActiveMission = {
  id: string;
  status: MissionStatus;
  pickup_label: string | null;
  pickup_lat: number | null;
  pickup_lng: number | null;
  destination_label: string | null;
  destination_lat: number | null;
  destination_lng: number | null;
  created_at: string;
  accepted_at: string | null;
};

export type FleetAmbulance = {
  id: string;
  label: string | null;
  plate_number: string | null;
  status: FleetStoredStatus | string;
  mileage: number | null;
  created_at: string | null;
  driver_id: string | null;
  driver_name: string | null;
  /** Canonical `profiles.phone` (216XXXXXXXX); only emitted to the manager. */
  driver_phone?: string | null;
  driver_availability: boolean | null;
  driver_lat: number | null;
  driver_lng: number | null;
  location_updated_at: string | null;
  active_mission: FleetActiveMission | null;
};

export type FleetDriver = {
  id: string;
  full_name: string | null;
  availability: boolean | null;
  current_lat: number | null;
  current_lng: number | null;
  location_updated_at: string | null;
  ambulance_id: string | null;
  ambulance_label: string | null;
  active_mission_id: string | null;
};

export type FleetHospital = {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  patient_dispatch_enabled: boolean;
};

export type FleetSnapshot = {
  server_now: string;
  hospital: FleetHospital;
  ambulances: FleetAmbulance[];
  drivers: FleetDriver[];
};

/** One row of `hospital_manager_ambulance_records` (202611100017, draft). */
export type FleetFuelRecord = {
  id: string;
  liters: number | null;
  total_price: number | null;
  price_per_liter: number | null;
  mileage: number | null;
  fuel_type: string | null;
  station: string | null;
  notes: string | null;
  recorded_at: string;
  recorded_by: string | null;
};

export type FleetMaintenanceRecord = {
  id: string;
  mechanic_name: string | null;
  price: number | null;
  repairs: string | null;
  mileage: number | null;
  maintenance_type: string | null;
  notes: string | null;
  next_maintenance_mileage: number | null;
  next_maintenance_on: string | null;
  performed_at: string;
  recorded_by: string | null;
};

export type FleetVehicleRecords = {
  server_now: string;
  ambulance_id: string;
  fuel: FleetFuelRecord[];
  maintenance: FleetMaintenanceRecord[];
};

/** Calendar periods resolved on the server in Africa/Tunis (202611100020, draft). */
export type FleetHistoryPeriod = "month" | "3m" | "6m" | "year" | "all";

export type FleetHistoryPageSize = 20 | 50 | 100;

export type FleetFuelHistoryStats = {
  record_count: number;
  priced_count: number;
  total_cost: number | null;
  avg_cost: number | null;
  liters_count: number;
  total_liters: number | null;
  last_recorded_at: string | null;
};

export type FleetMaintenanceHistoryStats = {
  record_count: number;
  priced_count: number;
  total_cost: number | null;
  avg_cost: number | null;
  last_performed_at: string | null;
};

type FleetHistoryPageBase = {
  server_now: string;
  ambulance_id: string;
  period: FleetHistoryPeriod;
  period_start: string | null;
  page_size: number;
  offset: number;
  total_count: number;
};

export type FleetFuelHistoryPage = FleetHistoryPageBase & {
  stats: FleetFuelHistoryStats;
  items: FleetFuelRecord[];
};

export type FleetMaintenanceHistoryPage = FleetHistoryPageBase & {
  stats: FleetMaintenanceHistoryStats;
  items: FleetMaintenanceRecord[];
};

export type FleetErrorCode =
  | "migration_pending"
  | "access_denied"
  | "not_found"
  | "conflict"
  | "network"
  | "unexpected"
  /** Client-only: a refresh failed but the last snapshot is still displayed. */
  | "stale";

export type FleetResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: FleetErrorCode };

export type SaveAmbulanceInput = {
  ambulanceId: string | null;
  label: string;
  plateNumber: string | null;
  mileage: number | null;
  status: "available" | "maintenance";
};

export type FleetSaveErrorCode =
  | "label_required"
  | "mileage_invalid"
  | "status_invalid"
  | "mission_active"
  | "not_found"
  | "duplicate"
  | "access_denied"
  | "migration_pending"
  | "network"
  | "unexpected";

export type FleetSaveResult =
  | { ok: true; snapshot: FleetSnapshot; ambulanceId: string }
  | { ok: false; code: FleetSaveErrorCode };

export type FleetAssignErrorCode =
  | "ambulance_mission_active"
  | "driver_mission_active"
  | "driver_not_eligible"
  | "ambulance_already_assigned"
  | "driver_assigned_elsewhere"
  | "access_denied"
  | "migration_pending"
  | "not_found"
  | "network"
  | "unexpected";

export type FleetAssignResult =
  | { ok: true; snapshot: FleetSnapshot }
  | {
      ok: false;
      code: FleetAssignErrorCode;
      driverName?: string | null;
      ambulanceLabel?: string | null;
    };

/**
 * Inputs for `hospital_manager_create_fuel_record` / `..._maintenance_record`
 * (202611100018, draft). The hospital is never part of the input: the RPC
 * derives it from the caller's membership.
 */
export type CreateFuelRecordInput = {
  requestKey: string | null;
  ambulanceId: string;
  liters: number | null;
  totalPrice: number;
  pricePerLiter: number | null;
  mileage: number;
  fuelType: string | null;
  station: string | null;
  notes: string | null;
  recordedAt: string | null;
};

export type CreateMaintenanceRecordInput = {
  requestKey: string | null;
  ambulanceId: string;
  mechanicName: string | null;
  price: number;
  repairs: string | null;
  mileage: number;
  maintenanceType: string | null;
  notes: string | null;
  nextMaintenanceMileage: number | null;
  nextMaintenanceOn: string | null;
  performedAt: string | null;
};

export type FleetRecordSaveErrorCode =
  | "price_required"
  | "mileage_required"
  | "price_invalid"
  | "mileage_invalid"
  | "mileage_decrease"
  | "not_found"
  | "access_denied"
  | "conflict"
  | "migration_pending"
  | "network"
  | "unexpected";

export type FleetRecordSaveResult =
  | { ok: true }
  | { ok: false; code: FleetRecordSaveErrorCode };
