import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export function parseLanguage(value: string | null): "en" | "fr" | "ar" {
  return value === "fr" || value === "ar" ? value : "en";
}

export function parseCoordinate(value: string | null): number | null {
  if (value === null) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function validPoint(lat: number | null, lng: number | null): boolean {
  return (
    lat !== null &&
    lng !== null &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/**
 * The helpers are public OpenStreetMap services, but the app is a private
 * hospital workspace: require the manager session before acting as a proxy.
 */
export async function requireSession(): Promise<NextResponse | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    return null;
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
}
