"use client";

import { Loader2, RefreshCw, Search, X } from "lucide-react";
import { useId } from "react";

import { formatTime } from "@/lib/dashboard/format";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { useI18n } from "@/lib/i18n/provider";
import { missionStatusLabel } from "@/lib/missions/messages";
import {
  MISSION_STATUSES,
  type MissionStatusFilter,
  type MissionsSort,
  type RangePreset,
} from "@/lib/missions/types";

const PRESETS: Array<{ value: Exclude<RangePreset, "custom">; label: MessageKey }> = [
  { value: "today", label: "ma.range.today" },
  { value: "7d", label: "ma.range.7d" },
  { value: "30d", label: "ma.range.30d" },
  { value: "year", label: "ma.range.year" },
];

const CONTROL =
  "h-8 min-w-0 rounded-lg border border-line bg-white px-2 text-xs text-ink transition focus:border-brand-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:opacity-60";

export function MissionsToolbar({
  preset,
  onPreset,
  customFrom,
  onCustomFrom,
  customTo,
  onCustomTo,
  customInvalid,
  search,
  onSearch,
  status,
  onStatus,
  sort,
  onSort,
  refreshing,
  onRefresh,
  updatedAt,
}: {
  preset: RangePreset;
  onPreset: (preset: RangePreset) => void;
  customFrom: string;
  onCustomFrom: (value: string) => void;
  customTo: string;
  onCustomTo: (value: string) => void;
  customInvalid: boolean;
  search: string;
  onSearch: (value: string) => void;
  status: MissionStatusFilter;
  onStatus: (value: MissionStatusFilter) => void;
  sort: MissionsSort;
  onSort: (value: MissionsSort) => void;
  refreshing: boolean;
  onRefresh: () => void;
  updatedAt: string | null;
}) {
  const { t } = useI18n();
  const searchId = useId();

  return (
    <section
      aria-label={t("ma.range.label")}
      className="rounded-xl border border-line/70 bg-white px-2.5 py-2"
    >
      <div className="flex flex-wrap items-center gap-2">
        <div
          role="group"
          aria-label={t("ma.range.label")}
          className="inline-flex flex-wrap items-center gap-0.5 rounded-lg bg-surface p-0.5"
        >
          {PRESETS.map(({ value, label }) => {
            const active = preset === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => onPreset(value)}
                aria-pressed={active}
                className={`h-7 rounded-md px-2.5 text-[11px] font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                  active
                    ? "bg-white text-brand-800 shadow-soft"
                    : "text-ink-soft hover:text-brand-800"
                }`}
              >
                {t(label)}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => onPreset("custom")}
            aria-pressed={preset === "custom"}
            className={`h-7 rounded-md px-2.5 text-[11px] font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
              preset === "custom"
                ? "bg-white text-brand-800 shadow-soft"
                : "text-ink-soft hover:text-brand-800"
            }`}
          >
            {t("ma.range.custom")}
          </button>
        </div>

        <div className="ms-auto flex shrink-0 items-center gap-2">
          <span className="hidden text-[11px] text-ink-soft sm:inline">
            {t("ma.updated", { time: formatTime(updatedAt, "—") })}
          </span>
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            aria-label={t("ma.refresh")}
            className="grid size-8 place-items-center rounded-lg border border-line bg-white text-brand-800 transition hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-60"
          >
            {refreshing ? (
              <Loader2 aria-hidden className="size-4 animate-spin" />
            ) : (
              <RefreshCw aria-hidden className="size-4" />
            )}
          </button>
        </div>
      </div>

      {preset === "custom" ? (
        <div className="mt-2 flex flex-wrap items-end gap-2 border-t border-line/60 pt-2">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-soft">
              {t("ma.range.from")}
            </span>
            <input
              type="date"
              value={customFrom}
              max={customTo || undefined}
              onChange={(event) => onCustomFrom(event.target.value)}
              className={CONTROL}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-soft">
              {t("ma.range.to")}
            </span>
            <input
              type="date"
              value={customTo}
              min={customFrom || undefined}
              onChange={(event) => onCustomTo(event.target.value)}
              className={CONTROL}
            />
          </label>
          {customInvalid ? (
            <p role="alert" className="pb-1.5 text-[11px] font-medium text-accent-600">
              {t("ma.range.invalid")}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-line/60 pt-2">
        <div className="relative min-w-[10rem] flex-1">
          <label htmlFor={searchId} className="sr-only">
            {t("ma.search.label")}
          </label>
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 start-2.5 size-3.5 -translate-y-1/2 text-ink-soft"
          />
          <input
            id={searchId}
            type="search"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder={t("ma.search.placeholder")}
            className="h-8 w-full rounded-lg border border-line bg-surface/60 ps-8 pe-8 text-xs text-ink transition focus:border-brand-400 focus:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
          />
          {search ? (
            <button
              type="button"
              onClick={() => onSearch("")}
              aria-label={t("ma.search.label")}
              className="absolute top-1/2 end-1 grid size-6 -translate-y-1/2 place-items-center rounded-md text-ink-soft transition hover:bg-brand-50 hover:text-brand-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <X aria-hidden className="size-3.5" />
            </button>
          ) : null}
        </div>

        <label className="flex shrink-0 items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-soft">
            {t("ma.filter.status")}
          </span>
          <select
            value={status}
            onChange={(event) => onStatus(event.target.value as MissionStatusFilter)}
            className={`${CONTROL} pe-6`}
          >
            <option value="all">{t("ma.filter.allStatuses")}</option>
            {MISSION_STATUSES.map((value) => (
              <option key={value} value={value}>
                {t(missionStatusLabel(value))}
              </option>
            ))}
          </select>
        </label>

        <label className="flex shrink-0 items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-soft">
            {t("ma.sort.label")}
          </span>
          <select
            value={sort}
            onChange={(event) => onSort(event.target.value as MissionsSort)}
            className={`${CONTROL} pe-6`}
          >
            <option value="newest">{t("ma.sort.newest")}</option>
            <option value="oldest">{t("ma.sort.oldest")}</option>
          </select>
        </label>
      </div>
    </section>
  );
}
