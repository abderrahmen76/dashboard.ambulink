"use client";

import {
  AlertTriangle,
  Plus,
  Radio,
  RefreshCw,
  WifiOff,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { LanguageSelect } from "@/components/language-select";
import { RefreshingHint } from "@/components/dashboard/command-bar";
import { useHospitalName } from "@/components/dashboard/hospital-name-context";
import { FleetDetails } from "@/components/fleet/fleet-details";
import { FleetDriverDialog } from "@/components/fleet/fleet-driver-dialog";
import { FleetHistory } from "@/components/fleet/fleet-history";
import { FleetKpiGrid } from "@/components/fleet/fleet-kpi-grid";
import { FleetTable } from "@/components/fleet/fleet-table";
import { FleetToolbar } from "@/components/fleet/fleet-toolbar";
import { FleetVehicleDialog } from "@/components/fleet/fleet-vehicle-dialog";
import { SignOutButton } from "@/components/sign-out-button";
import { formatTime } from "@/lib/dashboard/format";
import { fleetErrorMessageKey } from "@/lib/fleet/messages";
import {
  computeKpis,
  matchesFilter,
  matchesSearch,
} from "@/lib/fleet/status";
import type {
  FleetFilter,
  FleetResult,
  FleetSnapshot,
} from "@/lib/fleet/types";
import { useFleet, type FleetConnectionState } from "@/lib/fleet/use-fleet";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { useI18n } from "@/lib/i18n/provider";
import { useTabState } from "@/lib/navigation/tab-state";

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 200;

const CONNECTION_STYLES: Record<
  FleetConnectionState,
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

export function FleetView({
  initialSnapshot,
}: {
  initialSnapshot: FleetResult<FleetSnapshot>;
}) {
  return <FleetWorkspace initialSnapshot={initialSnapshot} />;
}

/** Mirror of the dashboard clock: server time first, local clock afterwards. */
function useClock(start: number, intervalMs: number) {
  const [now, setNow] = useState(start);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return Math.max(now, start);
}

function useDebouncedText(value: string, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

type DialogState = { kind: "add" | "edit" | "assign"; id: string | null } | null;

function FleetWorkspace({
  initialSnapshot,
}: {
  initialSnapshot: FleetResult<FleetSnapshot>;
}) {
  const { t } = useI18n();
  const fallbackHospitalName = useHospitalName();
  const { snapshot, error, connection, refreshing, updatedAt, refresh, saveAmbulance, assignDriver } =
    useFleet(initialSnapshot);

  const [search, setSearch] = useTabState("fleet:search", "");
  const debouncedSearch = useDebouncedText(search, SEARCH_DEBOUNCE_MS);
  const [filter, setFilter] = useTabState<FleetFilter>("fleet:filter", "all");
  const [page, setPage] = useTabState("fleet:page", 1);
  const [selectedId, setSelectedId] = useTabState<string | null>("fleet:selected", null);
  const [dialog, setDialog] = useState<DialogState>(null);

  const nowMs = useClock(updatedAt ?? 0, 15_000);

  const filtered = useMemo(() => {
    if (!snapshot) return [];
    return snapshot.ambulances.filter(
      (ambulance) =>
        matchesFilter(ambulance, filter) && matchesSearch(ambulance, debouncedSearch),
    );
  }, [snapshot, filter, debouncedSearch]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const from = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const to = Math.min(currentPage * PAGE_SIZE, filtered.length);
  const rows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const selected =
    snapshot?.ambulances.find((ambulance) => ambulance.id === selectedId) ?? null;
  const kpis = snapshot ? computeKpis(snapshot.ambulances) : null;
  const hospitalName = snapshot?.hospital.name ?? fallbackHospitalName;
  const dialogVehicle =
    dialog?.id != null
      ? snapshot?.ambulances.find((ambulance) => ambulance.id === dialog.id) ?? null
      : null;
  const connectionStyle = CONNECTION_STYLES[connection];

  const clearFilters = () => {
    setSearch("");
    setFilter("all");
    setPage(1);
  };

  return (
    <>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
        <header className="sticky top-0 z-30 border-b border-line/80 bg-white/95 backdrop-blur">
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-700">
                {t("fleet.badge")}
              </p>
              <h1 className="truncate text-lg font-semibold tracking-tight text-brand-900">
                {hospitalName}
              </h1>
              <p className="truncate text-xs text-ink-soft">{t("fleet.subtitle")}</p>
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

              {updatedAt ? (
                <span className="hidden text-xs text-ink-soft sm:inline">
                  {t("dc.command.updated", {
                    time: formatTime(new Date(updatedAt).toISOString(), "—"),
                  })}
                </span>
              ) : null}

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

              <button
                type="button"
                onClick={() => setDialog({ kind: "add", id: null })}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-brand-800 px-3.5 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 sm:px-4"
              >
                <Plus aria-hidden className="size-4" />
                <span className="hidden sm:inline">{t("fleet.add")}</span>
                <span className="sr-only sm:hidden">{t("fleet.add")}</span>
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 space-y-4 p-4 sm:p-6">
          {!snapshot ? (
            <section className="rounded-2xl border border-line/70 bg-white p-6 shadow-soft">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-50 text-accent-700 ring-1 ring-accent-100">
                  <AlertTriangle aria-hidden className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-semibold text-brand-900">{t("fleet.error.title")}</h2>
                  <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                    {t(fleetErrorMessageKey(error ?? "unexpected"))}
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
              {t("dc.error.stale")}
            </p>
          ) : error ? (
            <p
              role="alert"
              className="rounded-xl border border-accent-100 bg-accent-50 px-4 py-2.5 text-sm text-accent-700"
            >
              {t(fleetErrorMessageKey(error))}
            </p>
          ) : null}

          <FleetKpiGrid kpis={kpis} />

          {snapshot ? (
            <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_380px]">
              <div className="min-w-0 space-y-4 xl:col-start-1 xl:row-start-1">
                <FleetToolbar
                  search={search}
                  onSearch={(value) => {
                    setSearch(value);
                    setPage(1);
                  }}
                  filter={filter}
                  onFilter={(value) => {
                    setFilter(value);
                    setPage(1);
                  }}
                  onClear={clearFilters}
                />

                <FleetTable
                  ambulances={rows}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  page={currentPage}
                  pageCount={pageCount}
                  total={filtered.length}
                  from={from}
                  to={to}
                  onPage={setPage}
                  hasAnyVehicles={snapshot.ambulances.length > 0}
                  onAdd={() => setDialog({ kind: "add", id: null })}
                  onClearFilters={clearFilters}
                  nowMs={nowMs}
                />
              </div>

              <div className="min-w-0 xl:col-start-2 xl:row-span-2 xl:row-start-1">
                <FleetDetails
                  ambulance={selected}
                  nowMs={nowMs}
                  refreshing={refreshing}
                  onEdit={(ambulance) => setDialog({ kind: "edit", id: ambulance.id })}
                  onAssign={(ambulance) => setDialog({ kind: "assign", id: ambulance.id })}
                  onRefresh={() => void refresh()}
                />
              </div>

              <div className="min-w-0 xl:col-start-1 xl:row-start-2">
                <FleetHistory
                  ambulance={selected}
                  hospitalId={snapshot.hospital.id}
                  onSaved={() => void refresh()}
                />
              </div>
            </div>
          ) : null}
        </main>
      </div>

      {dialog?.kind === "add" ? (
        <FleetVehicleDialog
          ambulance={null}
          onClose={() => setDialog(null)}
          onSave={saveAmbulance}
          onSaved={(ambulanceId) => {
            setSearch("");
            setFilter("all");
            setPage(1);
            setSelectedId(ambulanceId);
            setDialog(null);
          }}
        />
      ) : null}

      {dialog?.kind === "edit" && dialogVehicle ? (
        <FleetVehicleDialog
          key={dialogVehicle.id}
          ambulance={dialogVehicle}
          onClose={() => setDialog(null)}
          onSave={saveAmbulance}
          onSaved={(ambulanceId) => {
            setSelectedId(ambulanceId);
            setDialog(null);
          }}
        />
      ) : null}

      {dialog?.kind === "assign" && dialogVehicle ? (
        <FleetDriverDialog
          key={dialogVehicle.id}
          ambulance={dialogVehicle}
          drivers={snapshot?.drivers ?? []}
          onClose={() => setDialog(null)}
          onAssign={assignDriver}
          onAssigned={() => setDialog(null)}
        />
      ) : null}

      <RefreshingHint refreshing={refreshing} />

      <span className="sr-only" role="status" aria-live="polite">
        {t(connectionStyle.label)}
      </span>
    </>
  );
}
