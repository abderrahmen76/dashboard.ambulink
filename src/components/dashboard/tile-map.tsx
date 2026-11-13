"use client";

import { Cross, Crosshair, MapPin, Minus, Plus, Siren } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useI18n } from "@/lib/i18n/provider";

export type MapPoint = { lat: number; lng: number };

export type MapMarker = {
  key: string;
  point: MapPoint;
  tone: "hospital" | "ambulance" | "pickup" | "destination";
  title?: string;
  /** Visible caption rendered under the marker, e.g. a company name. */
  label?: string;
  selected?: boolean;
  delayed?: boolean;
  /** Makes the marker an interactive button; pointer events stay off the map. */
  onClick?: () => void;
};

export type MapRoute = {
  key: string;
  tone: "driver" | "destination";
  points: MapPoint[];
};

type View = MapPoint & { zoom: number };

const TILE_SIZE = 256;
const MIN_ZOOM = 7;
const MAX_ZOOM = 17;

function project(lat: number, lng: number, zoom: number) {
  const scale = TILE_SIZE * 2 ** zoom;
  const x = ((lng + 180) / 360) * scale;
  const sin = Math.sin((lat * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale;
  return { x, y };
}

function unproject(x: number, y: number, zoom: number): MapPoint {
  const scale = TILE_SIZE * 2 ** zoom;
  const lng = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  const lat = (180 / Math.PI) * Math.atan(Math.sinh(n));
  return { lat, lng };
}

const TONES: Record<MapMarker["tone"], { className: string; icon: ReactNode }> = {
  hospital: {
    className: "bg-brand-900 text-white ring-white",
    icon: <Cross aria-hidden className="size-3.5" />,
  },
  ambulance: {
    className: "bg-brand-600 text-white ring-white",
    icon: <Siren aria-hidden className="size-3.5" />,
  },
  pickup: {
    className: "bg-emerald-600 text-white ring-white",
    icon: <MapPin aria-hidden className="size-3.5" />,
  },
  destination: {
    className: "bg-accent-600 text-white ring-white",
    icon: <MapPin aria-hidden className="size-3.5" />,
  },
};

export function TileMap({
  center,
  zoom = 12,
  markers,
  routes = [],
  onPick,
  showLegend = false,
  className = "h-[460px]",
  children,
}: {
  center: MapPoint;
  zoom?: number;
  markers: MapMarker[];
  routes?: MapRoute[];
  onPick?: (point: MapPoint) => void;
  showLegend?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  // The props stay authoritative so a refreshed snapshot re-frames the map;
  // panning or zooming pins the view until "recenter".
  const [pinned, setPinned] = useState<View | null>(null);
  const view = useMemo<View>(
    () => pinned ?? { lat: center.lat, lng: center.lng, zoom },
    [pinned, center.lat, center.lng, zoom],
  );
  const dragRef = useRef<{
    pointerId: number;
    lastX: number;
    lastY: number;
    moved: number;
  } | null>(null);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) setSize({ width: rect.width, height: rect.height });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const tiles = useMemo(() => {
    if (!size.width || !size.height) return [];
    const { x, y } = project(view.lat, view.lng, view.zoom);
    const originX = x - size.width / 2;
    const originY = y - size.height / 2;
    const max = 2 ** view.zoom;
    const list: Array<{ key: string; url: string; left: number; top: number }> = [];
    const firstX = Math.floor(originX / TILE_SIZE);
    const lastX = Math.floor((originX + size.width) / TILE_SIZE);
    const firstY = Math.max(0, Math.floor(originY / TILE_SIZE));
    const lastY = Math.min(max - 1, Math.floor((originY + size.height) / TILE_SIZE));
    for (let tx = firstX; tx <= lastX; tx += 1) {
      const wrapped = ((tx % max) + max) % max;
      for (let ty = firstY; ty <= lastY; ty += 1) {
        list.push({
          key: `${view.zoom}/${tx}/${ty}`,
          url: `https://tile.openstreetmap.org/${view.zoom}/${wrapped}/${ty}.png`,
          left: tx * TILE_SIZE - originX,
          top: ty * TILE_SIZE - originY,
        });
      }
    }
    return list;
  }, [size, view]);

  const positioned = useMemo(() => {
    if (!size.width || !size.height) return [];
    const { x, y } = project(view.lat, view.lng, view.zoom);
    const originX = x - size.width / 2;
    const originY = y - size.height / 2;
    return markers
      .map((marker) => {
        const point = project(marker.point.lat, marker.point.lng, view.zoom);
        return {
          marker,
          left: point.x - originX,
          top: point.y - originY,
        };
      })
      .filter(
        ({ left, top }) =>
          left > -60 && top > -60 && left < size.width + 60 && top < size.height + 60,
      );
  }, [markers, size, view]);

  const projectedRoutes = useMemo(() => {
    if (!size.width || !size.height) return [];
    const { x, y } = project(view.lat, view.lng, view.zoom);
    const originX = x - size.width / 2;
    const originY = y - size.height / 2;
    return routes
      .map((route) => {
        const points = route.points
          .map((point) => {
            const projected = project(point.lat, point.lng, view.zoom);
            return `${(projected.x - originX).toFixed(1)},${(projected.y - originY).toFixed(1)}`;
          })
          .join(" ");
        return { key: route.key, tone: route.tone, points };
      })
      .filter((route) => route.points.length > 0);
  }, [routes, size, view]);

  const shift = useCallback(
    (dx: number, dy: number) => {
      setPinned((current) => {
        const from = current ?? { lat: center.lat, lng: center.lng, zoom };
        const { x, y } = project(from.lat, from.lng, from.zoom);
        const next = unproject(x - dx, y - dy, from.zoom);
        return {
          lat: Math.min(85, Math.max(-85, next.lat)),
          lng: ((next.lng + 540) % 360) - 180,
          zoom: from.zoom,
        };
      });
    },
    [center.lat, center.lng, zoom],
  );

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    dragRef.current = {
      pointerId: event.pointerId,
      lastX: event.clientX,
      lastY: event.clientY,
      moved: 0,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.lastX;
    const dy = event.clientY - drag.lastY;
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
    drag.moved += Math.abs(dx) + Math.abs(dy);
    if (drag.moved > 2) shift(dx, dy);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (!onPick || drag.moved > 5 || !size.width) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const { x, y } = project(view.lat, view.lng, view.zoom);
    const point = unproject(
      x - size.width / 2 + (event.clientX - rect.left),
      y - size.height / 2 + (event.clientY - rect.top),
      view.zoom,
    );
    onPick(point);
  };

  const changeZoom = (delta: number) => {
    setPinned({
      lat: view.lat,
      lng: view.lng,
      zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.zoom + delta)),
    });
  };

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-surface-strong ${className}`}>
      <div
        ref={containerRef}
        dir="ltr"
        role="application"
        aria-label={t("dc.map.title")}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => {
          dragRef.current = null;
        }}
        className={`absolute inset-0 touch-none select-none ${
          onPick ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing"
        }`}
      >
        {tiles.map((tile) => (
          <div
            key={tile.key}
            aria-hidden
            className="pointer-events-none absolute"
            style={{
              left: tile.left,
              top: tile.top,
              width: TILE_SIZE,
              height: TILE_SIZE,
              backgroundImage: `url(${tile.url})`,
              backgroundSize: `${TILE_SIZE}px ${TILE_SIZE}px`,
            }}
          />
        ))}

        {projectedRoutes.length ? (
          <svg
            aria-hidden
            className="pointer-events-none absolute inset-0 z-[5] h-full w-full"
          >
            {projectedRoutes.map((route) => (
              <g key={route.key}>
                <polyline
                  points={route.points}
                  fill="none"
                  stroke="#ffffff"
                  strokeOpacity={0.92}
                  strokeWidth={7}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <polyline
                  points={route.points}
                  fill="none"
                  stroke={route.tone === "driver" ? "#1c5188" : "#b61718"}
                  strokeWidth={4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={route.tone === "destination" ? "9 6" : undefined}
                />
              </g>
            ))}
          </svg>
        ) : null}

        {positioned.map(({ marker, left, top }) => {
          const tone = TONES[marker.tone];
          const dotClass = `grid size-8 place-items-center rounded-full shadow-lg ring-2 transition-transform ${tone.className} ${
            marker.selected ? "scale-125 ring-4 ring-brand-200" : ""
          } ${marker.delayed ? "opacity-80" : ""}`;
          const dot = (
            <span className={dotClass}>
              {tone.icon}
              {marker.title ? <span className="sr-only">{marker.title}</span> : null}
            </span>
          );
          const caption = marker.label ? (
            <span
              aria-hidden
              dir="auto"
              className={`absolute left-1/2 top-full mt-1 max-w-[10rem] -translate-x-1/2 truncate rounded-md bg-white/95 px-1.5 py-0.5 text-[10px] font-semibold text-ink shadow-sm ${
                marker.selected ? "ring-1 ring-brand-300" : ""
              }`}
            >
              {marker.label}
            </span>
          ) : null;
          return (
            <div
              key={marker.key}
              className={`absolute -translate-x-1/2 -translate-y-1/2 ${
                marker.selected ? "z-20" : "z-10"
              }`}
              style={{ left, top }}
            >
              {marker.onClick ? (
                <button
                  type="button"
                  title={marker.title}
                  aria-label={marker.title ?? marker.key}
                  aria-pressed={marker.selected ?? false}
                  onClick={(event) => {
                    event.stopPropagation();
                    marker.onClick?.();
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                  onPointerUp={(event) => event.stopPropagation()}
                  className="pointer-events-auto cursor-pointer rounded-full focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-200"
                >
                  {dot}
                  {caption}
                </button>
              ) : (
                <span title={marker.title} className="pointer-events-none block">
                  {dot}
                  {caption}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {showLegend ? (
        <div className="pointer-events-none absolute start-3 top-3 z-30 flex flex-wrap gap-1.5">
          {(["hospital", "ambulance", "pickup", "destination"] as const).map((tone) => (
            <span
              key={tone}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-medium text-ink shadow-sm"
            >
              <span className={`size-2 rounded-full ${TONES[tone].className.split(" ")[0]}`} />
              {t(`dc.map.${tone}`)}
            </span>
          ))}
        </div>
      ) : null}

      <div className="absolute end-3 top-3 z-30 flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => changeZoom(1)}
          aria-label={t("dc.map.zoomIn")}
          className="grid size-9 place-items-center rounded-xl bg-white text-brand-900 shadow-soft transition hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <Plus aria-hidden className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => changeZoom(-1)}
          aria-label={t("dc.map.zoomOut")}
          className="grid size-9 place-items-center rounded-xl bg-white text-brand-900 shadow-soft transition hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <Minus aria-hidden className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => setPinned(null)}
          aria-label={t("dc.map.recenter")}
          className="grid size-9 place-items-center rounded-xl bg-white text-brand-900 shadow-soft transition hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <Crosshair aria-hidden className="size-4" />
        </button>
      </div>

      {onPick ? (
        <p className="pointer-events-none absolute start-3 bottom-7 z-30 rounded-full bg-white/95 px-2.5 py-1 text-[11px] text-ink-soft shadow-sm">
          {t("dc.map.help")}
        </p>
      ) : null}

      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noreferrer"
        className="absolute end-0 bottom-0 z-30 bg-white/85 px-1.5 py-0.5 text-[10px] text-ink-soft hover:underline"
      >
        {t("dc.map.attribution")}
      </a>

      {children}
    </div>
  );
}
