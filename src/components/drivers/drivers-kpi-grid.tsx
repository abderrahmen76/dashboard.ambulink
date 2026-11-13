"use client";

import {
  CheckCircle2,
  Radio,
  Siren,
  Users,
  type LucideIcon,
} from "lucide-react";

import { formatInteger } from "@/lib/dashboard/format";
import type { DriversKpis } from "@/lib/drivers/types";
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

export function DriversKpiGrid({ kpis }: { kpis: DriversKpis | null }) {
  const { t, locale } = useI18n();
  const unavailable = t("dc.kpi.unavailable");

  const cards: Card[] = [
    {
      key: "total",
      icon: Users,
      label: t("drivers.kpi.total"),
      value: kpis ? formatInteger(kpis.total, locale) : unavailable,
      hint: t("drivers.kpi.totalHint"),
      unavailable: !kpis,
      tone: "bg-brand-50 text-brand-700 ring-brand-100",
    },
    {
      key: "online",
      icon: Radio,
      label: t("drivers.kpi.online"),
      value: kpis ? formatInteger(kpis.online, locale) : unavailable,
      hint: t("drivers.kpi.onlineHint"),
      unavailable: !kpis,
      tone: "bg-sky-50 text-sky-700 ring-sky-100",
    },
    {
      key: "available",
      icon: CheckCircle2,
      label: t("drivers.kpi.available"),
      value: kpis ? formatInteger(kpis.available, locale) : unavailable,
      hint: t("drivers.kpi.availableHint"),
      unavailable: !kpis,
      tone: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    },
    {
      key: "mission",
      icon: Siren,
      label: t("drivers.kpi.onMission"),
      value: kpis ? formatInteger(kpis.on_mission, locale) : unavailable,
      hint: t("drivers.kpi.onMissionHint"),
      unavailable: !kpis,
      tone: "bg-amber-50 text-amber-700 ring-amber-100",
    },
  ];

  return (
    <section
      aria-label={t("drivers.title")}
      className="grid grid-cols-2 gap-3 xl:grid-cols-4"
    >
      {cards.map(({ key, icon: Icon, label, value, hint, unavailable: missing, tone }) => (
        <article
          key={key}
          className="rounded-2xl border border-line/70 bg-white p-4 shadow-soft"
        >
          <span className={`grid size-8 place-items-center rounded-lg ring-1 ${tone}`}>
            <Icon aria-hidden className="size-4" />
          </span>
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
