"use client";

import {
  Ambulance as AmbulanceIcon,
  Clock3,
  MapPin,
  Pencil,
  Phone,
  RefreshCw,
  UserPlus,
} from "lucide-react";
import type { ReactNode } from "react";

import { LocationLabel } from "@/components/dashboard/location-label";
import { TileMap } from "@/components/dashboard/tile-map";
import {
  formatDateTime,
  formatInteger,
  formatRelative,
  gpsFreshness,
} from "@/lib/dashboard/format";
import type { MissionStatus } from "@/lib/dashboard/types";
import { vehicleState } from "@/lib/fleet/status";
import type { FleetAmbulance } from "@/lib/fleet/types";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { useI18n } from "@/lib/i18n/provider";
import {
  formatTunisianPhone,
  normalizeTunisianPhoneDigits,
  toE164,
} from "@/lib/phone";

import { FleetStatusBadge } from "./fleet-status-badge";

const MISSION_STATUS_KEYS: Record<MissionStatus, MessageKey> = {
  requested: "dc.status.requested",
  accepted: "dc.status.accepted",
  en_route: "dc.status.en_route",
  arrived: "dc.status.arrived",
  in_progress: "dc.status.in_progress",
  completed: "dc.status.completed",
  cancelled: "dc.status.cancelled",
};

const FRESHNESS_DOT: Record<string, string> = {
  live: "bg-emerald-500",
  delayed: "bg-amber-500",
  stale: "bg-accent-500",
  missing: "bg-slate-300",
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-soft">
        {label}
      </dt>
      <dd className="mt-0.5 truncate text-sm text-ink">{children}</dd>
    </div>
  );
}

export function FleetDetails({
  ambulance,
  nowMs,
  refreshing,
  onEdit,
  onAssign,
  onRefresh,
}: {
  ambulance: FleetAmbulance | null;
  nowMs: number;
  refreshing: boolean;
  onEdit: (ambulance: FleetAmbulance) => void;
  onAssign: (ambulance: FleetAmbulance) => void;
  onRefresh: () => void;
}) {
  const { t, locale } = useI18n();

  if (!ambulance) {
    return (
      <aside className="flex h-full min-h-[280px] flex-col items-center justify-center gap-2 rounded-2xl border border-line/70 bg-white p-6 text-center shadow-soft">
        <span className="grid size-11 place-items-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
          <AmbulanceIcon aria-hidden className="size-5" />
        </span>
        <p className="text-sm font-semibold text-brand-900">{t("fleet.details.empty")}</p>
        <p className="text-xs text-ink-soft">{t("fleet.details.emptyHint")}</p>
      </aside>
    );
  }

  const state = vehicleState(ambulance);
  const point =
    ambulance.driver_lat != null && ambulance.driver_lng != null
      ? { lat: ambulance.driver_lat, lng: ambulance.driver_lng }
      : null;
  const freshness = point
    ? gpsFreshness(ambulance.location_updated_at, nowMs)
    : "missing";
  const freshnessLabel =
    freshness === "live"
      ? t("fleet.location.live")
      : freshness === "delayed"
        ? t("fleet.location.delayed")
        : freshness === "stale"
          ? t("fleet.location.stale")
          : t("fleet.location.missing");
  const online = ambulance.driver_availability === true;
  const onMission = state === "on_mission";
  const mission = ambulance.active_mission;

  const storedStatus =
    ambulance.status === "maintenance"
      ? t("fleet.state.maintenance")
      : ambulance.status === "on_mission"
        ? t("fleet.state.onMission")
        : t("fleet.state.available");

  // Only the assigned driver's own profile phone reaches the manager RPC.
  const driverPhone = ambulance.driver_phone?.trim() || null;
  const driverPhoneDigits = driverPhone
    ? normalizeTunisianPhoneDigits(driverPhone)
    : null;
  const driverPhoneLabel = driverPhone
    ? (driverPhoneDigits ? formatTunisianPhone(driverPhone) : driverPhone)
    : null;
  const driverPhoneHref = driverPhone
    ? `tel:${driverPhoneDigits ? toE164(driverPhoneDigits) : driverPhone.replace(/[^0-9+]/g, "")}`
    : null;

  return (
    <aside className="flex h-full flex-col overflow-hidden rounded-2xl border border-line/70 bg-white shadow-soft">
      <header className="flex items-start justify-between gap-3 border-b border-line/60 px-4 py-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-700">
            {t("fleet.details.title")}
          </p>
          <h2 className="mt-0.5 truncate text-base font-semibold text-brand-900">
            {ambulance.label?.trim() || "—"}
          </h2>
          <div className="mt-1.5">
            <FleetStatusBadge state={state} />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => onEdit(ambulance)}
            aria-label={t("fleet.details.edit")}
            title={t("fleet.details.edit")}
            className="grid size-8 place-items-center rounded-lg border border-line text-brand-800 transition hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <Pencil aria-hidden className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => onAssign(ambulance)}
            disabled={onMission}
            aria-label={t("fleet.details.assign")}
            title={
              onMission
                ? t("fleet.assign.error.ambulanceMission")
                : t("fleet.details.assign")
            }
            className="grid size-8 place-items-center rounded-lg border border-line text-brand-800 transition hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white"
          >
            <UserPlus aria-hidden className="size-4" />
          </button>
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            aria-label={t("dc.command.refresh")}
            title={t("dc.command.refresh")}
            className="grid size-8 place-items-center rounded-lg border border-line text-brand-800 transition hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-60"
          >
            <RefreshCw aria-hidden className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <section aria-label={t("fleet.details.vehicle")}>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-3">
            <Field label={t("fleet.table.registration")}>
              {ambulance.plate_number?.trim() || "—"}
            </Field>
            <Field label={t("fleet.details.mileage")}>
              {ambulance.mileage != null
                ? `${formatInteger(ambulance.mileage, locale)} km`
                : "—"}
            </Field>
            <Field label={t("fleet.details.storedStatus")}>{storedStatus}</Field>
            <Field label={t("fleet.details.created")}>
              {formatDateTime(ambulance.created_at, "—")}
            </Field>
          </dl>
        </section>

        <section aria-label={t("fleet.details.driver")} className="border-t border-line/60 pt-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-soft">
              {t("fleet.details.driver")}
            </h3>
            {ambulance.driver_id ? (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                  online
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-line bg-surface text-ink-soft"
                }`}
              >
                <span
                  aria-hidden
                  className={`size-1.5 rounded-full ${online ? "bg-emerald-500" : "bg-slate-400"}`}
                />
                {online ? t("fleet.details.driverOnline") : t("fleet.details.driverOffline")}
              </span>
            ) : null}
          </div>

          {ambulance.driver_id ? (
            <div className="mt-2 space-y-1.5">
              <p className="text-sm font-medium text-brand-900">
                {ambulance.driver_name?.trim() || t("dc.details.notAssigned")}
              </p>
              {driverPhoneHref && driverPhoneLabel ? (
                <a
                  href={driverPhoneHref}
                  className="inline-flex items-center gap-1.5 text-[11px] font-medium text-brand-700 underline-offset-2 transition hover:text-brand-900 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                >
                  <Phone aria-hidden className="size-3.5 shrink-0" />
                  <span dir="ltr">{driverPhoneLabel}</span>
                </a>
              ) : (
                <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-ink-soft">
                  <Phone aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                  {t("fleet.details.phoneMissing")}
                </p>
              )}
            </div>
          ) : (
            <p className="mt-2 text-sm text-ink-soft">{t("fleet.state.unassigned")}</p>
          )}
        </section>

        <section aria-label={t("fleet.details.mission")} className="border-t border-line/60 pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-soft">
            {t("fleet.details.mission")}
          </h3>

          {mission ? (
            <div className="mt-2 space-y-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                  {t(MISSION_STATUS_KEYS[mission.status] ?? "dc.status.accepted")}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] text-ink-soft">
                  <Clock3 aria-hidden className="size-3.5" />
                  {formatDateTime(mission.created_at, "—")}
                </span>
              </div>

              <div className="space-y-2 rounded-xl bg-surface/70 p-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-soft">
                    {t("dc.details.pickup")}
                  </p>
                  <p className="mt-0.5 text-sm text-ink">
                    <LocationLabel
                      label={mission.pickup_label}
                      point={
                        mission.pickup_lat != null && mission.pickup_lng != null
                          ? { lat: mission.pickup_lat, lng: mission.pickup_lng }
                          : null
                      }
                    />
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-soft">
                    {t("dc.details.destination")}
                  </p>
                  <p className="mt-0.5 text-sm text-ink">
                    <LocationLabel
                      label={mission.destination_label}
                      point={
                        mission.destination_lat != null && mission.destination_lng != null
                          ? { lat: mission.destination_lat, lng: mission.destination_lng }
                          : null
                      }
                    />
                  </p>
                </div>
                <p className="text-[11px] text-ink-soft">
                  {t("dc.details.accepted")}: {formatDateTime(mission.accepted_at, "—")}
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm text-ink-soft">{t("fleet.details.noMission")}</p>
          )}
        </section>

        <section aria-label={t("fleet.details.map")} className="border-t border-line/60 pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-soft">
            {t("fleet.details.map")}
          </h3>

          {point ? (
            <>
              <div className="mt-2">
                <TileMap
                  center={point}
                  zoom={14}
                  markers={[
                    {
                      key: ambulance.id,
                      point,
                      tone: "ambulance",
                      title: ambulance.label ?? undefined,
                      selected: true,
                      delayed: freshness !== "live",
                    },
                  ]}
                  className="h-52"
                />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-soft">
                <span className="inline-flex items-center gap-1.5 font-medium text-ink">
                  <span
                    aria-hidden
                    className={`size-1.5 rounded-full ${FRESHNESS_DOT[freshness]}`}
                  />
                  {freshnessLabel}
                </span>
                <span aria-hidden>·</span>
                <span>{t("fleet.location.source")}</span>
                <span aria-hidden>·</span>
                <span>
                  {t("fleet.location.updated", {
                    time: formatRelative(ambulance.location_updated_at, nowMs, t),
                  })}
                </span>
              </div>
            </>
          ) : (
            <p className="mt-2 flex items-center gap-1.5 text-sm text-ink-soft">
              <MapPin aria-hidden className="size-4" />
              {ambulance.driver_id
                ? t("fleet.location.missing")
                : t("fleet.location.noDriver")}
            </p>
          )}
        </section>
      </div>
    </aside>
  );
}
