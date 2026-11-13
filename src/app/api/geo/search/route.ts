import { NextResponse } from "next/server";

import { searchPlaces } from "@/lib/geo/providers";
import { parseLanguage, requireSession } from "@/lib/geo/server";

export async function GET(request: Request) {
  const denied = await requireSession();
  if (denied) return denied;

  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim();
  if (query.length < 3 || query.length > 120) {
    return NextResponse.json({ error: "invalid_query" }, { status: 400 });
  }

  try {
    const results = await searchPlaces(query, parseLanguage(url.searchParams.get("lang")));
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ error: "provider_unavailable" }, { status: 502 });
  }
}
