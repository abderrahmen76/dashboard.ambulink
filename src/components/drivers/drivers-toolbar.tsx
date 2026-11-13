"use client";

import { Search, X } from "lucide-react";
import { useId } from "react";

import type { DriverAssignmentFilter, DriverStatusFilter } from "@/lib/drivers/types";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { useI18n } from "@/lib/i18n/provider";

const STATUS_FILTERS: Array<{ value: DriverStatusFilter; label: MessageKey }> = [
  { value: "all", label: "drivers.filter.all" },
  { value: "on_duty", label: "drivers.filter.onDuty" },
  { value: "available", label: "drivers.filter.available" },
  { value: "on_mission", label: "drivers.filter.onMission" },
  { value: "offline", label: "drivers.filter.offline" },
];

const ASSIGNMENT_FILTERS: Array<{
  value: DriverAssignmentFilter;
  label: MessageKey;
}> = [
  { value: "all", label: "drivers.filter.all" },
  { value: "assigned", label: "drivers.filter.assigned" },
  { value: "unassigned", label: "drivers.filter.unassigned" },
];

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex h-8 items-center rounded-full border px-3 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
        active
          ? "border-brand-800 bg-brand-800 text-white"
          : "border-line bg-white text-ink-soft hover:border-brand-200 hover:bg-brand-50 hover:text-brand-800"
      }`}
    >
      {children}
    </button>
  );
}

export function DriversToolbar({
  search,
  onSearch,
  status,
  onStatus,
  assignment,
  onAssignment,
  onClear,
}: {
  search: string;
  onSearch: (value: string) => void;
  status: DriverStatusFilter;
  onStatus: (value: DriverStatusFilter) => void;
  assignment: DriverAssignmentFilter;
  onAssignment: (value: DriverAssignmentFilter) => void;
  onClear: () => void;
}) {
  const { t } = useI18n();
  const inputId = useId();
  const dirty =
    search.trim().length > 0 || status !== "all" || assignment !== "all";

  return (
    <section
      aria-label={t("drivers.registry")}
      className="rounded-2xl border border-line/70 bg-white p-3 shadow-soft sm:p-4"
    >
      <div className="flex flex-col gap-3">
        <div className="relative min-w-0">
          <label htmlFor={inputId} className="sr-only">
            {t("drivers.search.label")}
          </label>
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-ink-soft"
          />
          <input
            id={inputId}
            type="search"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder={t("drivers.search.placeholder")}
            className="h-10 w-full rounded-xl border border-line bg-surface/60 ps-9 pe-9 text-sm text-ink transition focus:border-brand-400 focus:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
          />
          {search ? (
            <button
              type="button"
              onClick={() => onSearch("")}
              aria-label={t("drivers.search.clear")}
              className="absolute top-1/2 end-1.5 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-ink-soft transition hover:bg-brand-50 hover:text-brand-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <X aria-hidden className="size-4" />
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-soft">
              {t("drivers.filter.status")}
            </span>
            {STATUS_FILTERS.map(({ value, label }) => (
              <Pill
                key={value}
                active={status === value}
                onClick={() => onStatus(value)}
              >
                {t(label)}
              </Pill>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-soft">
              {t("drivers.filter.assignment")}
            </span>
            {ASSIGNMENT_FILTERS.map(({ value, label }) => (
              <Pill
                key={value}
                active={assignment === value}
                onClick={() => onAssignment(value)}
              >
                {t(label)}
              </Pill>
            ))}
          </div>

          {dirty ? (
            <button
              type="button"
              onClick={onClear}
              className="inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-xs font-semibold text-accent-700 transition hover:bg-accent-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
            >
              <X aria-hidden className="size-3.5" />
              {t("drivers.filter.clear")}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
