"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileHeart,
  Loader2,
} from "lucide-react";

import { useI18n } from "@/lib/i18n/provider";
import {
  formatReportDateTime,
  hasText,
  shortReference,
} from "@/lib/reports/format";
import { reportErrorMessageKey, reportTypeKey } from "@/lib/reports/messages";
import type { ReportErrorCode, ReportListItem, ReportPageSize } from "@/lib/reports/types";

const PAGE_SIZES: ReportPageSize[] = [20, 50, 100];

function CardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-line/70 bg-white p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="h-3.5 w-32 rounded bg-surface-strong" />
        <div className="h-2.5 w-16 rounded bg-surface-strong" />
      </div>
      <div className="mt-2 h-2.5 w-40 rounded bg-surface-strong" />
      <div className="mt-2 h-2.5 w-full rounded bg-surface-strong" />
    </div>
  );
}

export function ReportsList({
  items,
  selectedId,
  onSelect,
  loading,
  error,
  filtered,
  count,
  onRetry,
}: {
  items: ReportListItem[];
  selectedId: string | null;
  onSelect: (reportId: string) => void;
  loading: boolean;
  error: ReportErrorCode | null;
  filtered: boolean;
  count: number;
  onRetry: () => void;
}) {
  const { t } = useI18n();
  const missing = t("reports.detail.notProvided");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-2 px-1 pb-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-800">
          {t("reports.list.panel")}
        </h2>
        <span className="inline-flex items-center gap-1 text-[11px] tabular-nums text-ink-soft">
          {loading && items.length > 0 ? (
            <Loader2 aria-hidden className="size-3 animate-spin" />
          ) : null}
          {t("reports.list.count", { count })}
        </span>
      </div>

      <div className="min-h-0 flex-1 xl:overflow-y-auto xl:pe-0.5">
        {loading && items.length === 0 ? (
          <ul className="flex flex-col gap-1.5" aria-busy="true">
            <span className="sr-only">{t("reports.list.loading")}</span>
            {Array.from({ length: 6 }).map((_, index) => (
              <li key={index}>
                <CardSkeleton />
              </li>
            ))}
          </ul>
        ) : error && items.length === 0 ? (
          <div className="rounded-xl border border-accent-100 bg-white p-6 text-center">
            <AlertTriangle aria-hidden className="mx-auto size-6 text-accent-600" />
            <p className="mt-2 text-sm font-semibold text-brand-900">
              {t("reports.error.title")}
            </p>
            <p className="mt-1 text-xs text-ink-soft">
              {t(reportErrorMessageKey(error))}
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 inline-flex h-8 items-center rounded-full border border-line px-3 text-xs font-semibold text-brand-800 transition hover:bg-brand-50"
            >
              {t("reports.refresh")}
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line bg-white/70 p-8 text-center">
            <FileHeart aria-hidden className="mx-auto size-7 text-brand-300" />
            <p className="mt-2 text-sm font-semibold text-brand-900">
              {filtered ? t("reports.list.noMatch") : t("reports.list.empty")}
            </p>
            <p className="mt-1 text-xs text-ink-soft">
              {filtered ? t("reports.list.noMatchHint") : t("reports.list.emptyHint")}
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {items.map((item) => {
              const selected = item.report_id === selectedId;
              const unseen = item.review_status === "pending";
              const typeKey = reportTypeKey(item.report_type);
              const typeLabel =
                item.report_type === "autre" && hasText(item.report_type_other)
                  ? item.report_type_other
                  : typeKey
                    ? t(typeKey)
                    : missing;

              return (
                <li key={item.report_id}>
                  <button
                    type="button"
                    onClick={() => onSelect(item.report_id)}
                    aria-current={selected ? "true" : undefined}
                    className={`w-full rounded-xl border p-2.5 text-start transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                      selected
                        ? "border-brand-400 bg-brand-50/70 ring-1 ring-brand-200"
                        : "border-line/70 bg-white hover:border-brand-200 hover:bg-brand-50/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-1.5">
                        {unseen ? (
                          <span
                            role="img"
                            aria-label={t("reports.review.pending")}
                            className="size-2 shrink-0 rounded-full bg-accent-600"
                          />
                        ) : (
                          <CheckCircle2
                            role="img"
                            aria-label={t("reports.review.reviewed")}
                            className="size-3 shrink-0 text-emerald-600"
                          />
                        )}
                        <p className="truncate text-[13px] font-semibold leading-tight text-brand-900">
                          {hasText(item.patient_full_name)
                            ? item.patient_full_name
                            : missing}
                        </p>
                      </div>
                      <span className="shrink-0 text-[10px] tabular-nums text-ink-soft">
                        {formatReportDateTime(item.transmitted_at, missing)}
                      </span>
                    </div>

                    <div className="mt-1.5 flex min-w-0 items-center gap-1.5 text-[11px] text-ink-soft">
                      <span className="rounded bg-surface px-1.5 py-0.5 font-mono text-[10px] text-brand-800">
                        {shortReference(item.mission_id)}
                      </span>
                      <span className="truncate">
                        {hasText(item.driver_name) ? item.driver_name : missing}
                      </span>
                      <span aria-hidden className="text-line">
                        ·
                      </span>
                      <span className="truncate">{typeLabel}</span>
                    </div>

                    <p className="mt-1 line-clamp-1 text-[11px] text-ink">
                      {hasText(item.transport_reason)
                        ? item.transport_reason
                        : missing}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {error && items.length > 0 ? (
        <p role="status" className="mt-2 rounded-lg bg-amber-50 px-2 py-1 text-[10px] font-medium text-amber-800">
          {t("reports.error.stale")}
        </p>
      ) : null}
    </div>
  );
}

export function ReportsPagination({
  page,
  pageSize,
  totalCount,
  visibleCount,
  onPage,
  onPageSize,
}: {
  page: number;
  pageSize: ReportPageSize;
  totalCount: number;
  visibleCount: number;
  onPage: (page: number) => void;
  onPageSize: (size: ReportPageSize) => void;
}) {
  const { t } = useI18n();
  const pages = Math.max(1, Math.ceil(totalCount / pageSize));
  const from = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min((page - 1) * pageSize + visibleCount, totalCount);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line/70 px-1 pt-2 text-[10px] text-ink-soft">
      <span className="tabular-nums">
        {t("reports.list.rows", { from, to, total: totalCount })}
      </span>

      <div className="flex items-center gap-1.5">
        <label className="inline-flex items-center gap-1">
          <span>{t("reports.list.pageSize")}</span>
          <select
            value={pageSize}
            onChange={(event) => onPageSize(Number(event.target.value) as ReportPageSize)}
            className="h-6 rounded-md border border-line bg-white px-1 text-[10px] text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => onPage(page - 1)}
            disabled={page <= 1}
            aria-label={t("reports.list.previous")}
            className="grid size-6 place-items-center rounded-md border border-line bg-white text-brand-800 transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft aria-hidden className="size-3.5 rtl:rotate-180" />
          </button>
          <span className="px-1 tabular-nums">
            {t("reports.list.page", { page, pages })}
          </span>
          <button
            type="button"
            onClick={() => onPage(page + 1)}
            disabled={page >= pages}
            aria-label={t("reports.list.next")}
            className="grid size-6 place-items-center rounded-md border border-line bg-white text-brand-800 transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight aria-hidden className="size-3.5 rtl:rotate-180" />
          </button>
        </div>
      </div>
    </div>
  );
}
