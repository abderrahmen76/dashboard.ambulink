"use client";

import { Users } from "lucide-react";

import { useI18n } from "@/lib/i18n/provider";
import { formatDurationSeconds } from "@/lib/missions/format";
import type { DriverPerformance } from "@/lib/missions/types";

const GRID = "grid grid-cols-[minmax(0,1fr)_repeat(3,3.25rem)] items-center gap-2";

export function MissionsDrivers({ drivers }: { drivers: DriverPerformance[] }) {
  const { t } = useI18n();

  return (
    <section
      aria-label={t("ma.drivers.title")}
      className="overflow-hidden rounded-xl border border-line/70 bg-white"
    >
      <header className="border-b border-line/60 px-3 py-2">
        <h2 className="text-sm font-semibold text-brand-900">{t("ma.drivers.title")}</h2>
        <p className="text-[11px] text-ink-soft">{t("ma.drivers.hint")}</p>
      </header>

      {drivers.length === 0 ? (
        <div className="grid place-items-center px-4 py-10 text-center">
          <Users aria-hidden className="size-6 text-brand-300" />
          <p className="mt-2 text-xs text-ink-soft">{t("ma.drivers.empty")}</p>
        </div>
      ) : (
        <div>
          <div className={`${GRID} bg-surface/70 px-3 py-1.5`}>
            <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-ink-soft">
              {t("ma.drivers.driver")}
            </span>
            <span className="text-end text-[9px] font-semibold uppercase tracking-[0.1em] text-ink-soft">
              {t("ma.drivers.completed")}
            </span>
            <span className="text-end text-[9px] font-semibold uppercase tracking-[0.1em] text-ink-soft">
              {t("ma.drivers.active")}
            </span>
            <span className="text-end text-[9px] font-semibold uppercase tracking-[0.1em] text-ink-soft">
              {t("ma.drivers.avg")}
            </span>
          </div>
          <ul className="divide-y divide-line/60">
            {drivers.map((driver) => (
              <li
                key={driver.driver_id}
                className={`${GRID} px-3 py-2 transition hover:bg-brand-50/40`}
              >
                <p className="truncate text-xs font-medium text-ink">
                  {driver.driver_name?.trim() || t("ma.drivers.unassigned")}
                </p>
                <span className="text-end text-xs font-semibold tabular-nums text-emerald-700">
                  {driver.completed}
                </span>
                <span className="text-end text-xs tabular-nums text-brand-800">
                  {driver.active}
                </span>
                <span className="text-end text-[11px] tabular-nums text-ink-soft">
                  {formatDurationSeconds(driver.avg_completion_seconds, t) ?? "—"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
