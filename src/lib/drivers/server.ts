import { createSupabaseServerClient } from "@/lib/supabase/server";

import { fetchDriversPage } from "./service";
import type { DriverResult, DriversPage } from "./types";
import type { DriversQuery } from "./use-drivers";

export const DEFAULT_DRIVERS_QUERY: DriversQuery = {
  search: "",
  status: "all",
  assignment: "all",
};

/**
 * First page for the initial render: no search, no filter, 20 rows. The RPC
 * authorizes the caller and derives the hospital itself, so nothing
 * hospital-scoped is read from a client-supplied id.
 */
export async function loadDriversPage(): Promise<DriverResult<DriversPage>> {
  try {
    const supabase = await createSupabaseServerClient();
    return await fetchDriversPage(supabase, "", "all", "all", 20, 0);
  } catch {
    return { ok: false, code: "network" };
  }
}
