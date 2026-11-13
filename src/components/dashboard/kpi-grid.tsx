"use client";

import {
  Activity,
  Ambulance,
  CheckCircle2,
  Gauge,
  Siren,
  Timer,
  type LucideIcon,
} from "lucide-react";

import { formatDuration, formatInteger } from "@/lib/dashboard/format";
import type { DashboardKpis } from "@/lib/dashboard/types";
import { useI18n } from "@/lib/i18n/provider";

type Card = {
  key: string;
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
  unavailable: boolean;
  tone: string;
};

export function KpiGrid({ kpis }: { kpis: DashboardKpis | null }) {
  const { t, locale } = useI18n();
  const unavailable = t("dc.kpi.unavailable");

  const cards: Card[] = [
    {
      key: "active",
      icon: Activity,
      label: t("dc.kpi.activeMissions"),
      value: kpis ? formatInteger(kpis.active_missions, locale) : unavailable,
      hint: t("dc.kpi.activeMissionsHint"),
      unavailable: !kpis,
      tone: "bg-brand-50 text-brand-700 ring-brand-100",
    },
    {
      key: "available",
      icon: Ambulance,
      label: t("dc.kpi.available"),
      value: kpis ? formatInteger(kpis.available_ambulances, locale) : unavailable,
      hint: t("dc.kpi.availableHint"),
      unavailable: !kpis,
      tone: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    },
    {
      key: "busy",
      icon: Siren,
      label: t("dc.kpi.busy"),
      value: kpis ? formatInteger(kpis.busy_ambulances, locale) : unavailable,
      hint: t("dc.kpi.busyHint"),
      unavailable: !kpis,
      tone: "bg-amber-50 text-amber-700 ring-amber-100",
    },
    {
      key: "response",
      icon: Timer,
      label: t("dc.kpi.avgResponse"),
      value:
        kpis && kpis.avg_response_seconds !== null
          ? formatDuration(kpis.avg_response_seconds, t)
          : unavailable,
      hint:
        kpis && kpis.avg_response_seconds === null
          ? t("dc.kpi.noSamples")
          : t("dc.kpi.avgResponseHint"),
      unavailable: !kpis || kpis.avg_response_seconds === null,
      tone: "bg-violet-50 text-violet-700 ring-violet-100",
    },
    {
      key: "completed",
      icon: CheckCircle2,
      label: t("dc.kpi.completedToday"),
      value: kpis ? formatInteger(kpis.completed_today, locale) : unavailable,
      hint: t("dc.kpi.completedTodayHint"),
      unavailable: !kpis,
      tone: "bg-teal-50 text-teal-700 ring-teal-100",
    },
    {
      key: "utilization",
      icon: Gauge,
      label: t("dc.kpi.utilization"),
      value:
        kpis && kpis.fleet_utilization_percent !== null
          ? `${formatInteger(kpis.fleet_utilization_percent, locale)} %`
          : unavailable,
      hint:
        kpis && kpis.fleet_total === 0
          ? t("dc.kpi.noFleet")
          : kpis
            ? t("dc.kpi.utilizationHint", {
                busy: kpis.busy_ambulances,
                total: kpis.fleet_total,
              })
            : t("dc.kpi.utilizationHint", { busy: "—", total: "—" }),
      unavailable: !kpis || kpis.fleet_utilization_percent === null,
      tone: "bg-sky-50 text-sky-700 ring-sky-100",
    },
  ];

  return (
    <section
      aria-label={t("dc.command.badge")}
      className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6"
    >
      {cards.map(({ key, icon: Icon, label, value, hint, unavailable: missing, tone }) => (
        <article
          key={key}
          className="rounded-2xl border border-line/70 bg-white p-4 shadow-soft"
        >
          <div className="flex items-start justify-between gap-2">
            <span className={`grid size-8 place-items-center rounded-lg ring-1 ${tone}`}>
              <Icon aria-hidden className="size-4" />
            </span>
          </div>
          <p
            className={`mt-3 truncate text-2xl font-semibold tracking-tight tabular-nums ${
              missing ? "text-ink-soft/60" : "text-brand-900"
            }`}
          >
            {value}
          </p>
          <p className="mt-0.5 truncate text-xs font-medium text-ink-soft">{label}</p>
          <p className="mt-1 truncate text-[11px] text-ink-soft/80" title={hint}>
            {hint}
          </p>
        </article>
      ))}
    </section>
  );
}
