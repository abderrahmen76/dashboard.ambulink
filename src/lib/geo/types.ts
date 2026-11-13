export type GeoPoint = { lat: number; lng: number };

export type PlaceSuggestion = {
  id: string;
  label: string;
  detail: string | null;
  lat: number;
  lng: number;
};

export type RoadRoute = {
  /** [lat, lng] pairs, already validated. Never a straight-line fallback. */
  points: Array<[number, number]>;
  distanceMeters: number;
  durationSeconds: number;
};

export type LocalizedLanguage = "en" | "fr" | "ar";

export function isGeoPoint(value: unknown): value is GeoPoint {
  if (!value || typeof value !== "object") return false;
  const point = value as GeoPoint;
  return (
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    point.lat >= -90 &&
    point.lat <= 90 &&
    point.lng >= -180 &&
    point.lng <= 180
  );
}

export function formatCoordinateLabel(point: GeoPoint): string {
  return `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
}

/** Mirrors the Flutter helper: legacy labels sometimes contain only numbers. */
export function labelLooksLikeRawCoordinates(label: string | null | undefined): boolean {
  const value = label?.trim();
  if (!value) return true;
  if (/-?\d{1,3}\.\d{3,}\s*[,;]\s*-?\d{1,3}\.\d{3,}/.test(value)) return true;
  return [
    "Position GPS",
    "Point sélectionné sur la carte",
    "Dernière position connue",
  ].some((prefix) => value.startsWith(prefix));
}
