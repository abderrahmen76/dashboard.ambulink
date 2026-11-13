"use client";

import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Minus,
  UserRound,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import { useI18n } from "@/lib/i18n/provider";
import { formatDay, formatPercent } from "@/lib/missions/format";
import type { DriverPerformance, MissionKpis } from "@/lib/missions/types";
type Insight = {
  key: string;
  label: string;
  icon: LucideIcon;
  value: string;
  sub: string;
  tone: "brand" | "emerald" | "accent" | "neutral";
  title?: string;
};

const TONES: Record<Insight["tone"], { chip: string; value: string }> = {
  brand: { chip: "bg-brand-50 text-brand-700 ring-brand-100", value: "text-brand-900" },
  emerald: {
    chip: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    value: "text-emerald-700",
  },
  accent: { chip: "bg-accent-50 text-accent-700 ring-accent-100", value: "text-accent-700" },
  neutral: { chip: "bg-surface text-ink-soft ring-line", value: "text-brand-900" },
};

export function MissionsInsights({
  kpis,
  busiest,
  trendPercent,
  previousTotal,
  drivers,
}: {
  kpis: MissionKpis;
  busiest: { date: string; count: number } | null;
  trendPercent: number | null;
  previousTotal: number | null;
  drivers: DriverPerformance[];
}) {
  const { t } = useI18n();

  const percentText = (value: number) => {
    const formatted = formatPercent(value);
    return formatted === null ? "—" : `${formatted}%`;
  };
  const rate = (value: number | null) =>
    value === null ? "—" : percentText(value);

  // "Most used" is the highest mission volume, not the driver the RPC lists first.
  const busiestDriver = drivers.reduce<DriverPerformance | null>(
    (best, driver) => (best === null || driver.total > best.total ? driver : best),
    null,
  );
  const busiestDriverName = busiestDriver
    ? busiestDriver.driver_name?.trim() || t("ma.drivers.unassigned")
    : null;

  const trendDirection =
    trendPercent === null
      ? null
      : trendPercent > 0
        ? t("ma.insights.trendUp")
        : trendPercent < 0
          ? t("ma.insights.trendDown")
          : null;

  const insights: Insight[] = [
    {
      key: "completion",
      label: t("ma.insights.completionRate"),
      icon: CheckCircle2,
      value: rate(kpis.completion_rate),
      sub: t("ma.table.count", { count: kpis.completed }),
      tone: "emerald",
    },
    {
      key: "cancellation",
      label: t("ma.insights.cancellationRate"),
      icon: XCircle,
      value: rate(kpis.cancellation_rate),
      sub: t("ma.table.count", { count: kpis.cancelled }),
      tone: "accent",
    },
    {
      key: "busiest",
      label: t("ma.insights.busiest"),
      icon: CalendarDays,
      value: busiest ? (formatDay(busiest.date, { withYear: true }) ?? "—") : "—",
      sub: busiest
        ? t("ma.insights.busiestValue", { count: busiest.count })
        : t("ma.insights.none"),
      tone: "brand",
    },
    {
      key: "driver",
      label: t("ma.insights.mostUsed"),
      icon: UserRound,
      value: busiestDriverName ?? "—",
      sub: busiestDriver
        ? t("ma.table.count", { count: busiestDriver.total })
        : t("ma.insights.none"),
      tone: "brand",
      title: busiestDriverName ?? undefined,
    },
    {
      key: "trend",
      label: t("ma.insights.trend"),
      icon:
        trendPercent === null
          ? Minus
          : trendPercent < 0
            ? ArrowDownRight
            : ArrowUpRight,
      value:
        trendPercent === null ? "—" : percentText(Math.abs(trendPercent)),
      sub:
        trendPercent === null
          ? t("ma.insights.noTrend")
          : `${trendDirection ?? "—"} · ${t("ma.table.count", {
              count: previousTotal ?? 0,
            })}`,
      tone:
        trendPercent === null ? "neutral" : trendPercent < 0 ? "accent" : "emerald",
      title:
        trendPercent === null
          ? t("ma.insights.noTrend")
          : t("ma.insights.trend"),
    },
  ];

  return (
    <section aria-label={t("ma.insights.title")} className="min-w-0">
      <h2 className="mb-2 text-sm font-semibold text-brand-900">{t("ma.insights.title")}</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        {insights.map((insight) => {
          const Icon = insight.icon;
          const tone = TONES[insight.tone];
          return (
            <div
              key={insight.key}
              className="min-w-0 rounded-xl border border-line/70 bg-white px-3 py-2.5"
            >
              <div className="flex items-center justify-between gap-1.5">
                <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-soft">
                  {insight.label}
                </p>
                <span
                  className={`grid size-6 shrink-0 place-items-center rounded-md ring-1 ${tone.chip}`}
                >
                  <Icon aria-hidden className="size-3" />
                </span>
              </div>
              <p
                title={insight.title}
                className={`mt-1 truncate text-base font-semibold ${tone.value}`}
              >
                {insight.value}
              </p>
              <p
                title={insight.sub}
                className="truncate text-[10px] text-ink-soft/80"
              >
                {insight.sub}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
