"use client";

import {
  CheckCircle2,
  ClipboardList,
  Send,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";

import { formatInteger } from "@/lib/dashboard/format";
import { useI18n } from "@/lib/i18n/provider";
import type { ReportKpis } from "@/lib/reports/types";

type Card = {
  key: string;
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
  missing: boolean;
  highlight?: boolean;
  tone: string;
};

export function ReportsKpiGrid({ kpis }: { kpis: ReportKpis | null }) {
  const { t, locale } = useI18n();
  const unavailable = t("dc.kpi.unavailable");

  const cards: Card[] = [
    {
      key: "total",
      icon: ClipboardList,
      label: t("reports.kpi.total"),
      value: kpis ? formatInteger(kpis.total, locale) : unavailable,
      hint: t("reports.kpi.totalHint"),
      missing: !kpis,
      tone: "bg-brand-50 text-brand-700 ring-brand-100",
    },
    {
      key: "pending",
      icon: Stethoscope,
      label: t("reports.kpi.pending"),
      value: kpis ? formatInteger(kpis.pending, locale) : unavailable,
      hint: t("reports.kpi.pendingHint"),
      missing: !kpis,
      highlight: true,
      tone: "bg-accent-50 text-accent-700 ring-accent-100",
    },
    {
      key: "reviewed",
      icon: CheckCircle2,
      label: t("reports.kpi.reviewed"),
      value: kpis ? formatInteger(kpis.reviewed, locale) : unavailable,
      hint: t("reports.kpi.reviewedHint"),
      missing: !kpis,
      tone: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    },
    {
      key: "recent",
      icon: Send,
      label: t("reports.kpi.recent"),
      value: kpis ? formatInteger(kpis.recent, locale) : unavailable,
      hint: t("reports.kpi.recentHint"),
      missing: !kpis,
      tone: "bg-sky-50 text-sky-700 ring-sky-100",
    },
  ];

  return (
    <section
      aria-label={t("reports.badge")}
      className="grid grid-cols-2 gap-2.5 lg:grid-cols-4"
    >
      {cards.map(({ key, icon: Icon, label, value, hint, missing, highlight, tone }) => (
        <article
          key={key}
          title={hint}
          className={`flex min-w-0 items-center gap-3 rounded-xl border px-3 py-2.5 ${
            highlight
              ? "border-accent-200 bg-accent-50/50"
              : "border-line/70 bg-white"
          }`}
        >
          <span
            aria-hidden
            className={`grid size-8 shrink-0 place-items-center rounded-lg ring-1 ${tone}`}
          >
            <Icon className="size-4" />
          </span>
          <div className="min-w-0">
            <p
              className={`text-xl font-semibold leading-tight tracking-tight tabular-nums ${
                missing
                  ? "text-ink-soft/60"
                  : highlight
                    ? "text-accent-700"
                    : "text-brand-900"
              }`}
            >
              {value}
            </p>
            <p className="truncate text-[11px] font-medium text-ink-soft">{label}</p>
          </div>
        </article>
      ))}
    </section>
  );
}
