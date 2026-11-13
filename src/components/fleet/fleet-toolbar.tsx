"use client";

import { Search, X } from "lucide-react";
import { useId } from "react";

import type { FleetFilter } from "@/lib/fleet/types";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { useI18n } from "@/lib/i18n/provider";

const FILTERS: Array<{ value: FleetFilter; label: MessageKey; hint?: MessageKey }> = [
  { value: "all", label: "fleet.filter.all" },
  { value: "available", label: "fleet.filter.available" },
  { value: "assigned", label: "fleet.filter.assigned", hint: "fleet.filter.assignedHint" },
  { value: "on_mission", label: "fleet.filter.onMission" },
  { value: "maintenance", label: "fleet.filter.maintenance" },
  { value: "offline", label: "fleet.filter.offline" },
];

export function FleetToolbar({
  search,
  onSearch,
  filter,
  onFilter,
  onClear,
}: {
  search: string;
  onSearch: (value: string) => void;
  filter: FleetFilter;
  onFilter: (value: FleetFilter) => void;
  onClear: () => void;
}) {
  const { t } = useI18n();
  const inputId = useId();
  const dirty = search.trim().length > 0 || filter !== "all";

  return (
    <section
      aria-label={t("fleet.registry")}
      className="rounded-2xl border border-line/70 bg-white p-3 shadow-soft sm:p-4"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <label htmlFor={inputId} className="sr-only">
            {t("fleet.search.label")}
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
            placeholder={t("fleet.search.placeholder")}
            className="h-10 w-full rounded-xl border border-line bg-surface/60 ps-9 pe-9 text-sm text-ink transition focus:border-brand-400 focus:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
          />
          {search ? (
            <button
              type="button"
              onClick={() => onSearch("")}
              aria-label={t("fleet.search.clear")}
              className="absolute top-1/2 end-1.5 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-ink-soft transition hover:bg-brand-50 hover:text-brand-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <X aria-hidden className="size-4" />
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {FILTERS.map(({ value, label, hint }) => {
            const active = filter === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => onFilter(value)}
                aria-pressed={active}
                title={hint ? t(hint) : undefined}
                className={`inline-flex h-8 items-center rounded-full border px-3 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                  active
                    ? "border-brand-800 bg-brand-800 text-white"
                    : "border-line bg-white text-ink-soft hover:border-brand-200 hover:bg-brand-50 hover:text-brand-800"
                }`}
              >
                {t(label)}
              </button>
            );
          })}

          {dirty ? (
            <button
              type="button"
              onClick={onClear}
              className="inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-xs font-semibold text-accent-700 transition hover:bg-accent-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
            >
              <X aria-hidden className="size-3.5" />
              {t("fleet.filter.clear")}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
