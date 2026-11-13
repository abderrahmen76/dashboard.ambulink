import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  DriverAssignmentFilter,
  DriverDeleteResult,
  DriverErrorCode,
  DriverPageSize,
  DriverResult,
  DriverStats,
  DriverStatusFilter,
  DriversPage,
} from "./types";

type RpcError = { code?: string | null; message?: string | null } | null;

const MIGRATION_CODES = new Set(["42883", "42P01", "42703", "PGRST202"]);

export function mapDriverError(error: RpcError): DriverErrorCode {
  if (!error) return "unexpected";
  const message = (error.message ?? "").toLowerCase();

  if (
    message.includes("hospital_management_access_required") ||
    message.includes("hospital_manager_auth_required")
  ) {
    return "access_denied";
  }
  if (message.includes("driver_not_found")) return "not_found";
  if (MIGRATION_CODES.has(error.code ?? "")) return "migration_pending";
  if (error.code === "42501") return "access_denied";
  if (error.code === "P0002") return "not_found";
  if (error.code === undefined || error.code === null || error.code === "") {
    return "network";
  }
  return "unexpected";
}

/**
 * One page of the hospital driver registry. Search, filters, the page and the
 * hospital-wide KPI counts are resolved in SQL; the browser only supplies the
 * query and the offset.
 */
export async function fetchDriversPage(
  supabase: SupabaseClient,
  search: string,
  status: DriverStatusFilter,
  assignment: DriverAssignmentFilter,
  pageSize: DriverPageSize,
  offset: number,
): Promise<DriverResult<DriversPage>> {
  const { data, error } = await supabase.rpc("hospital_manager_drivers_page", {
    p_search: search.trim() === "" ? null : search.trim(),
    p_status: status,
    p_assignment: assignment,
    p_page_size: pageSize,
    p_offset: offset,
  });
  if (error) return { ok: false, code: mapDriverError(error) };

  const page = data as DriversPage | null;
  if (
    !page ||
    typeof page.total_count !== "number" ||
    !Array.isArray(page.items) ||
    !Array.isArray(page.ambulances) ||
    !page.hospital ||
    !page.kpis
  ) {
    return { ok: false, code: "unexpected" };
  }
  return { ok: true, data: page };
}

/**
 * Mission history for the selected driver. The RPC rejects a driver who is not
 * an active driver of the caller's hospital and only counts missions targeting
 * that hospital.
 */
export async function fetchDriverStats(
  supabase: SupabaseClient,
  driverId: string,
): Promise<DriverResult<DriverStats>> {
  const { data, error } = await supabase.rpc("hospital_manager_driver_stats", {
    p_driver_id: driverId,
  });
  if (error) return { ok: false, code: mapDriverError(error) };

  const stats = data as DriverStats | null;
  if (!stats || typeof stats.assigned_count !== "number") {
    return { ok: false, code: "unexpected" };
  }
  return { ok: true, data: stats };
}

type RawDeactivateResponse = {
  ok?: boolean;
};

/**
 * Deactivate one hospital driver ("delete" in the Clinic UI). The RPC derives
 * the hospital from the caller's membership; the browser sends only the
 * selected driver id. No auth account, profile or history row is deleted.
 */
export async function deactivateHospitalDriver(
  supabase: SupabaseClient,
  driverId: string,
): Promise<DriverDeleteResult> {
  const { data, error } = await supabase.rpc(
    "hospital_manager_deactivate_driver",
    { p_driver_id: driverId },
  );

  if (error) {
    const message = (error.message ?? "").toLowerCase();
    if (message.includes("driver_mission_active")) {
      return { ok: false, code: "driver_mission_active" };
    }
    if (message.includes("driver_not_found")) {
      return { ok: false, code: "not_found" };
    }
    const code = mapDriverError(error);
    if (
      code === "access_denied" ||
      code === "migration_pending" ||
      code === "not_found" ||
      code === "network"
    ) {
      return { ok: false, code };
    }
    return { ok: false, code: "unexpected" };
  }

  const response = data as RawDeactivateResponse | null;
  if (response?.ok) return { ok: true };
  return { ok: false, code: "unexpected" };
}
