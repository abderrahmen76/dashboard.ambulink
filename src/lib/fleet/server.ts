import { createSupabaseServerClient } from "@/lib/supabase/server";

import { fetchFleetSnapshot } from "./service";
import type { FleetResult, FleetSnapshot } from "./types";

/**
 * First consistent snapshot for the initial render. The RPC authorizes the
 * caller and derives the hospital itself, so nothing hospital-scoped is read
 * from a client-supplied id.
 */
export async function loadFleetSnapshot(): Promise<FleetResult<FleetSnapshot>> {
  try {
    const supabase = await createSupabaseServerClient();
    return await fetchFleetSnapshot(supabase);
  } catch {
    return { ok: false, code: "network" };
  }
}
