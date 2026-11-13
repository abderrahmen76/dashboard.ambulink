"use client";

import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Fuel,
  History,
  Plus,
  RefreshCw,
  Wrench,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { formatDateTime, formatInteger } from "@/lib/dashboard/format";
import { fleetErrorMessageKey } from "@/lib/fleet/messages";
import {
  createFleetFuelRecord,
  createFleetMaintenanceRecord,
} from "@/lib/fleet/service";
import type {
  CreateFuelRecordInput,
  CreateMaintenanceRecordInput,
  FleetAmbulance,
  FleetFuelHistoryPage,
  FleetFuelHistoryStats,
  FleetFuelRecord,
  FleetHistoryPageSize,
  FleetHistoryPeriod,
  FleetMaintenanceHistoryStats,
  FleetMaintenanceRecord,
  FleetRecordSaveResult,
} from "@/lib/fleet/types";
import { useVehicleHistory, type HistorySection } from "@/lib/fleet/use-history";
import type { Locale } from "@/lib/i18n/config";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { useI18n } from "@/lib/i18n/provider";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

import { FleetFuelDialog, FleetMaintenanceDialog } from "./fleet-record-dialog";

const PERIODS: FleetHistoryPeriod[] = ["month", "3m", "6m", "year", "all"];
const PAGE_SIZES: FleetHistoryPageSize[] = [20, 50, 100];
const REALTIME_DEBOUNCE_MS = 400;

const PERIOD_KEYS: Record<FleetHistoryPeriod, MessageKey> = {
  month: "fleet.history.period.month",
  "3m": "fleet.history.period.3m",
  "6m": "fleet.history.period.6m",
  year: "fleet.history.period.year",
  all: "fleet.history.period.all",
};

function numberLocale(locale: Locale): string {
  return locale === "ar" ? "ar-TN" : locale === "fr" ? "fr-TN" : "en-GB";
}

function formatDecimal(
  value: number,
  locale: Locale,
  maximumFractionDigits: number,
): string {
  return new Intl.NumberFormat(numberLocale(locale), {
    maximumFractionDigits,
    numberingSystem: "latn",
  }).format(value);
}

function formatMoney(value: number, locale: Locale): string {
  return `${formatDecimal(value, locale, 3)} TND`;
}

type DialogKind = "fuel" | "maintenance" | null;

type PanelController = Pick<
  HistorySection<FleetFuelHistoryPage>,
  | "period"
  | "pageSize"
  | "page"
  | "pageCount"
  | "totalCount"
  | "loading"
  | "refreshing"
  | "error"
  | "setPeriod"
  | "setPageSize"
  | "setPage"
  | "refresh"
>;

export function FleetHistory({
  ambulance,
  hospitalId,
  onSaved,
}: {
  ambulance: FleetAmbulance | null;
  hospitalId: string | null;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const ambulanceId = ambulance?.id ?? null;

  const { fuel, maintenance } = useVehicleHistory(ambulanceId);
  const fuelRefresh = fuel.refresh;
  const maintenanceRefresh = maintenance.refresh;

  const ambulanceIdRef = useRef(ambulanceId);
  useEffect(() => {
    ambulanceIdRef.current = ambulanceId;
  }, [ambulanceId]);

  // One channel for both record tables, filtered by the manager's hospital.
  // Rows of other vehicles, or of another hospital, never reach the client.
  useEffect(() => {
    if (!hospitalId) return;
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;

    let fuelTimer: ReturnType<typeof setTimeout> | null = null;
    let maintenanceTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleFuel = () => {
      if (fuelTimer) clearTimeout(fuelTimer);
      fuelTimer = setTimeout(() => {
        fuelTimer = null;
        fuelRefresh();
      }, REALTIME_DEBOUNCE_MS);
    };
    const scheduleMaintenance = () => {
      if (maintenanceTimer) clearTimeout(maintenanceTimer);
      maintenanceTimer = setTimeout(() => {
        maintenanceTimer = null;
        maintenanceRefresh();
      }, REALTIME_DEBOUNCE_MS);
    };
    const affectsSelection = (
      payload: RealtimePostgresChangesPayload<{ ambulance_id?: string }>,
    ) => {
      const current = ambulanceIdRef.current;
      if (!current) return false;
      const row = (payload.new ?? payload.old) as { ambulance_id?: string } | undefined;
      return !row?.ambulance_id || row.ambulance_id === current;
    };

    const channel = supabase
      .channel(`fleet-history-${hospitalId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ambulance_fuel_records",
          filter: `hospital_id=eq.${hospitalId}`,
        },
        (payload) => {
          if (affectsSelection(payload)) scheduleFuel();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "ambulance_fuel_records",
          filter: `hospital_id=eq.${hospitalId}`,
        },
        (payload) => {
          if (affectsSelection(payload)) scheduleFuel();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ambulance_maintenance_records",
          filter: `hospital_id=eq.${hospitalId}`,
        },
        (payload) => {
          if (affectsSelection(payload)) scheduleMaintenance();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "ambulance_maintenance_records",
          filter: `hospital_id=eq.${hospitalId}`,
        },
        (payload) => {
          if (affectsSelection(payload)) scheduleMaintenance();
        },
      )
      .subscribe();

    return () => {
      if (fuelTimer) clearTimeout(fuelTimer);
      if (maintenanceTimer) clearTimeout(maintenanceTimer);
      void supabase.removeChannel(channel);
    };
  }, [hospitalId, fuelRefresh, maintenanceRefresh]);

  useEffect(() => {
    if (savedAt === null) return;
    const id = setTimeout(() => setSavedAt(null), 5_000);
    return () => clearTimeout(id);
  }, [savedAt]);

  // Only the section that received the entry is refetched; the other page and
  // the registry selection stay untouched.
  const handleSaved = (kind: Exclude<DialogKind, null>) => {
    setDialog(null);
    if (kind === "fuel") fuelRefresh();
    else maintenanceRefresh();
    setSavedAt(Date.now());
    // Mileage/KPIs live one level up; the selection is kept.
    onSaved();
  };

  const saveFuel = async (
    input: CreateFuelRecordInput,
  ): Promise<FleetRecordSaveResult> => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return { ok: false, code: "unexpected" };
    return createFleetFuelRecord(supabase, input);
  };

  const saveMaintenance = async (
    input: CreateMaintenanceRecordInput,
  ): Promise<FleetRecordSaveResult> => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return { ok: false, code: "unexpected" };
    return createFleetMaintenanceRecord(supabase, input);
  };

  const vehicleLabel = ambulance
    ? [ambulance.label?.trim(), ambulance.plate_number?.trim()]
        .filter(Boolean)
        .join(" · ")
    : null;

  const fuelItems = fuel.data?.items ?? [];
  const maintenanceItems = maintenance.data?.items ?? [];

  return (
    <>
      <section
        aria-label={t("fleet.history.title")}
        className="overflow-hidden rounded-2xl border border-line/70 bg-white shadow-soft"
      >
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line/60 px-4 py-3.5 sm:px-5">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
              <History aria-hidden className="size-4" />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-brand-900">
                {t("fleet.history.title")}
              </h2>
              {ambulance ? (
                <p className="mt-0.5 truncate text-xs text-ink-soft">
                  {t("fleet.history.selected")}:{" "}
                  <span className="font-semibold text-brand-900">{vehicleLabel || "—"}</span>
                </p>
              ) : (
                <p className="mt-0.5 truncate text-xs text-ink-soft">
                  {t("fleet.history.subtitle")}
                </p>
              )}
            </div>
          </div>

          {savedAt !== null ? (
            <p
              role="status"
              className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700"
            >
              <CheckCircle2 aria-hidden className="size-3.5" />
              {t("fleet.record.success")}
            </p>
          ) : null}
        </header>

        {!ambulance ? (
          <div className="flex flex-col items-center justify-center gap-1.5 px-4 py-10 text-center">
            <p className="text-sm font-medium text-brand-900">{t("fleet.history.empty")}</p>
            <p className="text-xs text-ink-soft">{t("fleet.history.emptyHint")}</p>
          </div>
        ) : (
          <div className="divide-y divide-line/60">
            <HistoryPanel
              icon={<Fuel aria-hidden className="size-4" />}
              titleKey="fleet.fuel.title"
              addKey="fleet.fuel.add"
              onAdd={() => setDialog("fuel")}
              section={fuel}
              stats={<FuelStats stats={fuel.data?.stats ?? null} loading={fuel.loading} />}
              emptyKey="fleet.fuel.empty"
              emptyPeriodKey="fleet.fuel.emptyPeriod"
              onRetry={fuelRefresh}
            >
              {fuelItems.map((record) => (
                <FuelRow key={record.id} record={record} />
              ))}
            </HistoryPanel>

            <HistoryPanel
              icon={<Wrench aria-hidden className="size-4" />}
              titleKey="fleet.maintenance.title"
              addKey="fleet.maintenance.add"
              onAdd={() => setDialog("maintenance")}
              section={maintenance}
              stats={
                <MaintenanceStats
                  stats={maintenance.data?.stats ?? null}
                  loading={maintenance.loading}
                />
              }
              emptyKey="fleet.maintenance.empty"
              emptyPeriodKey="fleet.maintenance.emptyPeriod"
              onRetry={maintenanceRefresh}
            >
              {maintenanceItems.map((record) => (
                <MaintenanceRow key={record.id} record={record} />
              ))}
            </HistoryPanel>
          </div>
        )}
      </section>

      {ambulance && dialog === "fuel" ? (
        <FleetFuelDialog
          key={`fuel:${ambulance.id}`}
          ambulance={ambulance}
          onClose={() => setDialog(null)}
          onSave={saveFuel}
          onSaved={() => handleSaved("fuel")}
        />
      ) : null}

      {ambulance && dialog === "maintenance" ? (
        <FleetMaintenanceDialog
          key={`maintenance:${ambulance.id}`}
          ambulance={ambulance}
          onClose={() => setDialog(null)}
          onSave={saveMaintenance}
          onSaved={() => handleSaved("maintenance")}
        />
      ) : null}
    </>
  );
}

function FuelStats({
  stats,
  loading,
}: {
  stats: FleetFuelHistoryStats | null;
  loading: boolean;
}) {
  const { t, locale } = useI18n();
  if (!stats) return loading ? <StatsSkeleton /> : null;

  const priced =
    stats !== null && stats.record_count > 0 && stats.priced_count === stats.record_count;
  const measured =
    stats !== null && stats.record_count > 0 && stats.liters_count === stats.record_count;

  return (
    <StatsRow>
      <StatTile
        label={t("fleet.history.stats.cost")}
        value={priced && stats?.total_cost != null ? formatMoney(stats.total_cost, locale) : "—"}
      />
      <StatTile
        label={t("fleet.history.stats.quantity")}
        value={
          measured && stats?.total_liters != null
            ? `${formatDecimal(stats.total_liters, locale, 3)} L`
            : "—"
        }
      />
      <StatTile
        label={t("fleet.history.stats.records")}
        value={formatInteger(stats?.record_count ?? 0, locale)}
      />
      <StatTile
        label={t("fleet.history.stats.average")}
        value={priced && stats?.avg_cost != null ? formatMoney(stats.avg_cost, locale) : "—"}
      />
    </StatsRow>
  );
}

function MaintenanceStats({
  stats,
  loading,
}: {
  stats: FleetMaintenanceHistoryStats | null;
  loading: boolean;
}) {
  const { t, locale } = useI18n();
  if (!stats) return loading ? <StatsSkeleton /> : null;

  const priced =
    stats !== null && stats.record_count > 0 && stats.priced_count === stats.record_count;

  return (
    <StatsRow>
      <StatTile
        label={t("fleet.history.stats.cost")}
        value={priced && stats?.total_cost != null ? formatMoney(stats.total_cost, locale) : "—"}
      />
      <StatTile
        label={t("fleet.history.stats.records")}
        value={formatInteger(stats?.record_count ?? 0, locale)}
      />
      <StatTile
        label={t("fleet.history.stats.average")}
        value={priced && stats?.avg_cost != null ? formatMoney(stats.avg_cost, locale) : "—"}
      />
      <StatTile
        label={t("fleet.history.stats.last")}
        value={formatDateTime(stats?.last_performed_at ?? null, "—")}
      />
    </StatsRow>
  );
}

function StatsRow({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{children}</div>;
}

function StatsSkeleton() {
  return (
    <div aria-busy="true" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <div className="h-12 animate-pulse rounded-xl bg-surface" />
      <div className="h-12 animate-pulse rounded-xl bg-surface" />
      <div className="h-12 animate-pulse rounded-xl bg-surface" />
      <div className="h-12 animate-pulse rounded-xl bg-surface" />
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-surface/70 px-3 py-2">
      <p className="truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-soft">
        {label}
      </p>
      <p className="mt-0.5 truncate text-sm font-semibold text-brand-900" title={value}>
        {value}
      </p>
    </div>
  );
}

function HistoryPanel({
  icon,
  titleKey,
  addKey,
  onAdd,
  section,
  stats,
  emptyKey,
  emptyPeriodKey,
  onRetry,
  children,
}: {
  icon: ReactNode;
  titleKey: MessageKey;
  addKey: MessageKey;
  onAdd: () => void;
  section: PanelController;
  stats: ReactNode;
  emptyKey: MessageKey;
  emptyPeriodKey: MessageKey;
  onRetry: () => void;
  children: ReactNode;
}) {
  const { t, locale } = useI18n();
  const { loading, error, totalCount, page, pageCount, pageSize, period } = section;
  const from = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);
  const disabled = loading || section.refreshing;

  return (
    <section aria-label={t(titleKey)} className="px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex min-w-0 items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-soft">
          <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-surface text-brand-700">
            {icon}
          </span>
          <span className="truncate">{t(titleKey)}</span>
          {totalCount > 0 ? (
            <span className="rounded-full bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-ink-soft">
              {formatInteger(totalCount, locale)}
            </span>
          ) : null}
          {section.refreshing ? (
            <RefreshCw
              aria-hidden
              className="size-3.5 shrink-0 animate-spin text-ink-soft"
            />
          ) : null}
        </h3>

        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-1.5 text-[11px] font-medium text-ink-soft">
            <span className="sr-only sm:not-sr-only">{t("fleet.history.period.label")}</span>
            <select
              value={period}
              onChange={(event) => section.setPeriod(event.target.value as FleetHistoryPeriod)}
              className="h-8 rounded-lg border border-line bg-white px-2 text-xs font-semibold text-brand-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              {PERIODS.map((value) => (
                <option key={value} value={value}>
                  {t(PERIOD_KEYS[value])}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={onAdd}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 text-xs font-semibold text-brand-800 transition hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <Plus aria-hidden className="size-3.5" />
            {t(addKey)}
          </button>
        </div>
      </div>

      <div className="mt-3">{stats}</div>

      <div className="mt-3">
        {error && !loading ? (
          <div
            role="alert"
            className="rounded-xl border border-accent-100 bg-accent-50 p-3 text-xs text-accent-700"
          >
            <p className="flex items-start gap-1.5">
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
              {error === "migration_pending"
                ? t("fleet.history.errorMigration")
                : t(fleetErrorMessageKey(error))}
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 py-1 text-[11px] font-semibold text-brand-800 transition hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <RefreshCw aria-hidden className="size-3.5" />
              {t("fleet.records.retry")}
            </button>
          </div>
        ) : null}

        {loading ? (
          <div aria-busy="true" className="space-y-2">
            <span className="sr-only">{t("fleet.records.loading")}</span>
            <div className="h-14 animate-pulse rounded-xl bg-surface" />
            <div className="h-14 animate-pulse rounded-xl bg-surface" />
          </div>
        ) : totalCount === 0 && !error ? (
          <p className="rounded-xl bg-surface/60 px-3 py-4 text-center text-sm text-ink-soft">
            {t(period === "all" ? emptyKey : emptyPeriodKey)}
          </p>
        ) : totalCount > 0 ? (
          <ul className="max-h-[26rem] space-y-2 overflow-y-auto pe-0.5">{children}</ul>
        ) : null}
      </div>

      {!loading && totalCount > 0 ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line/50 pt-3">
          <p className="text-[11px] text-ink-soft">
            {t("fleet.table.rows", {
              from: formatInteger(from, locale),
              to: formatInteger(to, locale),
              total: formatInteger(totalCount, locale),
            })}
            {" · "}
            {t("fleet.table.page", {
              page: formatInteger(page, locale),
              pages: formatInteger(pageCount, locale),
            })}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-1 text-[11px] text-ink-soft">
              {t("fleet.history.pageSize")}
              <select
                value={pageSize}
                onChange={(event) =>
                  section.setPageSize(Number(event.target.value) as FleetHistoryPageSize)
                }
                className="h-8 rounded-lg border border-line bg-white px-1.5 text-xs font-semibold text-brand-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                {PAGE_SIZES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={() => section.setPage(page - 1)}
              disabled={disabled || page <= 1}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-line bg-white px-2.5 text-xs font-semibold text-brand-800 transition hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft aria-hidden className="size-4 rtl:rotate-180" />
              {t("fleet.table.previous")}
            </button>
            <button
              type="button"
              onClick={() => section.setPage(page + 1)}
              disabled={disabled || page >= pageCount}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-line bg-white px-2.5 text-xs font-semibold text-brand-800 transition hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("fleet.table.next")}
              <ChevronRight aria-hidden className="size-4 rtl:rotate-180" />
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function MetaRow({ children }: { children: ReactNode }) {
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-soft">
      {children}
    </div>
  );
}

function FuelRow({ record }: { record: FleetFuelRecord }) {
  const { t, locale } = useI18n();
  const title =
    record.total_price !== null
      ? formatMoney(record.total_price, locale)
      : record.liters !== null
        ? `${formatDecimal(record.liters, locale, 3)} L`
        : t("fleet.fuel.entry");

  return (
    <li className="rounded-xl bg-surface/70 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-semibold text-brand-900">{title}</p>
        <span className="shrink-0 text-[11px] text-ink-soft">
          {formatDateTime(record.recorded_at, "—")}
        </span>
      </div>

      <MetaRow>
        {record.liters !== null ? (
          <span>{t("fleet.fuel.liters", { value: formatDecimal(record.liters, locale, 3) })}</span>
        ) : null}
        {record.price_per_liter !== null ? (
          <span>
            {t("fleet.fuel.unitPrice", {
              value: formatDecimal(record.price_per_liter, locale, 3),
            })}
          </span>
        ) : null}
        {record.fuel_type?.trim() ? <span>{record.fuel_type}</span> : null}
        {record.station?.trim() ? <span>{record.station}</span> : null}
        {record.mileage !== null ? (
          <span>{`${formatInteger(record.mileage, locale)} km`}</span>
        ) : null}
      </MetaRow>

      {record.notes?.trim() ? (
        <p className="mt-1.5 text-[11px] leading-relaxed text-ink-soft">{record.notes}</p>
      ) : null}
      {record.recorded_by?.trim() ? (
        <p className="mt-1.5 text-[10px] text-ink-soft">
          {t("fleet.records.by", { name: record.recorded_by })}
        </p>
      ) : null}
    </li>
  );
}

function MaintenanceRow({ record }: { record: FleetMaintenanceRecord }) {
  const { t, locale } = useI18n();
  const title = record.maintenance_type?.trim() || t("fleet.maintenance.entry");
  const nextMileage =
    record.next_maintenance_mileage !== null
      ? formatInteger(record.next_maintenance_mileage, locale)
      : null;

  return (
    <li className="rounded-xl bg-surface/70 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-semibold text-brand-900">{title}</p>
        <span className="shrink-0 text-[11px] text-ink-soft">
          {formatDateTime(record.performed_at, "—")}
        </span>
      </div>

      <MetaRow>
        {record.price !== null ? (
          <span>
            {t("fleet.records.cost")}: {formatMoney(record.price, locale)}
          </span>
        ) : null}
        {record.mechanic_name?.trim() ? <span>{record.mechanic_name}</span> : null}
        {record.mileage !== null ? (
          <span>{`${formatInteger(record.mileage, locale)} km`}</span>
        ) : null}
        {nextMileage !== null || record.next_maintenance_on ? (
          <span>
            {t("fleet.maintenance.next")}:{" "}
            {[
              nextMileage !== null ? `${nextMileage} km` : null,
              record.next_maintenance_on,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        ) : null}
      </MetaRow>

      {record.repairs?.trim() ? (
        <p className="mt-1.5 text-[11px] leading-relaxed text-ink-soft">
          {record.repairs}
        </p>
      ) : null}
      {record.notes?.trim() ? (
        <p className="mt-1.5 text-[11px] leading-relaxed text-ink-soft">{record.notes}</p>
      ) : null}
      {record.recorded_by?.trim() ? (
        <p className="mt-1.5 text-[10px] text-ink-soft">
          {t("fleet.records.by", { name: record.recorded_by })}
        </p>
      ) : null}
    </li>
  );
}
