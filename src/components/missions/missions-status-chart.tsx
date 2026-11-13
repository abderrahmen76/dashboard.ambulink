"use client";

import { formatInteger } from "@/lib/dashboard/format";
import { useI18n } from "@/lib/i18n/provider";
import { formatPercent } from "@/lib/missions/format";
import { missionStatusLabel } from "@/lib/missions/messages";
import type { MissionStatus, MissionStatusCount } from "@/lib/missions/types";

const STATUS_COLORS: Record<MissionStatus, string> = {
  requested: "#cbd5e1",
  accepted: "#94a3b8",
  en_route: "#7fb3d9",
  arrived: "#4f8fc4",
  in_progress: "#00478d",
  completed: "#059669",
  cancelled: "#dc2626",
};

export function MissionsStatusChart({ statuses }: { statuses: MissionStatusCount[] }) {
  const { t, locale } = useI18n();

  const active = statuses.filter((entry) => entry.count > 0);
  const total = active.reduce((sum, entry) => sum + entry.count, 0);
  const segments = active.map((entry, index) => ({
    ...entry,
    percent: (entry.count / total) * 100,
    offset:
      (active.slice(0, index).reduce((sum, previous) => sum + previous.count, 0) /
        total) *
      100,
  }));

  return (
    <section
      aria-label={t("ma.chart.statusTitle")}
      className="min-w-0 rounded-xl border border-line/70 bg-white px-3 py-2.5"
    >
      <h2 className="text-sm font-semibold text-brand-900">{t("ma.chart.statusTitle")}</h2>

      {total === 0 ? (
        <p className="grid h-44 place-items-center text-xs italic text-ink-soft/70">
          {t("ma.chart.statusEmpty")}
        </p>
      ) : (
        <div className="mt-2 flex flex-col items-center gap-3 sm:flex-row lg:flex-col xl:flex-row">
          <div className="relative grid size-32 shrink-0 place-items-center">
            <svg
              viewBox="0 0 42 42"
              className="size-32"
              role="img"
              aria-label={`${t("ma.chart.statusTitle")}: ${formatInteger(total, locale)}`}
            >
              <circle
                cx="21"
                cy="21"
                r="15.9155"
                fill="none"
                stroke="#eef2f7"
                strokeWidth="5.5"
              />
              <g transform="rotate(-90 21 21)">
                {segments.map((segment) => (
                  <circle
                    key={segment.status}
                    cx="21"
                    cy="21"
                    r="15.9155"
                    fill="none"
                    stroke={STATUS_COLORS[segment.status]}
                    strokeWidth="5.5"
                    strokeDasharray={`${segment.percent} ${100 - segment.percent}`}
                    strokeDashoffset={-segment.offset}
                  />
                ))}
              </g>
            </svg>
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="text-center">
                <p className="text-xl font-semibold tabular-nums text-brand-900">
                  {formatInteger(total, locale)}
                </p>
                <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-ink-soft">
                  {t("ma.chart.total")}
                </p>
              </div>
            </div>
          </div>

          <ul className="min-w-0 flex-1 space-y-1 self-stretch">
            {segments.map((segment) => (
              <li key={segment.status} className="flex items-center gap-1.5 text-[11px]">
                <span
                  aria-hidden
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: STATUS_COLORS[segment.status] }}
                />
                <span className="min-w-0 flex-1 truncate text-ink-soft">
                  {t(missionStatusLabel(segment.status))}
                </span>
                <span className="shrink-0 font-medium tabular-nums text-ink">
                  {formatInteger(segment.count, locale)}
                </span>
                <span className="w-10 shrink-0 text-end text-[10px] tabular-nums text-ink-soft/70">
                  {formatPercent(segment.percent)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
