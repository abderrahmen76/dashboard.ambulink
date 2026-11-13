"use client";

import {
  Ambulance as AmbulanceIcon,
  ChevronLeft,
  ChevronRight,
  Eye,
  SearchX,
  UserRound,
} from "lucide-react";

import type { MissionStatus } from "@/lib/dashboard/types";
import { formatInteger } from "@/lib/dashboard/format";
import type { DriverPageSize, DriverRow } from "@/lib/drivers/types";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { useI18n } from "@/lib/i18n/provider";
import {
  formatTunisianPhone,
  normalizeTunisianPhoneDigits,
  toE164,
} from "@/lib/phone";

import { DriverStatusBadge } from "./driver-status-badge";

const MISSION_STATUS_KEYS: Record<MissionStatus, MessageKey> = {
  requested: "dc.status.requested",
  accepted: "dc.status.accepted",
  en_route: "dc.status.en_route",
  arrived: "dc.status.arrived",
  in_progress: "dc.status.in_progress",
  completed: "dc.status.completed",
  cancelled: "dc.status.cancelled",
};

const PAGE_SIZES: DriverPageSize[] = [20, 50, 100];

export function driverInitials(fullName: string | null): string {
  if (!fullName) return "?";
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return `${first}${last}`.toUpperCase() || "?";
}

export function driverPhoneParts(phone: string | null): {
  label: string | null;
  href: string | null;
} {
  const value = phone?.trim();
  if (!value) return { label: null, href: null };
  const digits = normalizeTunisianPhoneDigits(value);
  return {
    label: digits ? formatTunisianPhone(value) : value,
    href: `tel:${digits ? toE164(digits) : value.replace(/[^0-9+]/g, "")}`,
  };
}

function DriverIdentity({ driver }: { driver: DriverRow }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span
        aria-hidden
        className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-50 text-[11px] font-semibold text-brand-800 ring-1 ring-brand-100"
      >
        {driverInitials(driver.full_name)}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-semibold text-brand-900">
          {driver.full_name?.trim() || "—"}
        </span>
      </span>
    </span>
  );
}

function PhoneCell({ driver }: { driver: DriverRow }) {
  const { t } = useI18n();
  const { label, href } = driverPhoneParts(driver.phone);
  if (!label || !href) {
    return (
      <span className="text-xs text-ink-soft" title={t("drivers.phone.missing")}>
        —
      </span>
    );
  }
  return (
    <a
      href={href}
      onClick={(event) => event.stopPropagation()}
      className="inline-flex items-center whitespace-nowrap text-xs font-medium text-brand-700 underline-offset-2 transition hover:text-brand-900 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
    >
      <span dir="ltr">{label}</span>
    </a>
  );
}

function AmbulanceCell({ driver }: { driver: DriverRow }) {
  const { t } = useI18n();
  if (!driver.ambulance) {
    return (
      <span className="inline-flex items-center rounded-full border border-line bg-surface px-2 py-0.5 text-[11px] font-semibold text-ink-soft">
        {t("fleet.state.unassigned")}
      </span>
    );
  }
  return (
    <span className="block min-w-0">
      <span className="block truncate text-sm text-ink">
        {driver.ambulance.label?.trim() || "—"}
      </span>
      {driver.ambulance.plate_number?.trim() ? (
        <span className="block truncate font-mono text-[10px] text-ink-soft">
          {driver.ambulance.plate_number}
        </span>
      ) : null}
    </span>
  );
}

function MissionCell({ driver }: { driver: DriverRow }) {
  const { t } = useI18n();
  const mission = driver.active_mission;
  if (!mission) {
    return <span className="text-xs text-ink-soft">{t("drivers.mission.none")}</span>;
  }
  const place = mission.destination_label?.trim() || mission.pickup_label?.trim() || null;
  return (
    <span className="block min-w-0">
      <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
        {t(MISSION_STATUS_KEYS[mission.status] ?? "dc.status.accepted")}
      </span>
      {place ? (
        <span className="mt-0.5 block truncate text-[11px] text-ink-soft" title={place}>
          {place}
        </span>
      ) : null}
    </span>
  );
}

export function DriversTable({
  drivers,
  selectedId,
  onSelect,
  onAssign,
  page,
  pageCount,
  total,
  from,
  to,
  onPage,
  pageSize,
  onPageSize,
  hasAnyDrivers,
  onClearFilters,
}: {
  drivers: DriverRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAssign: (driver: DriverRow) => void;
  page: number;
  pageCount: number;
  total: number;
  from: number;
  to: number;
  onPage: (page: number) => void;
  pageSize: DriverPageSize;
  onPageSize: (value: DriverPageSize) => void;
  hasAnyDrivers: boolean;
  onClearFilters: () => void;
}) {
  const { t, locale } = useI18n();

  const empty = (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <span className="grid size-11 place-items-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
        {hasAnyDrivers ? (
          <SearchX aria-hidden className="size-5" />
        ) : (
          <UserRound aria-hidden className="size-5" />
        )}
      </span>
      <div>
        <p className="text-sm font-semibold text-brand-900">
          {hasAnyDrivers ? t("drivers.table.noMatch") : t("drivers.table.empty")}
        </p>
        <p className="mt-1 text-xs text-ink-soft">
          {hasAnyDrivers ? t("drivers.table.noMatchHint") : t("drivers.table.emptyHint")}
        </p>
      </div>
      {hasAnyDrivers ? (
        <button
          type="button"
          onClick={onClearFilters}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-800 px-3.5 text-sm font-semibold text-white transition hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
        >
          {t("drivers.filter.clear")}
        </button>
      ) : null}
    </div>
  );

  const assignDisabled = (driver: DriverRow) => driver.status === "on_mission";

  return (
    <section
      aria-label={t("drivers.registry")}
      className="overflow-hidden rounded-2xl border border-line/70 bg-white shadow-soft"
    >
      <div className="flex items-center justify-between gap-3 border-b border-line/60 px-4 py-3">
        <h2 className="text-sm font-semibold text-brand-900">{t("drivers.registry")}</h2>
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
                    {t("drivers.table.driver")}
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-start font-semibold">
                    {t("drivers.table.phone")}
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-start font-semibold">
                    {t("drivers.table.ambulance")}
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-start font-semibold">
                    {t("drivers.table.status")}
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-start font-semibold">
                    {t("drivers.table.mission")}
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-end font-semibold">
                    {t("drivers.table.actions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {drivers.map((driver) => {
                  const selected = driver.id === selectedId;
                  const name = driver.full_name?.trim() || t("drivers.table.driver");
                  return (
                    <tr
                      key={driver.id}
                      onClick={() => onSelect(driver.id)}
                      aria-selected={selected}
                      className={`cursor-pointer border-t border-line/60 transition ${
                        selected ? "bg-brand-50/70" : "hover:bg-surface/60"
                      }`}
                    >
                      <td className="max-w-[220px] px-4 py-3">
                        <DriverIdentity driver={driver} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <PhoneCell driver={driver} />
                      </td>
                      <td className="max-w-[180px] px-4 py-3">
                        <AmbulanceCell driver={driver} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <DriverStatusBadge status={driver.status} />
                      </td>
                      <td className="max-w-[200px] px-4 py-3">
                        <MissionCell driver={driver} />
                      </td>
                      <td className="px-4 py-3 text-end">
                        <span className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              onSelect(driver.id);
                            }}
                            aria-label={`${t("drivers.table.show")}: ${name}`}
                            title={t("drivers.table.show")}
                            className="grid size-8 place-items-center rounded-lg border border-line text-brand-800 transition hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                          >
                            <Eye aria-hidden className="size-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              onAssign(driver);
                            }}
                            disabled={assignDisabled(driver)}
                            aria-label={`${t("drivers.assign.title")}: ${name}`}
                            title={
                              assignDisabled(driver)
                                ? t("fleet.assign.error.driverMission")
                                : t("drivers.assign.title")
                            }
                            className="grid size-8 place-items-center rounded-lg border border-line text-brand-800 transition hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white"
                          >
                            <AmbulanceIcon aria-hidden className="size-4" />
                          </button>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <ul className="divide-y divide-line/60 md:hidden">
            {drivers.map((driver) => {
              const selected = driver.id === selectedId;
              return (
                <li key={driver.id}>
                  <div
                    className={`flex w-full flex-col gap-2 px-4 py-3 text-start ${
                      selected ? "bg-brand-50/70" : ""
                    }`}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <DriverIdentity driver={driver} />
                      <DriverStatusBadge status={driver.status} />
                    </span>
                    <span className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-soft">
                      <PhoneCell driver={driver} />
                      <AmbulanceCell driver={driver} />
                    </span>
                    <span className="flex items-center justify-between gap-2">
                      <MissionCell driver={driver} />
                      <span className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onSelect(driver.id);
                          }}
                          aria-label={t("drivers.table.show")}
                          className="grid size-8 place-items-center rounded-lg border border-line text-brand-800 transition hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                        >
                          <Eye aria-hidden className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onAssign(driver);
                          }}
                          disabled={assignDisabled(driver)}
                          aria-label={t("drivers.assign.title")}
                          className="grid size-8 place-items-center rounded-lg border border-line text-brand-800 transition hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white"
                        >
                          <AmbulanceIcon aria-hidden className="size-4" />
                        </button>
                      </span>
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/60 px-4 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-xs text-ink-soft">
                {t("drivers.table.rows", {
                  from: formatInteger(from, locale),
                  to: formatInteger(to, locale),
                  total: formatInteger(total, locale),
                })}
                {" · "}
                {t("drivers.table.page", {
                  page: formatInteger(page, locale),
                  pages: formatInteger(pageCount, locale),
                })}
              </p>
              <label className="flex items-center gap-1.5 text-xs text-ink-soft">
                {t("drivers.table.pageSize")}
                <select
                  value={pageSize}
                  onChange={(event) =>
                    onPageSize(Number(event.target.value) as DriverPageSize)
                  }
                  className="h-8 rounded-lg border border-line bg-white px-2 text-xs font-semibold text-brand-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                >
                  {PAGE_SIZES.map((size) => (
                    <option key={size} value={size}>
                      {formatInteger(size, locale)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onPage(page - 1)}
                disabled={page <= 1}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-line bg-white px-2.5 text-xs font-semibold text-brand-800 transition hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronLeft aria-hidden className="size-4 rtl:rotate-180" />
                {t("drivers.table.previous")}
              </button>
              <button
                type="button"
                onClick={() => onPage(page + 1)}
                disabled={page >= pageCount}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-line bg-white px-2.5 text-xs font-semibold text-brand-800 transition hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("drivers.table.next")}
                <ChevronRight aria-hidden className="size-4 rtl:rotate-180" />
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
