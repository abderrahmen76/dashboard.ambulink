import { NextResponse } from "next/server";

import { fetchDrivingRoute } from "@/lib/geo/providers";
import {
  parseCoordinate,
  requireSession,
  validPoint,
} from "@/lib/geo/server";

function parsePoint(value: string | null): { lat: number; lng: number } | null {
  if (!value) return null;
  const [rawLat, rawLng] = value.split(",");
  const lat = parseCoordinate(rawLat ?? null);
  const lng = parseCoordinate(rawLng ?? null);
  if (!validPoint(lat, lng)) return null;
  return { lat: lat as number, lng: lng as number };
}

export async function GET(request: Request) {
  const denied = await requireSession();
  if (denied) return denied;

  const url = new URL(request.url);
  const origin = parsePoint(url.searchParams.get("from"));
  const destination = parsePoint(url.searchParams.get("to"));
  if (!origin || !destination) {
    return NextResponse.json({ error: "invalid_coordinates" }, { status: 400 });
  }
  if (origin.lat === destination.lat && origin.lng === destination.lng) {
    return NextResponse.json({ error: "invalid_coordinates" }, { status: 400 });
  }

  try {
    const route = await fetchDrivingRoute(origin, destination);
    return NextResponse.json({ route });
  } catch {
    return NextResponse.json({ error: "provider_unavailable" }, { status: 502 });
  }
}
