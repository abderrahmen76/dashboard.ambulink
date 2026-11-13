import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type HospitalOption = {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
};

/**
 * Authorized by the existing `hospitals_select_authenticated` policy, so the
 * manager only receives rows the backend already allows this session to read.
 * Coordinate columns may be absent on an older schema; the caller then keeps
 * the hospital from its own dashboard snapshot.
 */
export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("hospitals")
      .select("id, name, latitude, longitude")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) {
      return NextResponse.json(
        {
          error:
            error.code === "42703" ? "coordinates_not_configured" : "unavailable",
        },
        { status: 502 },
      );
    }

    const hospitals: HospitalOption[] = (data ?? []).map((row) => ({
      id: row.id as string,
      name: row.name as string,
      latitude: typeof row.latitude === "number" ? row.latitude : null,
      longitude: typeof row.longitude === "number" ? row.longitude : null,
    }));

    return NextResponse.json({ hospitals });
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
}
