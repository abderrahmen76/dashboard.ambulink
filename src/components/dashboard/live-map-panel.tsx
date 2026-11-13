"use client";

import { MapPinned } from "lucide-react";
import { useMemo } from "react";

import { gpsFreshness } from "@/lib/dashboard/format";
import type { DashboardMission, DashboardSnapshot } from "@/lib/dashboard/types";
import { useMissionRoutes } from "@/lib/geo/use-geo";
import { useI18n } from "@/lib/i18n/provider";

import { TileMap, type MapMarker, type MapPoint } from "./tile-map";

/**
 * A mission is drawn while it is still running. The dispatch attempt and the
 * offers are deliberately not part of this rule: when an offer expires the
 * mission stays `requested` and its pickup must remain on the map.
 */
const MAP_MISSION_STATUSES = new Set<DashboardMission["status"]>([
  "requested",
  "accepted",
  "en_route",
  "arrived",
  "in_progress",
]);

/** A marker needs a real position; null, out-of-range and 0/0 sentinels do not. */
function usablePoint(lat: number | null, lng: number | null): MapPoint | null {
  if (lat == null || lng == null) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
}

function fitView(
  points: MapPoint[],
  fallback: MapPoint,
  maxZoom = 15,
): { center: MapPoint; zoom: number } {
  if (!points.length) return { center: fallback, zoom: 12 };
  if (points.length === 1) return { center: points[0], zoom: Math.min(maxZoom, 14) };
  let minLat = 90;
  let maxLat = -90;
  let minLng = 180;
  let maxLng = -180;
  for (const point of points) {
    minLat = Math.min(minLat, point.lat);
    maxLat = Math.max(maxLat, point.lat);
    minLng = Math.min(minLng, point.lng);
    maxLng = Math.max(maxLng, point.lng);
  }
  const center = { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 };
  const span = Math.max(
    maxLat - minLat,
    (maxLng - minLng) * Math.cos((center.lat * Math.PI) / 180),
    0.0015,
  );
  const metersPerPixelAtZoom0 = 156543.03392 * Math.cos((center.lat * Math.PI) / 180);
  const zoom = Math.floor(Math.log2(metersPerPixelAtZoom0 / ((span * 111_320) / 560)));
  return { center, zoom: Math.min(maxZoom, Math.max(8, zoom)) };
}

export function LiveMapPanel({
  snapshot,
  selectedId,
  nowMs,
}: {
  snapshot: DashboardSnapshot;
  selectedId: string | null;
  nowMs: number;
}) {
  const { t } = useI18n();

  const selectedMission = useMemo(
    () => snapshot.missions.find((mission) => mission.id === selectedId) ?? null,
    [snapshot.missions, selectedId],
  );
  const selectedDriver = useMemo(
    () =>
      snapshot.drivers.find((driver) => driver.id === selectedMission?.driver_id) ?? null,
    [snapshot.drivers, selectedMission],
  );
  const { routes, loading: routeLoading, failed: routeFailed } = useMissionRoutes({
    mission: selectedMission,
    driver: selectedDriver,
    nowMs,
  });

  const { markers, hidden, center, zoom } = useMemo(() => {
    const list: MapMarker[] = [];
    const hiddenVehicles = new Set<string>();

    const hospital = snapshot.hospital;
    const hospitalPoint: MapPoint | null =
      hospital.latitude != null && hospital.longitude != null
        ? { lat: hospital.latitude, lng: hospital.longitude }
        : null;
    if (hospitalPoint) {
      list.push({
        key: "hospital",
        point: hospitalPoint,
        tone: "hospital",
        title: hospital.name,
      });
    }

    for (const driver of snapshot.drivers) {
      if (driver.current_lat == null || driver.current_lng == null) continue;
      const freshness = gpsFreshness(driver.location_updated_at, nowMs);
      if (freshness === "missing" || freshness === "stale") {
        hiddenVehicles.add(driver.id);
        continue;
      }
      list.push({
        key: `ambulance-${driver.id}`,
        point: { lat: driver.current_lat, lng: driver.current_lng },
        tone: "ambulance",
        title: driver.ambulance_label ?? driver.full_name ?? t("dc.map.ambulance"),
        delayed: freshness === "delayed",
        selected: selectedMission?.driver_id === driver.id,
      });
    }

    // One pickup/destination pair per mission, whatever its offer history: a
    // mission with several attempts still yields a single set of markers.
    const drawnMissions = new Set<string>();
    const activePickups: MapPoint[] = [];
    for (const mission of snapshot.missions) {
      if (drawnMissions.has(mission.id)) continue;
      if (!MAP_MISSION_STATUSES.has(mission.status)) continue;
      drawnMissions.add(mission.id);
      const selected = mission.id === selectedId;
      const pickup = usablePoint(mission.pickup_lat, mission.pickup_lng);
      if (pickup) {
        list.push({
          key: `pickup-${mission.id}`,
          point: pickup,
          tone: "pickup",
          title: t("dc.map.pickup"),
          selected,
        });
        activePickups.push(pickup);
      }
      const destination = usablePoint(
        mission.destination_lat,
        mission.destination_lng,
      );
      if (destination) {
        list.push({
          key: `destination-${mission.id}`,
          point: destination,
          tone: "destination",
          title: t("dc.map.destination"),
          selected,
        });
      }
    }

    const base = hospitalPoint ?? activePickups[0] ?? { lat: 36.8065, lng: 10.1815 };

    const selectedPoints: MapPoint[] = [];
    if (selectedMission) {
      const pickup = usablePoint(selectedMission.pickup_lat, selectedMission.pickup_lng);
      if (pickup) selectedPoints.push(pickup);
      const destination = usablePoint(
        selectedMission.destination_lat,
        selectedMission.destination_lng,
      );
      if (destination) selectedPoints.push(destination);
      if (
        selectedDriver?.current_lat != null &&
        selectedDriver.current_lng != null &&
        gpsFreshness(selectedDriver.location_updated_at, nowMs) === "live"
      ) {
        selectedPoints.push({
          lat: selectedDriver.current_lat,
          lng: selectedDriver.current_lng,
        });
      }
    }
    // Unselected view frames every active pickup, so a mission still waiting
    // for a driver is on screen even when it is far from the hospital.
    const view = selectedMission
      ? fitView(selectedPoints, base)
      : activePickups.length
        ? fitView(
            hospitalPoint ? [hospitalPoint, ...activePickups] : activePickups,
            base,
            13,
          )
        : { center: base, zoom: 12 };

    return {
      markers: list,
      hidden: hiddenVehicles.size,
      center: view.center,
      zoom: view.zoom,
    };
  }, [snapshot, selectedId, selectedMission, selectedDriver, nowMs, t]);

  return (
    <section className="rounded-2xl border border-line/70 bg-white p-3 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 pb-3">
        <h2 className="text-sm font-semibold text-brand-900">{t("dc.map.title")}</h2>
        <div className="flex flex-wrap items-center gap-1.5">
          {routeLoading ? (
            <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] text-ink-soft">
              {t("dc.route.loading")}
            </span>
          ) : null}
          {routeFailed && !routeLoading ? (
            <span className="rounded-full bg-accent-50 px-2 py-0.5 text-[11px] text-accent-700">
              {t("dc.route.failed")}
            </span>
          ) : null}
          {hidden > 0 ? (
            <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] text-ink-soft">
              {t("dc.map.hidden", { count: hidden })}
            </span>
          ) : null}
        </div>
      </div>

      <TileMap
        key={selectedId ?? "all"}
        center={center}
        zoom={zoom}
        markers={markers}
        routes={routes}
        showLegend
        className="h-[440px] lg:h-[520px]"
      >
        {markers.length === 0 ? (
          <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-white/50">
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-ink-soft shadow-soft">
              <MapPinned aria-hidden className="size-4" />
              {t("dc.map.empty")}
            </span>
          </div>
        ) : null}
      </TileMap>
    </section>
  );
}
