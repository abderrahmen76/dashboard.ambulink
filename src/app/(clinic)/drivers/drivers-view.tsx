"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Radio,
  RefreshCw,
  UserPlus,
  WifiOff,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

import { LanguageSelect } from "@/components/language-select";
import { RefreshingHint } from "@/components/dashboard/command-bar";
import { useHospitalName } from "@/components/dashboard/hospital-name-context";
import { SignOutButton } from "@/components/sign-out-button";
import { DriverAmbulanceDialog } from "@/components/drivers/driver-ambulance-dialog";
import { DriverCreateDialog } from "@/components/drivers/driver-create-dialog";
import { DriverDeleteDialog } from "@/components/drivers/driver-delete-dialog";
import { DriverDetails } from "@/components/drivers/driver-details";
import { DriversKpiGrid } from "@/components/drivers/drivers-kpi-grid";
import { DriversTable } from "@/components/drivers/drivers-table";
import { DriversToolbar } from "@/components/drivers/drivers-toolbar";
import { formatTime } from "@/lib/dashboard/format";
import { driverErrorMessageKey } from "@/lib/drivers/messages";
import type {
  DriverAssignmentFilter,
  DriverResult,
  DriversPage,
  DriverStatusFilter,
} from "@/lib/drivers/types";
import {
  useDriverStats,
  useDrivers,
  type DriversConnectionState,
  type DriversQuery,
} from "@/lib/drivers/use-drivers";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { useI18n } from "@/lib/i18n/provider";
import { useTabState } from "@/lib/navigation/tab-state";

const SEARCH_DEBOUNCE_MS = 200;

const CONNECTION_STYLES: Record<
  DriversConnectionState,
  { className: string; label: MessageKey; live: boolean; pulse: boolean }
> = {
  live: {
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    label: "dc.command.live",
    live: true,
    pulse: false,
  },
  connecting: {
    className: "border-amber-200 bg-amber-50 text-amber-700",
    label: "dc.command.connecting",
    live: false,
    pulse: true,
  },
  reconnecting: {
    className: "border-amber-200 bg-amber-50 text-amber-700",
    label: "dc.command.reconnecting",
    live: false,
    pulse: true,
  },
  offline: {
    className: "border-accent-100 bg-accent-50 text-accent-700",
    label: "dc.command.offline",
    live: false,
    pulse: false,
  },
};

function useDebouncedText(value: string, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

export function DriversView({
  initialPage,
  initialQuery,
}: {
  initialPage: DriverResult<DriversPage>;
  initialQuery: DriversQuery;
}) {
  return <DriversWorkspace initialPage={initialPage} initialQuery={initialQuery} />;
}

function DriversWorkspace({
  initialPage,
  initialQuery,
}: {
  initialPage: DriverResult<DriversPage>;
  initialQuery: DriversQuery;
}) {
  const { t } = useI18n();
  const fallbackHospitalName = useHospitalName();
  const [search, setSearch] = useTabState("drivers:search", "");
  const debouncedSearch = useDebouncedText(search, SEARCH_DEBOUNCE_MS);
  const [status, setStatus] = useTabState<DriverStatusFilter>("drivers:status", "all");
  const [assignment, setAssignment] = useTabState<DriverAssignmentFilter>(
    "drivers:assignment",
    "all",
  );
  const [selectedId, setSelectedId] = useTabState<string | null>("drivers:selected", null);
  const [assignId, setAssignId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createdName, setCreatedName] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [removedName, setRemovedName] = useState<string | null>(null);

  const {
    data,
    loading,
    refreshing,
    error,
    connection,
    page,
    pageSize,
    offset,
    totalCount,
    revision,
    setPage,
    setPageSize,
    refresh,
    assignDriver,
    deleteDriver,
  } = useDrivers(
    initialPage,
    { search: debouncedSearch, status, assignment },
    initialQuery,
  );

  const selected = data?.items.find((driver) => driver.id === selectedId) ?? null;
  const { stats, loading: statsLoading, error: statsError } = useDriverStats(
    selected?.id ?? null,
    revision,
  );
  const dialogDriver =
    data?.items.find((driver) => driver.id === assignId) ?? null;
  const deleteDriverRow =
    data?.items.find((driver) => driver.id === deleteId) ?? null;

  const hospitalName = data?.hospital.name ?? fallbackHospitalName;
  const connectionStyle = CONNECTION_STYLES[connection];
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  const from = totalCount === 0 ? 0 : offset + 1;
  const to = Math.min(offset + (data?.items.length ?? 0), totalCount);
  const hasAnyDrivers = (data?.kpis.total ?? 0) > 0;

  const clearFilters = () => {
    setSearch("");
    setStatus("all");
    setAssignment("all");
    setPage(1);
  };

  const handleDriverCreated = (fullName: string) => {
    setCreating(false);
    setCreatedName(fullName);
    setSearch("");
    setStatus("all");
    setAssignment("all");
    setPage(1);
    void refresh();
  };

  return (
    <>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
        <header className="sticky top-0 z-30 border-b border-line/80 bg-white/95 backdrop-blur">
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-700">
                {t("drivers.badge")}
              </p>
              <h1 className="truncate text-lg font-semibold tracking-tight text-brand-900">
                {hospitalName}
              </h1>
              <p className="truncate text-xs text-ink-soft">{t("drivers.subtitle")}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span
                role="status"
                aria-live="polite"
                className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold ${connectionStyle.className}`}
              >
                {connectionStyle.live ? (
                  <Radio aria-hidden className="size-3.5" />
                ) : (
                  <WifiOff aria-hidden className="size-3.5" />
                )}
                <span className={connectionStyle.pulse ? "animate-pulse" : undefined}>
                  {t(connectionStyle.label)}
                </span>
              </span>

              {data ? (
                <span className="hidden text-xs text-ink-soft sm:inline">
                  {t("dc.command.updated", {
                    time: formatTime(data.server_now, "—"),
                  })}
                </span>
              ) : null}

              <button
                type="button"
                onClick={() => {
                  setCreatedName(null);
                  setCreating(true);
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-brand-800 px-3 text-xs font-semibold text-white shadow-soft transition hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
              >
                <UserPlus aria-hidden className="size-3.5" />
                {t("drivers.create.action")}
              </button>

              <button
                type="button"
                onClick={() => void refresh()}
                disabled={refreshing}
                aria-label={t("dc.command.refresh")}
                className="grid size-9 place-items-center rounded-full border border-line bg-white text-brand-800 transition hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-60"
              >
                <RefreshCw aria-hidden className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
              </button>

              <LanguageSelect />
              <SignOutButton />
            </div>
          </div>
        </header>

        <main className="flex-1 space-y-4 p-4 sm:p-6">
          {createdName ? (
            <div
              role="status"
              className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800"
            >
              <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span className="min-w-0 flex-1">
                {t("drivers.create.success", { name: createdName })}
              </span>
              <button
                type="button"
                onClick={() => setCreatedName(null)}
                aria-label={t("dc.details.close")}
                className="grid size-6 shrink-0 place-items-center rounded-md text-emerald-700 transition hover:bg-emerald-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <X aria-hidden className="size-3.5" />
              </button>
            </div>
          ) : null}

          {removedName ? (
            <div
              role="status"
              className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800"
            >
              <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span className="min-w-0 flex-1">
                {t("drivers.delete.success", { name: removedName })}
              </span>
              <button
                type="button"
                onClick={() => setRemovedName(null)}
                aria-label={t("dc.details.close")}
                className="grid size-6 shrink-0 place-items-center rounded-md text-emerald-700 transition hover:bg-emerald-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <X aria-hidden className="size-3.5" />
              </button>
            </div>
          ) : null}

          {!data && !loading ? (
            <section className="rounded-2xl border border-line/70 bg-white p-6 shadow-soft">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-50 text-accent-700 ring-1 ring-accent-100">
                  <AlertTriangle aria-hidden className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-semibold text-brand-900">
                    {t("drivers.error.title")}
                  </h2>
                  <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                    {t(driverErrorMessageKey(error ?? "unexpected"))}
                  </p>
                  <button
                    type="button"
                    onClick={() => void refresh()}
                    disabled={refreshing}
                    className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg bg-brand-800 px-3.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
                  >
                    <RefreshCw aria-hidden className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
                    {t("dc.command.refresh")}
                  </button>
                </div>
              </div>
            </section>
          ) : error === "stale" ? (
            <p
              role="status"
              className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800"
            >
              {t("drivers.error.stale")}
            </p>
          ) : error && data ? (
            <p
              role="alert"
              className="rounded-xl border border-accent-100 bg-accent-50 px-4 py-2.5 text-sm text-accent-700"
            >
              {t(driverErrorMessageKey(error))}
            </p>
          ) : null}

          <DriversKpiGrid kpis={data?.kpis ?? null} />

          {data ? (
            <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_380px]">
              <div className="min-w-0 space-y-4">
                <DriversToolbar
                  search={search}
                  onSearch={(value) => {
                    setSearch(value);
                    setPage(1);
                  }}
                  status={status}
                  onStatus={(value) => {
                    setStatus(value);
                    setPage(1);
                  }}
                  assignment={assignment}
                  onAssignment={(value) => {
                    setAssignment(value);
                    setPage(1);
                  }}
                  onClear={clearFilters}
                />

                <DriversTable
                  drivers={data.items}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onAssign={(driver) => setAssignId(driver.id)}
                  page={page}
                  pageCount={pageCount}
                  total={totalCount}
                  from={from}
                  to={to}
                  onPage={setPage}
                  pageSize={pageSize}
                  onPageSize={setPageSize}
                  hasAnyDrivers={hasAnyDrivers}
                  onClearFilters={clearFilters}
                />
              </div>

              <div className="min-w-0">
                <DriverDetails
                  driver={selected}
                  stats={stats}
                  statsLoading={statsLoading}
                  statsError={statsError}
                  refreshing={refreshing}
                  onAssign={(driver) => setAssignId(driver.id)}
                  onDelete={(driver) => setDeleteId(driver.id)}
                  onRefresh={() => void refresh()}
                />
              </div>
            </div>
          ) : loading ? (
            <section
              aria-busy="true"
              aria-label={t("drivers.loading")}
              className="flex min-h-[360px] flex-col items-center justify-center gap-2 rounded-2xl border border-line/70 bg-white p-6 text-center shadow-soft"
            >
              <span className="grid size-11 place-items-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
                <Users aria-hidden className="size-5" />
              </span>
              <p className="text-sm font-semibold text-brand-900">{t("drivers.loading")}</p>
            </section>
          ) : null}
        </main>
      </div>

      {creating ? (
        <DriverCreateDialog
          hospitalName={hospitalName}
          onClose={() => setCreating(false)}
          onCreated={handleDriverCreated}
        />
      ) : null}

      {dialogDriver && data ? (
        <DriverAmbulanceDialog
          key={dialogDriver.id}
          driver={dialogDriver}
          ambulances={data.ambulances}
          onClose={() => setAssignId(null)}
          onAssign={assignDriver}
          onAssigned={() => setAssignId(null)}
        />
      ) : null}

      {deleteDriverRow ? (
        <DriverDeleteDialog
          key={deleteDriverRow.id}
          driver={deleteDriverRow}
          onClose={() => setDeleteId(null)}
          onDeactivate={async (driverId) => {
            const result = await deleteDriver(driverId);
            return result.ok ? null : result.code;
          }}
          onDeactivated={() => {
            setRemovedName(deleteDriverRow.full_name?.trim() || "—");
            setSelectedId(null);
            setDeleteId(null);
          }}
        />
      ) : null}

      <RefreshingHint refreshing={refreshing} />

      <span className="sr-only" role="status" aria-live="polite">
        {t(connectionStyle.label)}
      </span>
    </>
  );
}
