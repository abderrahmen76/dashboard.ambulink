"use client";

import { AlertTriangle, FileHeart, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { useHospitalName } from "@/components/dashboard/hospital-name-context";
import { LanguageSelect } from "@/components/language-select";
import { MedicalReportViewer } from "@/components/reports/medical-report-viewer";
import { ReportsKpiGrid } from "@/components/reports/reports-kpi-grid";
import { ReportsList, ReportsPagination } from "@/components/reports/reports-list";
import { ReportsToolbar } from "@/components/reports/reports-toolbar";
import { SignOutButton } from "@/components/sign-out-button";
import { formatTime } from "@/lib/dashboard/format";
import { useI18n } from "@/lib/i18n/provider";
import { useTabState } from "@/lib/navigation/tab-state";
import { reportErrorMessageKey } from "@/lib/reports/messages";
import type {
  ReportResult,
  ReportsPage,
  ReportReviewFilter,
  ReportSort,
  ReportTypeFilter,
} from "@/lib/reports/types";
import { useReportDetail, useReports } from "@/lib/reports/use-reports";
import { INBOX_CHANGED_EVENT } from "@/lib/reports/use-unseen";
import type { ReportsQuery } from "@/lib/reports/service";

const SEARCH_DEBOUNCE_MS = 300;
const EMPTY_FALLBACK = "—";

function useDebouncedText(value: string, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export function ReportsView({
  initialPage,
  initialQuery,
}: {
  initialPage: ReportResult<ReportsPage>;
  initialQuery: ReportsQuery;
}) {
  return <ReportsWorkspace initialPage={initialPage} initialQuery={initialQuery} />;
}

function ReportsWorkspace({
  initialPage,
  initialQuery,
}: {
  initialPage: ReportResult<ReportsPage>;
  initialQuery: ReportsQuery;
}) {
  const { t } = useI18n();
  const fallbackHospitalName = useHospitalName();

  const [search, setSearch] = useTabState("reports:search", "");
  const debouncedSearch = useDebouncedText(search, SEARCH_DEBOUNCE_MS);
  const [review, setReview] = useTabState<ReportReviewFilter>("reports:review", "all");
  const [type, setType] = useTabState<ReportTypeFilter>("reports:type", "all");
  const [driverId, setDriverId] = useTabState<string | null>("reports:driver", null);
  const [from, setFrom] = useTabState("reports:from", "");
  const [to, setTo] = useTabState("reports:to", "");
  const [sort, setSort] = useTabState<ReportSort>("reports:sort", "newest");
  const [selectedReportId, setSelectedReportId] = useTabState<string | null>(
    "reports:selected",
    null,
  );
  const [selectedRevision, setSelectedRevision] = useTabState<number | null>(
    "reports:revision",
    null,
  );
  const scrollRef = useRef<HTMLDivElement>(null);

  const rangeInvalid = from !== "" && to !== "" && from > to;

  const query = useMemo(
    () => ({
      search: debouncedSearch,
      review,
      type,
      driverId,
      from: rangeInvalid ? "" : from,
      to: rangeInvalid ? "" : to,
      sort,
    }),
    [debouncedSearch, driverId, from, rangeInvalid, review, sort, to, type],
  );

  const {
    data,
    loading,
    refreshing,
    error,
    page,
    pageSize,
    totalCount,
    revision,
    setPage,
    setPageSize,
    refresh,
  } = useReports(initialPage, query, initialQuery);

  const {
    detail,
    loading: detailLoading,
    error: detailError,
    consult,
    markUnseen,
  } = useReportDetail(selectedReportId, selectedRevision, revision);

  const notifyInboxChanged = () => {
    window.dispatchEvent(
      new CustomEvent(INBOX_CHANGED_EVENT, { detail: { silent: true } }),
    );
  };

  const scrollToTop = () => {
    if (window.matchMedia("(max-width: 1279px)").matches) {
      scrollRef.current?.scrollTo({ top: 0 });
    }
  };

  const hospitalName = data?.hospital.name ?? fallbackHospitalName;
  const items = data?.items ?? [];
  const filtered =
    search.trim().length > 0 ||
    review !== "all" ||
    type !== "all" ||
    driverId !== null ||
    from !== "" ||
    to !== "";

  const clearFilters = () => {
    setSearch("");
    setReview("all");
    setType("all");
    setDriverId(null);
    setFrom("");
    setTo("");
    setSort("newest");
    setPage(1);
  };

  const handleSelectReport = (reportId: string) => {
    setSelectedReportId(reportId);
    setSelectedRevision(null);
    scrollToTop();
  };

  const handleBack = () => {
    setSelectedReportId(null);
    setSelectedRevision(null);
    scrollToTop();
  };

  return (
    <div
      ref={scrollRef}
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto xl:overflow-hidden"
    >
      <header className="sticky top-0 z-30 border-b border-line/80 bg-white/95 backdrop-blur">
            <div className="flex flex-wrap items-center gap-3 px-3 py-2.5 sm:px-5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-700">
                  {hospitalName}
                </p>
                <h1 className="truncate text-lg font-semibold tracking-tight text-brand-900">
                  {t("reports.badge")}
                </h1>
                <p className="hidden truncate text-[11px] text-ink-soft sm:block">
                  {t("reports.header.subtitle")}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {data ? (
                  <span className="hidden text-[11px] text-ink-soft md:inline">
                    {t("reports.updated", {
                      time: formatTime(data.server_now, EMPTY_FALLBACK),
                    })}
                  </span>
                ) : null}

                <button
                  type="button"
                  onClick={() => refresh()}
                  disabled={refreshing}
                  aria-label={t("reports.refresh")}
                  className="grid size-9 place-items-center rounded-full border border-line bg-white text-brand-800 transition hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-60"
                >
                  <RefreshCw
                    aria-hidden
                    className={`size-4 ${refreshing ? "animate-spin" : ""}`}
                  />
                </button>

                <LanguageSelect />
                <SignOutButton />
              </div>
            </div>

            {error && data ? (
              <p
                role="status"
                className="border-t border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-medium text-amber-800 sm:px-5"
              >
                {t("reports.error.stale")}
              </p>
            ) : null}
          </header>

          <main className="flex min-h-0 flex-1 flex-col px-3 pb-3 pt-3 sm:px-5 sm:pb-5">
            <ReportsKpiGrid kpis={data?.kpis ?? null} />

            <div className="mt-2.5">
              <ReportsToolbar
                search={search}
                onSearch={setSearch}
                review={review}
                onReview={setReview}
                type={type}
                onType={setType}
                driverId={driverId}
                onDriver={setDriverId}
                from={from}
                onFrom={setFrom}
                to={to}
                onTo={setTo}
                sort={sort}
                onSort={setSort}
                drivers={data?.drivers ?? []}
                onClear={clearFilters}
                rangeInvalid={rangeInvalid}
              />
            </div>

            <div className="mt-3 min-h-0 flex-1">
              <div className="grid gap-3 xl:h-full xl:grid-cols-[minmax(320px,370px)_minmax(0,1fr)]">
                <section
                  aria-label={t("reports.list.panel")}
                  className={`min-w-0 flex-col rounded-xl border border-line/70 bg-white/70 p-2 xl:h-full xl:min-h-0 ${
                    selectedReportId ? "hidden xl:flex" : "flex"
                  }`}
                >
                  <ReportsList
                    items={items}
                    selectedId={selectedReportId}
                    onSelect={handleSelectReport}
                    loading={loading}
                    error={error}
                    filtered={filtered}
                    count={totalCount}
                    onRetry={() => refresh()}
                  />
                  {totalCount > 0 ? (
                    <div className="mt-1.5">
                      <ReportsPagination
                        page={page}
                        pageSize={pageSize}
                        totalCount={totalCount}
                        visibleCount={items.length}
                        onPage={setPage}
                        onPageSize={setPageSize}
                      />
                    </div>
                  ) : null}
                </section>

                <section
                  aria-label={t("reports.detail.empty")}
                  className={`min-w-0 xl:h-full xl:min-h-0 xl:overflow-y-auto ${
                    selectedReportId ? "block" : "hidden xl:block"
                  }`}
                >
                  {selectedReportId === null ? (
                    <div className="grid min-h-64 place-items-center rounded-xl border border-dashed border-line bg-white/70 p-8 text-center xl:h-full">
                      <div>
                        <FileHeart aria-hidden className="mx-auto size-8 text-brand-300" />
                        <p className="mt-2 text-sm font-semibold text-brand-900">
                          {t("reports.detail.empty")}
                        </p>
                        <p className="mt-1 max-w-sm text-xs text-ink-soft">
                          {t("reports.detail.emptyHint")}
                        </p>
                      </div>
                    </div>
                  ) : detailLoading ? (
                    <div className="grid min-h-64 place-items-center rounded-xl border border-line/70 bg-white p-6 text-sm text-ink-soft xl:h-full">
                      <span className="inline-flex items-center gap-2">
                        <Loader2 aria-hidden className="size-4 animate-spin" />
                        {t("reports.detail.loading")}
                      </span>
                    </div>
                  ) : detail ? (
                    <MedicalReportViewer
                      detail={detail}
                      selectedRevision={detail.report.revision_no}
                      onSelectRevision={setSelectedRevision}
                      onConsult={async () => {
                        const result = await consult();
                        if (result.ok) {
                          refresh();
                          notifyInboxChanged();
                        }
                        return result;
                      }}
                      onMarkUnseen={async () => {
                        const result = await markUnseen();
                        if (result.ok) {
                          refresh();
                          notifyInboxChanged();
                        }
                        return result;
                      }}
                      onRefresh={() => refresh()}
                      onBack={handleBack}
                    />
                  ) : (
                    <div className="rounded-xl border border-accent-100 bg-white p-6 text-center">
                      <AlertTriangle
                        aria-hidden
                        className="mx-auto size-6 text-accent-600"
                      />
                      <p className="mt-2 text-sm font-semibold text-brand-900">
                        {t("reports.detail.errorTitle")}
                      </p>
                      <p className="mt-1 text-xs text-ink-soft">
                        {t(reportErrorMessageKey(detailError ?? "unexpected"))}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => refresh()}
                          className="inline-flex h-8 items-center rounded-full border border-line px-3 text-xs font-semibold text-brand-800 transition hover:bg-brand-50"
                        >
                          {t("reports.refresh")}
                        </button>
                        <button
                          type="button"
                          onClick={handleBack}
                          className="inline-flex h-8 items-center rounded-full px-3 text-xs font-semibold text-ink-soft transition hover:text-brand-800 xl:hidden"
                        >
                          {t("reports.detail.back")}
                        </button>
                      </div>
                    </div>
                  )}
                </section>
              </div>
            </div>
          </main>
    </div>
  );
}
