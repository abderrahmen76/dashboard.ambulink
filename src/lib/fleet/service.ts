import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  CreateFuelRecordInput,
  CreateMaintenanceRecordInput,
  FleetAssignErrorCode,
  FleetAssignResult,
  FleetErrorCode,
  FleetFuelHistoryPage,
  FleetHistoryPageSize,
  FleetHistoryPeriod,
  FleetMaintenanceHistoryPage,
  FleetRecordSaveErrorCode,
  FleetRecordSaveResult,
  FleetResult,
  FleetSaveResult,
  FleetSnapshot,
  FleetVehicleRecords,
  SaveAmbulanceInput,
} from "./types";

type RpcError = { code?: string | null; message?: string | null } | null;

const MIGRATION_CODES = new Set(["42883", "42P01", "42703", "PGRST202"]);

function normalizeMessage(error: RpcError): string {
  return (error?.message ?? "").toLowerCase();
}

export function mapFleetError(error: RpcError): FleetErrorCode {
  if (!error) return "unexpected";
  const message = normalizeMessage(error);
  if (
    message.includes("hospital_management_access_required") ||
    message.includes("hospital_manager_auth_required")
  ) {
    return "access_denied";
  }
  if (message.includes("ambulance_not_found")) return "not_found";
  if (MIGRATION_CODES.has(error.code ?? "")) return "migration_pending";
  if (error.code === "42501") return "access_denied";
  if (error.code === "P0002") return "not_found";
  if (error.code === "23505") return "conflict";
  if (error.code === undefined || error.code === null || error.code === "") return "network";
  return "unexpected";
}

export async function fetchFleetSnapshot(
  supabase: SupabaseClient,
): Promise<FleetResult<FleetSnapshot>> {
  const { data, error } = await supabase.rpc("hospital_manager_fleet_snapshot");
  if (error) return { ok: false, code: mapFleetError(error) };
  if (!data) return { ok: false, code: "unexpected" };
  return { ok: true, data: data as FleetSnapshot };
}

/**
 * Fuel and maintenance history of one hospital vehicle. The RPC derives the
 * hospital from the caller's membership and rejects any other vehicle, so the
 * browser never supplies a hospital scope.
 */
export async function fetchAmbulanceRecords(
  supabase: SupabaseClient,
  ambulanceId: string,
): Promise<FleetResult<FleetVehicleRecords>> {
  const { data, error } = await supabase.rpc("hospital_manager_ambulance_records", {
    p_ambulance_id: ambulanceId,
  });
  if (error) return { ok: false, code: mapFleetError(error) };
  if (!data) return { ok: false, code: "unexpected" };
  return { ok: true, data: data as FleetVehicleRecords };
}

/**
 * Paged fuel history with period aggregates (`202611100020`, draft). The RPC
 * derives the hospital from the caller's membership, returns only the requested
 * page and computes the totals in SQL, so no full history reaches the browser.
 */
export async function fetchFuelHistory(
  supabase: SupabaseClient,
  ambulanceId: string,
  period: FleetHistoryPeriod,
  pageSize: FleetHistoryPageSize,
  offset: number,
): Promise<FleetResult<FleetFuelHistoryPage>> {
  const { data, error } = await supabase.rpc("hospital_manager_fuel_history", {
    p_ambulance_id: ambulanceId,
    p_period: period,
    p_page_size: pageSize,
    p_offset: offset,
  });
  if (error) return { ok: false, code: mapFleetError(error) };
  const page = data as FleetFuelHistoryPage | null;
  if (!page || typeof page.total_count !== "number" || !Array.isArray(page.items)) {
    return { ok: false, code: "unexpected" };
  }
  return { ok: true, data: page };
}

export async function fetchMaintenanceHistory(
  supabase: SupabaseClient,
  ambulanceId: string,
  period: FleetHistoryPeriod,
  pageSize: FleetHistoryPageSize,
  offset: number,
): Promise<FleetResult<FleetMaintenanceHistoryPage>> {
  const { data, error } = await supabase.rpc(
    "hospital_manager_maintenance_history",
    {
      p_ambulance_id: ambulanceId,
      p_period: period,
      p_page_size: pageSize,
      p_offset: offset,
    },
  );
  if (error) return { ok: false, code: mapFleetError(error) };
  const page = data as FleetMaintenanceHistoryPage | null;
  if (!page || typeof page.total_count !== "number" || !Array.isArray(page.items)) {
    return { ok: false, code: "unexpected" };
  }
  return { ok: true, data: page };
}

/**
 * Manager-entered fuel/maintenance rows. Both RPCs re-derive the hospital from
 * the caller's membership and reject any vehicle of another hospital, so the
 * browser only supplies the selected ambulance id.
 */
function mapRecordError(error: RpcError): FleetRecordSaveErrorCode {
  if (!error) return "unexpected";
  const message = normalizeMessage(error);

  if (
    message.includes("fuel_total_price_required") ||
    message.includes("maintenance_price_required")
  ) {
    return "price_required";
  }
  if (
    message.includes("fuel_mileage_required") ||
    message.includes("maintenance_mileage_required")
  ) {
    return "mileage_required";
  }
  if (
    message.includes("fuel_total_price_invalid") ||
    message.includes("fuel_price_per_liter_invalid") ||
    message.includes("fuel_liters_invalid") ||
    message.includes("maintenance_price_invalid") ||
    message.includes("maintenance_next_mileage_invalid")
  ) {
    return "price_invalid";
  }
  if (
    message.includes("fuel_mileage_invalid") ||
    message.includes("maintenance_mileage_invalid")
  ) {
    return "mileage_invalid";
  }
  if (message.includes("ambulance_mileage_decrease")) return "mileage_decrease";
  if (message.includes("ambulance_not_found")) return "not_found";
  if (
    message.includes("hospital_management_access_required") ||
    message.includes("hospital_manager_auth_required")
  ) {
    return "access_denied";
  }
  if (
    message.includes("request_key_conflict") ||
    (!MIGRATION_CODES.has(error.code ?? "") && error.code === "23505")
  ) {
    return "conflict";
  }
  if (MIGRATION_CODES.has(error.code ?? "")) return "migration_pending";
  if (error.code === "42501") return "access_denied";
  if (error.code === "P0002") return "not_found";
  if (error.code === "22023" || error.code === "23514") return "unexpected";
  if (error.code === undefined || error.code === null || error.code === "") {
    return "network";
  }
  return "unexpected";
}

export async function createFleetFuelRecord(
  supabase: SupabaseClient,
  input: CreateFuelRecordInput,
): Promise<FleetRecordSaveResult> {
  const { error } = await supabase.rpc("hospital_manager_create_fuel_record", {
    p_request_key: input.requestKey,
    p_ambulance_id: input.ambulanceId,
    p_liters: input.liters,
    p_total_price: input.totalPrice,
    p_price_per_liter: input.pricePerLiter,
    p_mileage: input.mileage,
    p_fuel_type: input.fuelType,
    p_station: input.station,
    p_notes: input.notes,
    p_recorded_at: input.recordedAt,
  });

  if (error) return { ok: false, code: mapRecordError(error) };
  return { ok: true };
}

export async function createFleetMaintenanceRecord(
  supabase: SupabaseClient,
  input: CreateMaintenanceRecordInput,
): Promise<FleetRecordSaveResult> {
  const { error } = await supabase.rpc(
    "hospital_manager_create_maintenance_record",
    {
      p_request_key: input.requestKey,
      p_ambulance_id: input.ambulanceId,
      p_mechanic_name: input.mechanicName,
      p_price: input.price,
      p_repairs: input.repairs,
      p_mileage: input.mileage,
      p_maintenance_type: input.maintenanceType,
      p_notes: input.notes,
      p_next_maintenance_mileage: input.nextMaintenanceMileage,
      p_next_maintenance_on: input.nextMaintenanceOn,
      p_performed_at: input.performedAt,
    },
  );

  if (error) return { ok: false, code: mapRecordError(error) };
  return { ok: true };
}

type RawSaveResponse = {
  ok?: boolean;
  ambulance_id?: string;
  snapshot?: FleetSnapshot;
};

export async function saveHospitalAmbulance(
  supabase: SupabaseClient,
  input: SaveAmbulanceInput,
): Promise<FleetSaveResult> {
  const { data, error } = await supabase.rpc("hospital_manager_save_ambulance", {
    p_ambulance_id: input.ambulanceId,
    p_label: input.label,
    p_plate_number: input.plateNumber,
    p_mileage: input.mileage,
    p_status: input.status,
  });

  if (error) {
    const message = normalizeMessage(error);
    if (message.includes("ambulance_label_required")) return { ok: false, code: "label_required" };
    if (message.includes("ambulance_mileage_invalid")) return { ok: false, code: "mileage_invalid" };
    if (message.includes("ambulance_status_invalid")) return { ok: false, code: "status_invalid" };
    if (message.includes("ambulance_mission_active")) return { ok: false, code: "mission_active" };
    if (message.includes("ambulance_not_found")) return { ok: false, code: "not_found" };
    if (message.includes("duplicate key")) return { ok: false, code: "duplicate" };
    if (error.code === "23505") return { ok: false, code: "duplicate" };
    const code = mapFleetError(error);
    if (code === "conflict") return { ok: false, code: "duplicate" };
    if (
      code === "migration_pending" ||
      code === "access_denied" ||
      code === "not_found" ||
      code === "network"
    ) {
      return { ok: false, code };
    }
    return { ok: false, code: "unexpected" };
  }

  const response = data as RawSaveResponse | null;
  if (response?.ok && response.snapshot && response.ambulance_id) {
    return { ok: true, snapshot: response.snapshot, ambulanceId: response.ambulance_id };
  }
  return { ok: false, code: "unexpected" };
}

type RawAssignResponse = {
  ok?: boolean;
  code?: string;
  snapshot?: FleetSnapshot;
  driver_name?: string | null;
  ambulance_label?: string | null;
};

const ASSIGN_CODES = new Set([
  "ambulance_mission_active",
  "driver_mission_active",
  "driver_not_eligible",
  "ambulance_already_assigned",
  "driver_assigned_elsewhere",
]);

export async function assignHospitalAmbulanceDriver(
  supabase: SupabaseClient,
  ambulanceId: string,
  driverId: string | null,
  confirmReplace: boolean,
): Promise<FleetAssignResult> {
  const { data, error } = await supabase.rpc("hospital_manager_assign_ambulance_driver", {
    p_ambulance_id: ambulanceId,
    p_driver_id: driverId,
    p_confirm_replace: confirmReplace,
  });

  if (error) {
    const code = mapFleetError(error);
    const mapped =
      code === "not_found"
        ? "not_found"
        : code === "access_denied"
          ? "access_denied"
          : code === "migration_pending"
            ? "migration_pending"
            : code === "network"
              ? "network"
              : "unexpected";
    return { ok: false, code: mapped };
  }

  const response = data as RawAssignResponse | null;
  if (!response) return { ok: false, code: "unexpected" };

  if (response.ok && response.snapshot) {
    return { ok: true, snapshot: response.snapshot };
  }

  if (response.code && ASSIGN_CODES.has(response.code)) {
    return {
      ok: false,
      code: response.code as FleetAssignErrorCode,
      driverName: response.driver_name ?? null,
      ambulanceLabel: response.ambulance_label ?? null,
    };
  }

  return { ok: false, code: "unexpected" };
}
