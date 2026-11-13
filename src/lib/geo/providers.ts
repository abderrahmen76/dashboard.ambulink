import "server-only";

import type { GeoPoint, LocalizedLanguage, PlaceSuggestion, RoadRoute } from "./types";

const DEFAULT_GEOCODING_BASE_URL = "https://nominatim.openstreetmap.org";
const DEFAULT_ROUTING_BASE_URL = "https://router.project-osrm.org";
const NOMINATIM_GAP_MS = 1100;
const REQUEST_TIMEOUT_MS = 9_000;
const ROUTE_TIMEOUT_MS = 12_000;
const MAX_CACHE_ENTRIES = 256;
const SEARCH_TTL_MS = 5 * 60_000;
const REVERSE_TTL_MS = 20 * 60_000;
const ROUTE_TTL_MS = 2 * 60_000;
const COORDINATE_DECIMALS = 4;

type CacheEntry<T> = { value: T; storedAt: number };

const searchCache = new Map<string, CacheEntry<PlaceSuggestion[]>>();
const reverseCache = new Map<string, CacheEntry<string | null>>();
const routeCache = new Map<string, CacheEntry<RoadRoute>>();

let nominatimChain: Promise<unknown> = Promise.resolve();
let lastNominatimRequestAt = 0;

function baseUrl(name: "geocoding" | "routing"): string | null {
  const configured =
    name === "geocoding"
      ? process.env.AMBULINK_GEOCODING_BASE_URL
      : process.env.AMBULINK_ROUTING_BASE_URL;
  const raw = (configured ?? (name === "geocoding" ? DEFAULT_GEOCODING_BASE_URL : DEFAULT_ROUTING_BASE_URL)).trim();
  const parsed = (() => {
    try {
      return new URL(raw);
    } catch {
      return null;
    }
  })();
  if (!parsed || parsed.protocol !== "https:" || !parsed.host) return null;
  return `${parsed.origin}${parsed.pathname.replace(/\/$/, "")}`;
}

function userAgent(): string {
  return process.env.AMBULINK_GEOCODING_USER_AGENT?.trim() || "AmbuLinkClinic/1.0";
}

function remember<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T) {
  cache.set(key, { value, storedAt: Date.now() });
  if (cache.size > MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
}

function read<T>(cache: Map<string, CacheEntry<T>>, key: string, ttl: number): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.storedAt > ttl) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
}

function coordinateKey(point: GeoPoint): string {
  return `${point.lat.toFixed(COORDINATE_DECIMALS)},${point.lng.toFixed(COORDINATE_DECIMALS)}`;
}

/** Serialized to respect Nominatim's one-request-per-second policy. */
function nominatimFetch(url: URL): Promise<Response> {
  const run = nominatimChain.then(async () => {
    const wait = NOMINATIM_GAP_MS - (Date.now() - lastNominatimRequestAt);
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastNominatimRequestAt = Date.now();
    return fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": userAgent(),
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  });
  nominatimChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function trimmedParts(displayName: unknown): string[] {
  if (typeof displayName !== "string") return [];
  return displayName
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function toCoordinate(value: unknown): number | null {
  const parsed = typeof value === "string" ? Number.parseFloat(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : null;
}

export async function searchPlaces(
  query: string,
  language: LocalizedLanguage,
): Promise<PlaceSuggestion[]> {
  const normalized = query.trim();
  const cacheKey = `${language}|${normalized.toLocaleLowerCase()}`;
  const cached = read(searchCache, cacheKey, SEARCH_TTL_MS);
  if (cached) return cached;

  const base = baseUrl("geocoding");
  if (!base) throw new Error("geocoding_not_configured");

  const url = new URL(`${base}/search`);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("q", normalized);
  url.searchParams.set("limit", "6");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", language);

  const response = await nominatimFetch(url);
  if (!response.ok) throw new Error(`geocoding_http_${response.status}`);

  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) throw new Error("geocoding_response_invalid");

  const suggestions: PlaceSuggestion[] = [];
  for (const row of payload) {
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    const lat = toCoordinate(record.lat);
    const lng = toCoordinate(record.lon);
    const parts = trimmedParts(record.display_name);
    if (lat === null || lng === null || !parts.length) continue;
    const label = parts[0];
    const detail = parts.slice(1, 4).join(", ") || null;
    suggestions.push({
      id: String(record.place_id ?? `${label}-${lat}-${lng}`),
      label,
      detail,
      lat,
      lng,
    });
  }

  remember(searchCache, cacheKey, suggestions);
  return suggestions;
}

export async function reversePlace(
  point: GeoPoint,
  language: LocalizedLanguage,
): Promise<string | null> {
  const cacheKey = `${coordinateKey(point)}|${language}`;
  const cached = read(reverseCache, cacheKey, REVERSE_TTL_MS);
  if (cached !== undefined) return cached;

  const base = baseUrl("geocoding");
  if (!base) throw new Error("geocoding_not_configured");

  const url = new URL(`${base}/reverse`);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", point.lat.toFixed(COORDINATE_DECIMALS));
  url.searchParams.set("lon", point.lng.toFixed(COORDINATE_DECIMALS));
  url.searchParams.set("zoom", "16");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", language);

  const response = await nominatimFetch(url);
  if (!response.ok) throw new Error(`geocoding_http_${response.status}`);

  const payload: unknown = await response.json();
  if (!payload || typeof payload !== "object") throw new Error("geocoding_response_invalid");
  const parts = trimmedParts((payload as Record<string, unknown>).display_name);
  const label = parts.length ? parts.slice(0, 3).join(", ") : null;

  remember(reverseCache, cacheKey, label);
  return label;
}

type OsrmRoute = {
  distance?: unknown;
  duration?: unknown;
  geometry?: { coordinates?: unknown };
};

function validPoint(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function parseRoute(row: OsrmRoute): RoadRoute | null {
  const coordinates = row.geometry?.coordinates;
  if (!Array.isArray(coordinates)) return null;
  if (typeof row.distance !== "number" || typeof row.duration !== "number") return null;
  if (!Number.isFinite(row.distance) || !Number.isFinite(row.duration) || row.distance <= 0) {
    return null;
  }
  const points: Array<[number, number]> = [];
  for (const coordinate of coordinates) {
    if (!Array.isArray(coordinate) || coordinate.length < 2) return null;
    const lng = coordinate[0];
    const lat = coordinate[1];
    if (!validPoint(lat, lng)) return null;
    points.push([lat as number, lng as number]);
  }
  if (points.length < 2) return null;
  return {
    points,
    distanceMeters: row.distance,
    durationSeconds: row.duration,
  };
}

export async function fetchDrivingRoute(
  origin: GeoPoint,
  destination: GeoPoint,
): Promise<RoadRoute> {
  const cacheKey = `${coordinateKey(origin)};${coordinateKey(destination)}`;
  const cached = read(routeCache, cacheKey, ROUTE_TTL_MS);
  if (cached) return cached;

  const base = baseUrl("routing");
  if (!base) throw new Error("routing_not_configured");

  const url = new URL(
    `${base}/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}`,
  );
  url.searchParams.set("alternatives", "3");
  url.searchParams.set("overview", "full");
  url.searchParams.set("geometries", "geojson");
  url.searchParams.set("steps", "false");

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(ROUTE_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`routing_http_${response.status}`);

  const payload: unknown = await response.json();
  if (!payload || typeof payload !== "object" || (payload as { code?: unknown }).code !== "Ok") {
    throw new Error("route_not_found");
  }
  const routes = (payload as { routes?: unknown }).routes;
  if (!Array.isArray(routes)) throw new Error("route_response_invalid");

  let shortest: RoadRoute | null = null;
  for (const candidate of routes) {
    if (!candidate || typeof candidate !== "object") continue;
    const parsed = parseRoute(candidate as OsrmRoute);
    if (!parsed) continue;
    if (!shortest || parsed.distanceMeters < shortest.distanceMeters) shortest = parsed;
  }
  if (!shortest) throw new Error("route_geometry_unavailable");

  remember(routeCache, cacheKey, shortest);
  return shortest;
}
