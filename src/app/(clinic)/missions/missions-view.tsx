"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useHospitalName } from "@/components/dashboard/hospital-name-context";
import { LanguageSelect } from "@/components/language-select";
import { MissionDetailModal } from "@/components/missions/mission-detail-modal";
import { MissionsActivityChart } from "@/components/missions/missions-activity-chart";
import { MissionsDrivers } from "@/components/missions/missions-drivers";
import { MissionsInsights } from "@/components/missions/missions-insights";
import { MissionsKpiGrid } from "@/components/missions/missions-kpi-grid";
import { MissionsStatusChart } from "@/components/missions/missions-status-chart";
import { MissionsTable } from "@/components/missions/missions-table";
import { MissionsToolbar } from "@/components/missions/missions-toolbar";
import { SignOutButton } from "@/components/sign-out-button";
import { useI18n } from "@/lib/i18n/provider";
import {
  bucketFor,
  customRangeBounds,
  rangeBounds,
  tunisYmdOf,
} from "@/lib/missions/format";
import { missionsErrorKey } from "@/lib/missions/messages";
import type {
  MissionStatusFilter,
  MissionsAnalytics,
  MissionsAnalyticsQuery,
  MissionsPageSize,
  MissionsResult,
  MissionsSort,
  RangePreset,
} from "@/lib/missions/types";
import { useMissionsAnalytics } from "@/lib/missions/use-missions-analytics";
import { useTabState } from "@/lib/navigation/tab-state";

const SEARCH_DEBOUNCE_MS = 300;

function useDebouncedText(value: string, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

type RangeState = { from: string; to: string };

export function MissionsView({
  initialPage,
  initialQuery,
}: {
  initialPage: MissionsResult<MissionsAnalytics>;
  initialQuery: MissionsAnalyticsQuery;
}) {
  return <MissionsWorkspace initialPage={initialPage} initialQuery={initialQuery} />;
}

function MissionsWorkspace({
  initialPage,
  initialQuery,
}: {
  initialPage: MissionsResult<MissionsAnalytics>;
  initialQuery: MissionsAnalyticsQuery;
}) {
  const { t } = useI18n();
  const fallbackHospitalName = useHospitalName();

  const defaultRange: RangeState = {
    from: initialQuery.from,
    to: initialQuery.to,
  };

  const [preset, setPreset] = useTabState<RangePreset>("missions:preset", "30d");
  const [customFrom, setCustomFrom] = useTabState(
    "missions:from",
    tunisYmdOf(defaultRange.from),
  );
  const [customTo, setCustomTo] = useTabState(
    "missions:to",
    tunisYmdOf(defaultRange.to),
  );

  // The window is derived on return: a preset beyond 30d is recomputed from the
  // fresh server clock, a custom window is rebuilt from the remembered dates.
  const [range, setRange] = useState<RangeState>(() => {
    if (preset === "custom") {
      if (customFrom !== "" && customTo !== "" && customFrom <= customTo) {
        return customRangeBounds(customFrom, customTo);
      }
      return defaultRange;
    }
    if (preset === "30d") return defaultRange;
    return rangeBounds(
      preset,
      initialPage.ok ? initialPage.data.server_now : new Date().toISOString(),
    );
  });

  const [search, setSearch] = useTabState("missions:search", "");
  const debouncedSearch = useDebouncedText(search, SEARCH_DEBOUNCE_MS);
  const [status, setStatus] = useTabState<MissionStatusFilter>("missions:status", "all");
  const [sort, setSort] = useTabState<MissionsSort>("missions:sort", "newest");
  const [page, setPage] = useTabState("missions:page", 1);
  const [pageSize, setPageSize] = useTabState<MissionsPageSize>("missions:pageSize", 10);
  const [selectedId, setSelectedId] = useTabState<string | null>(
    "missions:selected",
    null,
  );

  const query = useMemo<MissionsAnalyticsQuery>(
    () => ({
      from: range.from,
      to: range.to,
      bucket: bucketFor(range.from, range.to),
      status,
      search: debouncedSearch,
      sort,
      page,
      pageSize,
    }),
    [range, status, debouncedSearch, sort, page, pageSize],
  );

  const { data, error, refreshing, refresh } = useMissionsAnalytics(
    initialPage,
    query,
    initialQuery,
  );

  const hospitalName = data?.hospital.name ?? fallbackHospitalName;
  const customInvalid = customFrom !== "" && customTo !== "" && customFrom > customTo;
  // The remembered id is resolved against the payload just loaded, so a stale
  // or filtered-out mission never reopens the modal with old numbers.
  const selected =
    selectedId === null
      ? null
      : data?.missions.items.find((row) => row.id === selectedId) ?? null;

  const applyPreset = (next: RangePreset) => {
    setPreset(next);
    setPage(1);
    if (next === "custom") {
      setCustomFrom(tunisYmdOf(range.from));
      setCustomTo(tunisYmdOf(range.to));
      return;
    }
    setRange(rangeBounds(next, data?.server_now ?? new Date().toISOString()));
  };

  const applyCustomRange = (nextFrom: string, nextTo: string) => {
    if (nextFrom === "" || nextTo === "" || nextFrom > nextTo) return;
    setRange(customRangeBounds(nextFrom, nextTo));
    setPage(1);
  };

  const handleCustomFrom = (value: string) => {
    setCustomFrom(value);
    applyCustomRange(value, customTo);
  };

  const handleCustomTo = (value: string) => {
    setCustomTo(value);
    applyCustomRange(customFrom, value);
  };

  const handleStatus = (value: MissionStatusFilter) => {
    setStatus(value);
    setPage(1);
  };

  const handleSort = (value: MissionsSort) => {
    setSort(value);
    setPage(1);
  };

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handlePageSize = (value: MissionsPageSize) => {
    setPageSize(value);
    setPage(1);
  };

  // Preset windows end "now", so a refresh must move the upper bound (a custom
  // window stays exactly where the manager put it). Both updates batch into a
  // single fetch.
  const handleRefresh = () => {
    if (preset !== "custom") {
      setRange(rangeBounds(preset, new Date().toISOString()));
    }
    refresh();
  };

  const closeDetail = useCallback(() => setSelectedId(null), [setSelectedId]);

  const filtered = search.trim() !== "" || status !== "all";
  const blockingErrorCode =
    data === null && error !== null && error !== "stale" ? error : null;

  return (
    <>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
        <header className="sticky top-0 z-30 border-b border-line/80 bg-white/95 backdrop-blur">
          <div className="flex flex-wrap items-center gap-3 px-3 py-2.5 sm:px-5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-700">
                {hospitalName}
              </p>
              <h1 className="truncate text-lg font-semibold tracking-tight text-brand-900">
                {t("ma.title")}
              </h1>
              <p className="hidden truncate text-[11px] text-ink-soft sm:block">
                {t("ma.subtitle")}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <LanguageSelect />
              <SignOutButton />
            </div>
          </div>

          {error === "stale" ? (
            <p
              role="status"
              className="border-t border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-medium text-amber-800 sm:px-5"
            >
              {t("ma.error.stale")}
            </p>
          ) : null}
        </header>

        <main className="flex-1 px-3 pb-5 pt-3 sm:px-5">
          {blockingErrorCode ? (
            <div className="grid place-items-center rounded-xl border border-accent-100 bg-white px-4 py-14 text-center">
              <AlertTriangle aria-hidden className="size-7 text-accent-600" />
              <p className="mt-2 text-sm font-semibold text-brand-900">
                {t("ma.error.title")}
              </p>
              <p className="mt-1 max-w-md text-xs leading-relaxed text-ink-soft">
                {t(missionsErrorKey(blockingErrorCode))}
              </p>
              <button
                type="button"
                onClick={handleRefresh}
                className="mt-3 inline-flex h-8 items-center rounded-full border border-line px-3.5 text-xs font-semibold text-brand-800 transition hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                {t("ma.error.retry")}
              </button>
            </div>
          ) : data === null ? (
            <div className="grid min-h-72 place-items-center rounded-xl border border-line/70 bg-white text-sm text-ink-soft">
              <span className="inline-flex items-center gap-2">
                <Loader2 aria-hidden className="size-4 animate-spin" />
                {t("ma.loading")}
              </span>
            </div>
          ) : (
            <>
              <MissionsKpiGrid kpis={data.kpis} />

              <div className="mt-2.5">
                <MissionsToolbar
                  preset={preset}
                  onPreset={applyPreset}
                  customFrom={customFrom}
                  onCustomFrom={handleCustomFrom}
                  customTo={customTo}
                  onCustomTo={handleCustomTo}
                  customInvalid={customInvalid}
                  search={search}
                  onSearch={handleSearch}
                  status={status}
                  onStatus={handleStatus}
                  sort={sort}
                  onSort={handleSort}
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  updatedAt={data.server_now}
                />
              </div>

              <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px]">
                <MissionsActivityChart
                  series={data.series}
                  bucket={data.range.bucket}
                  from={data.range.from}
                  to={data.range.to}
                />
                <MissionsStatusChart statuses={data.statuses} />
              </div>

              <div className="mt-3">
                <MissionsTable
                  items={data.missions.items}
                  total={data.missions.total}
                  page={page}
                  pageSize={pageSize}
                  filtered={filtered}
                  onOpen={(row) => setSelectedId(row.id)}
                  onPage={setPage}
                  onPageSize={handlePageSize}
                />
              </div>

              <div className="mt-4">
                <MissionsInsights
                  kpis={data.kpis}
                  busiest={data.busiest}
                  trendPercent={data.trend_percent}
                  previousTotal={data.previous_total}
                  drivers={data.drivers}
                />
              </div>

              <div className="mt-2.5">
                <MissionsDrivers drivers={data.drivers} />
              </div>
            </>
          )}
        </main>
      </div>

      {selected ? (
        <MissionDetailModal row={selected} onClose={closeDetail} />
      ) : null}
    </>
  );
}
