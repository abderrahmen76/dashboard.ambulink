"use client";

import type {
  GeoPoint,
  LocalizedLanguage,
  PlaceSuggestion,
  RoadRoute,
} from "./types";

type CacheEntry<T> = { value: T; storedAt: number };

const SEARCH_TTL_MS = 5 * 60_000;
const REVERSE_TTL_MS = 20 * 60_000;
const ROUTE_TTL_MS = 2 * 60_000;
const MAX_ENTRIES = 120;

const searchCache = new Map<string, CacheEntry<PlaceSuggestion[]>>();
const reverseCache = new Map<string, CacheEntry<string | null>>();
const routeCache = new Map<string, CacheEntry<RoadRoute>>();

function read<T>(cache: Map<string, CacheEntry<T>>, key: string, ttl: number) {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.storedAt > ttl) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
}

function write<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T) {
  cache.set(key, { value, storedAt: Date.now() });
  if (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
}

function pointKey(point: GeoPoint) {
  return `${point.lat.toFixed(4)},${point.lng.toFixed(4)}`;
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`http_${response.status}`);
  return (await response.json()) as T;
}

export async function searchPlaces(
  query: string,
  language: LocalizedLanguage,
  signal?: AbortSignal,
): Promise<PlaceSuggestion[]> {
  const cacheKey = `${language}|${query.trim().toLocaleLowerCase()}`;
  const cached = read(searchCache, cacheKey, SEARCH_TTL_MS);
  if (cached) return cached;

  const params = new URLSearchParams({ q: query.trim(), lang: language });
  const payload = await getJson<{ results?: PlaceSuggestion[] }>(
    `/api/geo/search?${params.toString()}`,
    signal,
  );
  const results = Array.isArray(payload.results) ? payload.results : [];
  write(searchCache, cacheKey, results);
  return results;
}

export async function reversePlaceLabel(
  point: GeoPoint,
  language: LocalizedLanguage,
  signal?: AbortSignal,
): Promise<string | null> {
  const cacheKey = `${pointKey(point)}|${language}`;
  const cached = read(reverseCache, cacheKey, REVERSE_TTL_MS);
  if (cached !== undefined) return cached;

  const params = new URLSearchParams({
    lat: point.lat.toFixed(5),
    lng: point.lng.toFixed(5),
    lang: language,
  });
  const payload = await getJson<{ label?: string | null }>(
    `/api/geo/reverse?${params.toString()}`,
    signal,
  );
  const label = typeof payload.label === "string" && payload.label.trim() ? payload.label : null;
  write(reverseCache, cacheKey, label);
  return label;
}

export async function fetchRoadRoute(
  origin: GeoPoint,
  destination: GeoPoint,
  signal?: AbortSignal,
): Promise<RoadRoute> {
  const cacheKey = `${pointKey(origin)};${pointKey(destination)}`;
  const cached = read(routeCache, cacheKey, ROUTE_TTL_MS);
  if (cached) return cached;

  const params = new URLSearchParams({
    from: `${origin.lat},${origin.lng}`,
    to: `${destination.lat},${destination.lng}`,
  });
  const payload = await getJson<{ route?: RoadRoute }>(
    `/api/route?${params.toString()}`,
    signal,
  );
  if (!payload.route || !Array.isArray(payload.route.points)) {
    throw new Error("route_missing");
  }
  write(routeCache, cacheKey, payload.route);
  return payload.route;
}

export type HospitalChoice = {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
};

export async function fetchHospitalChoices(signal?: AbortSignal): Promise<HospitalChoice[]> {
  const payload = await getJson<{ hospitals?: HospitalChoice[] }>("/api/hospitals", signal);
  return Array.isArray(payload.hospitals) ? payload.hospitals : [];
}
