"use client";

import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

import type { MessageKey } from "@/lib/i18n/dictionaries";
import { useI18n } from "@/lib/i18n/provider";
import type {
  ReportDriverOption,
  ReportReviewFilter,
  ReportSort,
  ReportTypeFilter,
} from "@/lib/reports/types";

const REVIEW_FILTERS: Array<{ value: ReportReviewFilter; label: MessageKey }> = [
  { value: "all", label: "reports.filter.all" },
  { value: "pending", label: "reports.filter.unseen" },
  { value: "reviewed", label: "reports.filter.seen" },
];

const TYPE_FILTERS: Array<{ value: ReportTypeFilter; label: MessageKey }> = [
  { value: "all", label: "reports.filter.all" },
  { value: "urgence", label: "reports.type.urgence" },
  { value: "transfert", label: "reports.type.transfert" },
  { value: "retour_domicile", label: "reports.type.retour_domicile" },
  { value: "consultation", label: "reports.type.consultation" },
  { value: "hospitalisation", label: "reports.type.hospitalisation" },
  { value: "autre", label: "reports.type.autre" },
];

const SORT_FILTERS: Array<{ value: ReportSort; label: MessageKey }> = [
  { value: "newest", label: "reports.sort.newest" },
  { value: "oldest", label: "reports.sort.oldest" },
];

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-soft">
        {label}
      </span>
      {children}
    </label>
  );
}

const CONTROL =
  "h-8 w-full min-w-0 rounded-lg border border-line bg-white px-2 text-xs text-ink transition focus:border-brand-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:opacity-60";

export function ReportsToolbar({
  search,
  onSearch,
  review,
  onReview,
  type,
  onType,
  driverId,
  onDriver,
  from,
  onFrom,
  to,
  onTo,
  sort,
  onSort,
  drivers,
  onClear,
  rangeInvalid,
}: {
  search: string;
  onSearch: (value: string) => void;
  review: ReportReviewFilter;
  onReview: (value: ReportReviewFilter) => void;
  type: ReportTypeFilter;
  onType: (value: ReportTypeFilter) => void;
  driverId: string | null;
  onDriver: (value: string | null) => void;
  from: string;
  onFrom: (value: string) => void;
  to: string;
  onTo: (value: string) => void;
  sort: ReportSort;
  onSort: (value: ReportSort) => void;
  drivers: ReportDriverOption[];
  onClear: () => void;
  rangeInvalid: boolean;
}) {
  const { t } = useI18n();
  const searchId = useId();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const dirty =
    search.trim().length > 0 ||
    review !== "all" ||
    type !== "all" ||
    driverId !== null ||
    from !== "" ||
    to !== "" ||
    sort !== "newest";
  const advancedCount = [
    type !== "all",
    driverId !== null,
    from !== "",
    to !== "",
    sort !== "newest",
  ].filter(Boolean).length;

  return (
    <section
      aria-label={t("reports.search.label")}
      className="rounded-xl border border-line/70 bg-white px-2.5 py-2"
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[11rem] flex-1">
          <label htmlFor={searchId} className="sr-only">
            {t("reports.search.label")}
          </label>
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 start-2.5 size-4 -translate-y-1/2 text-ink-soft"
          />
          <input
            id={searchId}
            type="search"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder={t("reports.search.placeholder")}
            className="h-9 w-full rounded-lg border border-line bg-surface/60 ps-8 pe-8 text-sm text-ink transition focus:border-brand-400 focus:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
          />
          {search ? (
            <button
              type="button"
              onClick={() => onSearch("")}
              aria-label={t("reports.search.clear")}
              className="absolute top-1/2 end-1 grid size-7 -translate-y-1/2 place-items-center rounded-md text-ink-soft transition hover:bg-brand-50 hover:text-brand-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <X aria-hidden className="size-4" />
            </button>
          ) : null}
        </div>

        <div
          role="group"
          aria-label={t("reports.filter.review")}
          className="inline-flex shrink-0 items-center rounded-lg bg-surface p-0.5"
        >
          {REVIEW_FILTERS.map(({ value, label }) => {
            const active = review === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => onReview(value)}
                aria-pressed={active}
                className={`h-8 rounded-md px-2.5 text-[11px] font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                  active
                    ? "bg-white text-brand-800 shadow-soft"
                    : "text-ink-soft hover:text-brand-800"
                }`}
              >
                {t(label)}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setAdvancedOpen((open) => !open)}
          aria-expanded={advancedOpen}
          className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
            advancedOpen || advancedCount > 0
              ? "border-brand-300 bg-brand-50 text-brand-800"
              : "border-line bg-white text-ink-soft hover:bg-brand-50 hover:text-brand-800"
          }`}
        >
          <SlidersHorizontal aria-hidden className="size-3.5" />
          <span className="hidden sm:inline">{t("reports.filter.advanced")}</span>
          {advancedCount > 0 ? (
            <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-800 px-1 text-[9px] font-bold text-white">
              {advancedCount}
            </span>
          ) : null}
          <ChevronDown
            aria-hidden
            className={`size-3.5 transition ${advancedOpen ? "rotate-180" : ""}`}
          />
        </button>

        <button
          type="button"
          onClick={onClear}
          disabled={!dirty}
          title={t("reports.filter.clear")}
          aria-label={t("reports.filter.clear")}
          className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-white text-ink-soft transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>

      {advancedOpen ? (
        <div className="mt-2 grid gap-2 border-t border-line/60 pt-2 sm:grid-cols-2 lg:grid-cols-5">
          <Field label={t("reports.filter.type")}>
            <select
              value={type}
              onChange={(event) => onType(event.target.value as ReportTypeFilter)}
              className={CONTROL}
            >
              {TYPE_FILTERS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {t(label)}
                </option>
              ))}
            </select>
          </Field>

          <Field label={t("reports.filter.driver")}>
            <select
              value={driverId ?? ""}
              onChange={(event) => onDriver(event.target.value || null)}
              className={CONTROL}
            >
              <option value="">{t("reports.filter.all")}</option>
              {drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.name ?? driver.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </Field>

          <Field label={t("reports.filter.from")}>
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(event) => onFrom(event.target.value)}
              title={t("reports.filter.dateHint")}
              className={CONTROL}
            />
          </Field>

          <Field label={t("reports.filter.to")}>
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(event) => onTo(event.target.value)}
              title={t("reports.filter.dateHint")}
              className={CONTROL}
            />
          </Field>

          <Field label={t("reports.sort.label")}>
            <select
              value={sort}
              onChange={(event) => onSort(event.target.value as ReportSort)}
              className={CONTROL}
            >
              {SORT_FILTERS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {t(label)}
                </option>
              ))}
            </select>
          </Field>
        </div>
      ) : null}

      {rangeInvalid ? (
        <p role="alert" className="mt-1.5 text-[11px] font-medium text-accent-600">
          {t("reports.filter.invalidRange")}
        </p>
      ) : null}
    </section>
  );
}
