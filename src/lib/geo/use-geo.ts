"use client";

import { useEffect, useRef, useState } from "react";

import { gpsFreshness } from "@/lib/dashboard/format";
import type { DashboardDriver, DashboardMission } from "@/lib/dashboard/types";
import { useI18n } from "@/lib/i18n/provider";

import {
  fetchHospitalChoices,
  fetchRoadRoute,
  reversePlaceLabel,
  searchPlaces,
  type HospitalChoice,
} from "./client";
import {
  labelLooksLikeRawCoordinates,
  type GeoPoint,
  type LocalizedLanguage,
  type PlaceSuggestion,
  type RoadRoute,
} from "./types";

const DRIVER_ROUTE_MIN_METERS = 25;
const DRIVER_ROUTE_MIN_INTERVAL_MS = 6_000;
const ROUTE_DEBOUNCE_MS = 700;
const ROUTE_RETRY_MS = 15_000;
const SEARCH_DEBOUNCE_MS = 350;
const MIN_SEARCH_CHARS = 3;

function distanceMeters(a: GeoPoint, b: GeoPoint): number {
  const radius = 6_371_000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Immediate stored label when it is a real place; otherwise one reverse
 * geocode per coordinate. Never blocks the details panel and never persists
 * the generated text.
 */
export function useResolvedLabel({
  label,
  point,
}: {
  label: string | null | undefined;
  point: GeoPoint | null;
}): { value: string | null; loading: boolean; failed: boolean } {
  const { locale } = useI18n();
  const meaningful = !!label?.trim() && !labelLooksLikeRawCoordinates(label);
  const key = meaningful
    ? `label|${locale}`
    : point
      ? `${point.lat.toFixed(5)},${point.lng.toFixed(5)}|${locale}`
      : "";
  const [state, setState] = useState<{ key: string; value: string | null; failed: boolean }>({
    key: "",
    value: null,
    failed: false,
  });

  useEffect(() => {
    if (!key || meaningful || !point) return;
    const controller = new AbortController();
    reversePlaceLabel(point, locale, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setState({ key, value, failed: value === null });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ key, value: null, failed: true });
      });
    return () => controller.abort();
    // The key encodes both coordinates and language.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, meaningful, locale]);

  if (meaningful) return { value: label ?? null, loading: false, failed: false };
  if (!point) return { value: null, loading: false, failed: false };
  const current = state.key === key ? state : null;
  return {
    value: current?.value ?? null,
    loading: !current,
    failed: current?.failed ?? false,
  };
}

/** Debounced provider search for the new-mission form. */
export function usePlaceSearch(
  query: string,
  language: LocalizedLanguage,
  enabled: boolean,
): { results: PlaceSuggestion[]; loading: boolean; failed: boolean; active: boolean } {
  const trimmed = query.trim();
  const key =
    enabled && trimmed.length >= MIN_SEARCH_CHARS
      ? `${language}|${trimmed.toLocaleLowerCase()}`
      : "";
  const [state, setState] = useState<{
    key: string;
    results: PlaceSuggestion[];
    failed: boolean;
  }>({ key: "", results: [], failed: false });

  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchPlaces(trimmed, language, controller.signal)
        .then((results) => {
          if (!controller.signal.aborted) setState({ key, results, failed: false });
        })
        .catch(() => {
          if (!controller.signal.aborted) setState({ key, results: [], failed: true });
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // The key encodes the normalized query and the language.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return {
    results: state.key === key ? state.results : [],
    loading: !!key && state.key !== key,
    failed: state.key === key && state.failed,
    active: !!key,
  };
}

/** Route preview for the new-mission form: pickup → destination. */
export function useRoutePreview(
  origin: GeoPoint | null,
  destination: GeoPoint | null,
): { route: RoadRoute | null; loading: boolean; failed: boolean } {
  const key =
    origin && destination
      ? `${origin.lat.toFixed(5)},${origin.lng.toFixed(5)};${destination.lat.toFixed(5)},${destination.lng.toFixed(5)}`
      : "";
  const [state, setState] = useState<{ key: string; route: RoadRoute | null; failed: boolean }>({
    key: "",
    route: null,
    failed: false,
  });

  useEffect(() => {
    if (!origin || !destination || !key) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetchRoadRoute(origin, destination, controller.signal)
        .then((route) => {
          if (!controller.signal.aborted) setState({ key, route, failed: false });
        })
        .catch(() => {
          if (!controller.signal.aborted) setState({ key, route: null, failed: true });
        });
    }, ROUTE_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return {
    route: state.key === key ? state.route : null,
    loading: !!key && state.key !== key,
    failed: state.key === key && state.failed,
  };
}

export function useHospitalChoices(): {
  hospitals: HospitalChoice[] | null;
  failed: boolean;
} {
  const [hospitals, setHospitals] = useState<HospitalChoice[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetchHospitalChoices(controller.signal)
      .then((rows) => {
        if (!controller.signal.aborted) setHospitals(rows);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, []);

  return { hospitals, failed };
}

export type MapRouteLine = {
  key: "driver" | "destination";
  tone: "driver" | "destination";
  points: GeoPoint[];
};

type MissionRouteState = {
  missionId: string;
  routes: MapRouteLine[];
  loading: boolean;
  failed: boolean;
};

type RequestRecord = {
  missionId: string;
  staticKey: string;
  driverKey: string;
  driverPoint: GeoPoint | null;
  at: number;
};

const EMPTY_ROUTE_STATE: MissionRouteState = {
  missionId: "",
  routes: [],
  loading: false,
  failed: false,
};

function toPoints(route: RoadRoute): GeoPoint[] {
  return route.points.map(([lat, lng]) => ({ lat, lng }));
}

/**
 * Road routes for the selected mission, mirroring the patient map phases:
 * accepted/en route → driver to pickup, in progress → driver to destination.
 * Pickup → destination is drawn whenever both real endpoints exist.
 * Requests are skipped below 25 m of movement and throttled to 6 s.
 */
export function useMissionRoutes({
  mission,
  driver,
  nowMs,
}: {
  mission: DashboardMission | null;
  driver: DashboardDriver | null;
  nowMs: number;
}): { routes: MapRouteLine[]; loading: boolean; failed: boolean } {
  const [state, setState] = useState<MissionRouteState>(EMPTY_ROUTE_STATE);
  const [retryTick, setRetryTick] = useState(0);
  const requestRef = useRef<RequestRecord | null>(null);
  const failedRef = useRef(false);

  const missionId = mission?.id ?? "";
  const status = mission?.status ?? "";
  const driverId = driver?.id ?? "";
  const pickup: GeoPoint | null =
    mission?.pickup_lat != null && mission.pickup_lng != null
      ? { lat: mission.pickup_lat, lng: mission.pickup_lng }
      : null;
  const destination: GeoPoint | null =
    mission?.destination_lat != null && mission.destination_lng != null
      ? { lat: mission.destination_lat, lng: mission.destination_lng }
      : null;
  const driverPoint: GeoPoint | null =
    driver?.current_lat != null && driver.current_lng != null
      ? { lat: driver.current_lat, lng: driver.current_lng }
      : null;
  const freshness = driver ? gpsFreshness(driver.location_updated_at, nowMs) : "missing";
  const driverFresh = !!driver && freshness === "live";

  const staticKey = [
    missionId,
    status,
    driverId,
    pickup ? `${pickup.lat.toFixed(4)},${pickup.lng.toFixed(4)}` : "-",
    destination ? `${destination.lat.toFixed(4)},${destination.lng.toFixed(4)}` : "-",
  ].join("|");
  const driverKey =
    driverFresh && driverPoint
      ? `${driverPoint.lat.toFixed(5)},${driverPoint.lng.toFixed(5)}`
      : "-";

  useEffect(() => {
    if (!missionId) return;

    const legs: Array<{
      key: "driver" | "destination";
      origin: GeoPoint;
      destination: GeoPoint;
    }> = [];

    if (driverFresh && driverPoint) {
      if ((status === "accepted" || status === "en_route") && pickup) {
        legs.push({ key: "driver", origin: driverPoint, destination: pickup });
      } else if (status === "in_progress" && destination) {
        legs.push({ key: "driver", origin: driverPoint, destination });
      }
    }
    if (
      (status === "accepted" ||
        status === "en_route" ||
        status === "arrived" ||
        status === "in_progress") &&
      pickup &&
      destination
    ) {
      legs.push({ key: "destination", origin: pickup, destination });
    }
    if (!legs.length) return;

    const previous = requestRef.current;
    const now = Date.now();
    const missionChanged = !previous || previous.missionId !== missionId;
    const staticChanged = !previous || previous.staticKey !== staticKey;
    const driverMoved =
      !!driverPoint &&
      !!previous?.driverPoint &&
      distanceMeters(previous.driverPoint, driverPoint) >= DRIVER_ROUTE_MIN_METERS;
    const intervalElapsed = !previous || now - previous.at >= DRIVER_ROUTE_MIN_INTERVAL_MS;
    const retryAfterFailure = failedRef.current && intervalElapsed;
    const driverChanged = !!previous && previous.driverKey !== driverKey;
    // No route is held for this mission yet: a request cancelled during its
    // debounce must still be re-scheduled even when nothing else changed.
    // `state` stays out of the deps so a landed request never re-runs this.
    const unresolved = state.missionId !== missionId;
    const shouldFetch =
      missionChanged ||
      staticChanged ||
      unresolved ||
      ((driverChanged || driverMoved) && intervalElapsed) ||
      retryAfterFailure;

    if (!shouldFetch) return;

    const record: RequestRecord = {
      missionId,
      staticKey,
      driverKey,
      driverPoint,
      at: now,
    };
    requestRef.current = record;

    const controller = new AbortController();
    let started = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    const timer = setTimeout(() => {
      started = true;
      void (async () => {
        setState((current) =>
          current.missionId === missionId
            ? { ...current, loading: true }
            : { missionId, routes: [], loading: true, failed: false },
        );
        const results: MapRouteLine[] = [];
        let failure = false;
        for (const leg of legs) {
          if (controller.signal.aborted) return;
          try {
            const route = await fetchRoadRoute(leg.origin, leg.destination, controller.signal);
            results.push({ key: leg.key, tone: leg.key, points: toPoints(route) });
          } catch {
            if (!controller.signal.aborted) failure = true;
          }
        }
        if (controller.signal.aborted) return;
        failedRef.current = failure;
        setState({ missionId, routes: results, loading: false, failed: failure });
        if (failure) {
          retryTimer = setTimeout(() => {
            if (!controller.signal.aborted) setRetryTick((tick) => tick + 1);
          }, ROUTE_RETRY_MS);
        }
      })();
    }, ROUTE_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
      if (retryTimer) clearTimeout(retryTimer);
      // A debounce cancelled before it fired never became a request, so it
      // must not suppress the next attempt.
      if (!started && requestRef.current === record) requestRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missionId, staticKey, driverKey, driverFresh, retryTick]);

  const routable =
    status === "accepted" || status === "en_route" || status === "arrived" || status === "in_progress";
  const driverLegVisible =
    driverFresh && (status === "accepted" || status === "en_route" || status === "in_progress");
  const routes =
    state.missionId === missionId && routable
      ? state.routes.filter((route) => route.key !== "driver" || driverLegVisible)
      : [];

  return {
    routes,
    loading: state.missionId === missionId && state.loading,
    failed: state.missionId === missionId && state.failed,
  };
}
