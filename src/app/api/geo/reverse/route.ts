import { NextResponse } from "next/server";

import { reversePlace } from "@/lib/geo/providers";
import {
  parseCoordinate,
  parseLanguage,
  requireSession,
  validPoint,
} from "@/lib/geo/server";

export async function GET(request: Request) {
  const denied = await requireSession();
  if (denied) return denied;

  const url = new URL(request.url);
  const lat = parseCoordinate(url.searchParams.get("lat"));
  const lng = parseCoordinate(url.searchParams.get("lng"));
  if (!validPoint(lat, lng)) {
    return NextResponse.json({ error: "invalid_coordinates" }, { status: 400 });
  }

  try {
    const label = await reversePlace(
      { lat: lat as number, lng: lng as number },
      parseLanguage(url.searchParams.get("lang")),
    );
    return NextResponse.json({ label });
  } catch {
    return NextResponse.json({ error: "provider_unavailable" }, { status: 502 });
  }
}
