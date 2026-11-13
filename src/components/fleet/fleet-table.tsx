"use client";

import { ChevronLeft, ChevronRight, Eye, Plus, SearchX } from "lucide-react";

import {
  formatInteger,
  formatRelative,
  gpsFreshness,
} from "@/lib/dashboard/format";
import { vehicleState } from "@/lib/fleet/status";
import type { FleetAmbulance } from "@/lib/fleet/types";
import { useI18n } from "@/lib/i18n/provider";

import { FleetStatusBadge } from "./fleet-status-badge";

const FRESHNESS_DOT: Record<string, string> = {
  live: "bg-emerald-500",
  delayed: "bg-amber-500",
  stale: "bg-accent-500",
  missing: "bg-slate-300",
};

function LocationCell({
  ambulance,
  nowMs,
}: {
  ambulance: FleetAmbulance;
  nowMs: number;
}) {
  const { t } = useI18n();

  if (!ambulance.driver_id) {
    return <span className="text-xs text-ink-soft">{t("fleet.location.noDriver")}</span>;
  }
  if (ambulance.driver_lat == null || ambulance.driver_lng == null) {
    return <span className="text-xs text-ink-soft">{t("fleet.location.missing")}</span>;
  }

  const freshness = gpsFreshness(ambulance.location_updated_at, nowMs);
  const label =
    freshness === "live"
      ? t("fleet.location.live")
      : freshness === "delayed"
        ? t("fleet.location.delayed")
        : freshness === "stale"
          ? t("fleet.location.stale")
          : t("fleet.location.missing");

  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs">
      <span aria-hidden className={`size-1.5 rounded-full ${FRESHNESS_DOT[freshness]}`} />
      <span className="font-medium text-ink">{label}</span>
      <span className="text-[11px] text-ink-soft">
        {formatRelative(ambulance.location_updated_at, nowMs, t)}
      </span>
    </span>
  );
}

function DriverCell({ ambulance }: { ambulance: FleetAmbulance }) {
  const { t } = useI18n();
  if (!ambulance.driver_id) {
    return <span className="text-xs text-ink-soft">{t("fleet.state.unassigned")}</span>;
  }
  return (
    <span className="block truncate text-sm text-ink">
      {ambulance.driver_name?.trim() || t("dc.details.notAssigned")}
    </span>
  );
}

export function FleetTable({
  ambulances,
  selectedId,
  onSelect,
  page,
  pageCount,
  total,
  from,
  to,
  onPage,
  hasAnyVehicles,
  onAdd,
  onClearFilters,
  nowMs,
}: {
  ambulances: FleetAmbulance[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  page: number;
  pageCount: number;
  total: number;
  from: number;
  to: number;
  onPage: (page: number) => void;
  hasAnyVehicles: boolean;
  onAdd: () => void;
  onClearFilters: () => void;
  nowMs: number;
}) {
  const { t, locale } = useI18n();

  const empty = (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <span className="grid size-11 place-items-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
        {hasAnyVehicles ? (
          <SearchX aria-hidden className="size-5" />
        ) : (
          <Plus aria-hidden className="size-5" />
        )}
      </span>
      <div>
        <p className="text-sm font-semibold text-brand-900">
          {hasAnyVehicles ? t("fleet.table.noMatch") : t("fleet.table.empty")}
        </p>
        <p className="mt-1 text-xs text-ink-soft">
          {hasAnyVehicles ? t("fleet.table.noMatchHint") : t("fleet.table.emptyHint")}
        </p>
      </div>
      <button
        type="button"
        onClick={hasAnyVehicles ? onClearFilters : onAdd}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-800 px-3.5 text-sm font-semibold text-white transition hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
      >
        {hasAnyVehicles ? null : <Plus aria-hidden className="size-4" />}
        {hasAnyVehicles ? t("fleet.filter.clear") : t("fleet.add")}
      </button>
    </div>
  );

  return (
    <section
      aria-label={t("fleet.registry")}
      className="overflow-hidden rounded-2xl border border-line/70 bg-white shadow-soft"
    >
      <div className="flex items-center justify-between gap-3 border-b border-line/60 px-4 py-3">
        <h2 className="text-sm font-semibold text-brand-900">{t("fleet.registry")}</h2>
        <span className="inline-flex h-7 items-center rounded-full bg-surface px-2.5 text-[11px] font-semibold text-ink-soft">
          {formatInteger(total, locale)}
        </span>
      </div>

      {total === 0 ? (
        empty
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-surface/60 text-[11px] uppercase tracking-[0.08em] text-ink-soft">
                  <th scope="col" className="px-4 py-2.5 text-start font-semibold">
                    {t("fleet.table.name")}
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-start font-semibold">
                    {t("fleet.table.registration")}
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-start font-semibold">
                    {t("fleet.table.driver")}
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-start font-semibold">
                    {t("fleet.table.status")}
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-start font-semibold">
                    {t("fleet.table.location")}
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-end font-semibold">
                    {t("fleet.table.actions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {ambulances.map((ambulance) => {
                  const selected = ambulance.id === selectedId;
                  return (
                    <tr
                      key={ambulance.id}
                      onClick={() => onSelect(ambulance.id)}
                      aria-selected={selected}
                      className={`cursor-pointer border-t border-line/60 transition ${
                        selected ? "bg-brand-50/70" : "hover:bg-surface/60"
                      }`}
                    >
                      <td className="max-w-[220px] px-4 py-3">
                        <p className="truncate font-semibold text-brand-900">
                          {ambulance.label?.trim() || "—"}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-ink">
                        {ambulance.plate_number?.trim() || "—"}
                      </td>
                      <td className="max-w-[180px] px-4 py-3">
                        <DriverCell ambulance={ambulance} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <FleetStatusBadge state={vehicleState(ambulance)} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <LocationCell ambulance={ambulance} nowMs={nowMs} />
                      </td>
                      <td className="px-4 py-3 text-end">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onSelect(ambulance.id);
                          }}
                          aria-label={`${t("fleet.table.show")}: ${
                            ambulance.label?.trim() ||
                            ambulance.plate_number?.trim() ||
                            t("fleet.table.name")
                          }`}
                          className="grid size-8 place-items-center rounded-lg border border-line text-brand-800 transition hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                        >
                          <Eye aria-hidden className="size-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <ul className="divide-y divide-line/60 md:hidden">
            {ambulances.map((ambulance) => {
              const selected = ambulance.id === selectedId;
              return (
                <li key={ambulance.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(ambulance.id)}
                    aria-pressed={selected}
                    className={`flex w-full flex-col gap-2 px-4 py-3 text-start transition ${
                      selected ? "bg-brand-50/70" : "hover:bg-surface/60"
                    }`}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-brand-900">
                          {ambulance.label?.trim() || "—"}
                        </span>
                        <span className="mt-0.5 block truncate font-mono text-[10px] uppercase text-ink-soft">
                          {ambulance.plate_number?.trim() || "—"}
                        </span>
                      </span>
                      <FleetStatusBadge state={vehicleState(ambulance)} />
                    </span>
                    <span className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-soft">
                      <DriverCell ambulance={ambulance} />
                      <LocationCell ambulance={ambulance} nowMs={nowMs} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/60 px-4 py-3">
            <p className="text-xs text-ink-soft">
              {t("fleet.table.rows", {
                from: formatInteger(from, locale),
                to: formatInteger(to, locale),
                total: formatInteger(total, locale),
              })}
              {" · "}
              {t("fleet.table.page", {
                page: formatInteger(page, locale),
                pages: formatInteger(pageCount, locale),
              })}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onPage(page - 1)}
                disabled={page <= 1}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-line bg-white px-2.5 text-xs font-semibold text-brand-800 transition hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronLeft aria-hidden className="size-4 rtl:rotate-180" />
                {t("fleet.table.previous")}
              </button>
              <button
                type="button"
                onClick={() => onPage(page + 1)}
                disabled={page >= pageCount}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-line bg-white px-2.5 text-xs font-semibold text-brand-800 transition hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("fleet.table.next")}
                <ChevronRight aria-hidden className="size-4 rtl:rotate-180" />
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
