"use client";

import {
  Activity,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Layers,
  Timer,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import { formatInteger } from "@/lib/dashboard/format";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { useI18n } from "@/lib/i18n/provider";
import { formatDurationSeconds, formatPercent } from "@/lib/missions/format";
import type { MissionKpis } from "@/lib/missions/types";

type Tile = {
  key: string;
  label: MessageKey;
  icon: LucideIcon;
  value: string;
  sub: string | null;
  tone: "brand" | "neutral" | "emerald" | "accent";
};

const TONES: Record<Tile["tone"], { chip: string; value: string }> = {
  brand: { chip: "bg-brand-50 text-brand-700 ring-brand-100", value: "text-brand-900" },
  neutral: { chip: "bg-surface text-ink-soft ring-line", value: "text-brand-900" },
  emerald: {
    chip: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    value: "text-emerald-700",
  },
  accent: { chip: "bg-accent-50 text-accent-700 ring-accent-100", value: "text-accent-700" },
};

export function MissionsKpiGrid({ kpis }: { kpis: MissionKpis }) {
  const { t, locale } = useI18n();

  const share = (count: number) =>
    kpis.total > 0
      ? t("ma.kpi.share", {
          value: formatPercent((count / kpis.total) * 100) ?? "0",
        })
      : null;

  const average = formatDurationSeconds(kpis.avg_completion_seconds, t);

  const tiles: Tile[] = [
    {
      key: "total",
      label: "ma.kpi.total",
      icon: Layers,
      value: formatInteger(kpis.total, locale),
      sub: null,
      tone: "brand",
    },
    {
      key: "today",
      label: "ma.kpi.today",
      icon: CalendarDays,
      value: formatInteger(kpis.today, locale),
      sub: share(kpis.today),
      tone: "brand",
    },
    {
      key: "pending",
      label: "ma.kpi.pending",
      icon: Clock3,
      value: formatInteger(kpis.pending, locale),
      sub: share(kpis.pending),
      tone: "neutral",
    },
    {
      key: "accepted",
      label: "ma.kpi.accepted",
      icon: BadgeCheck,
      value: formatInteger(kpis.accepted, locale),
      sub: share(kpis.accepted),
      tone: "neutral",
    },
    {
      key: "inProgress",
      label: "ma.kpi.inProgress",
      icon: Activity,
      value: formatInteger(kpis.in_progress, locale),
      sub: share(kpis.in_progress),
      tone: "brand",
    },
    {
      key: "completed",
      label: "ma.kpi.completed",
      icon: CheckCircle2,
      value: formatInteger(kpis.completed, locale),
      sub: share(kpis.completed),
      tone: "emerald",
    },
    {
      key: "cancelled",
      label: "ma.kpi.cancelled",
      icon: XCircle,
      value: formatInteger(kpis.cancelled, locale),
      sub: share(kpis.cancelled),
      tone: "accent",
    },
    {
      key: "average",
      label: "ma.kpi.avgCompletion",
      icon: Timer,
      value: average ?? "—",
      sub: average ? t("ma.kpi.avgHint") : t("ma.kpi.noAverage"),
      tone: "brand",
    },
  ];

  return (
    <section
      aria-label={t("ma.title")}
      className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-8"
    >
      {tiles.map((tile) => {
        const Icon = tile.icon;
        const tone = TONES[tile.tone];
        return (
          <div
            key={tile.key}
            className="min-w-0 rounded-xl border border-line/70 bg-white px-3 py-2.5"
          >
            <div className="flex items-center justify-between gap-1.5">
              <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-soft">
                {t(tile.label)}
              </p>
              <span className={`grid size-6 shrink-0 place-items-center rounded-md ring-1 ${tone.chip}`}>
                <Icon aria-hidden className="size-3" />
              </span>
            </div>
            <p className={`mt-1 truncate text-xl font-semibold tabular-nums ${tone.value}`}>
              {tile.value}
            </p>
            <p className="truncate text-[10px] text-ink-soft/80">{tile.sub ?? "\u00a0"}</p>
          </div>
        );
      })}
    </section>
  );
}
