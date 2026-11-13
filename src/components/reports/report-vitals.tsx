"use client";

import { useI18n } from "@/lib/i18n/provider";
import { formatDecimal } from "@/lib/reports/format";
import type { ReportVitals } from "@/lib/reports/types";

type VitalMetric = {
  labelKey:
    | "reports.detail.vitals.fc"
    | "reports.detail.vitals.spo2"
    | "reports.detail.vitals.sys"
    | "reports.detail.vitals.dia"
    | "reports.detail.vitals.rr"
    | "reports.detail.vitals.temp"
    | "reports.detail.vitals.glucose"
    | "reports.detail.vitals.pain";
  unit: string;
  before: number | null;
  after: number | null;
};

export function ReportVitalsTable({ vitals }: { vitals: ReportVitals }) {
  const { t } = useI18n();
  const missing = t("reports.detail.vitals.missing");

  const metrics: VitalMetric[] = [
    { labelKey: "reports.detail.vitals.fc", unit: "bpm", before: vitals.fc_before, after: vitals.fc_after },
    { labelKey: "reports.detail.vitals.spo2", unit: "%", before: vitals.spo2_before, after: vitals.spo2_after },
    { labelKey: "reports.detail.vitals.sys", unit: "mmHg", before: vitals.sys_before, after: vitals.sys_after },
    { labelKey: "reports.detail.vitals.dia", unit: "mmHg", before: vitals.dia_before, after: vitals.dia_after },
    { labelKey: "reports.detail.vitals.rr", unit: "/min", before: vitals.rr_before, after: vitals.rr_after },
    { labelKey: "reports.detail.vitals.temp", unit: "°C", before: vitals.temp_before, after: vitals.temp_after },
    { labelKey: "reports.detail.vitals.glucose", unit: "g/L", before: vitals.glucose_before, after: vitals.glucose_after },
    { labelKey: "reports.detail.vitals.pain", unit: "", before: vitals.pain_before, after: vitals.pain_after },
  ];

  const value = (raw: number | null, unit: string) => {
    const formatted = formatDecimal(raw);
    if (formatted === null) {
      return (
        <span
          title={missing}
          className="text-xs font-medium tabular-nums text-ink-soft/50"
        >
          —
        </span>
      );
    }
    return (
      <span className="text-sm font-semibold tabular-nums text-ink">
        {formatted}
        {unit ? (
          <span className="ms-0.5 text-[10px] font-normal text-ink-soft">{unit}</span>
        ) : null}
      </span>
    );
  };

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {metrics.map((metric) => (
        <article
          key={metric.labelKey}
          className="rounded-lg border border-line/70 bg-white px-2.5 py-2"
        >
          <p className="truncate text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-soft">
            {t(metric.labelKey)}
          </p>
          <dl className="mt-1 space-y-0.5">
            <div className="flex items-baseline justify-between gap-1">
              <dt className="text-[10px] text-ink-soft/80">
                {t("reports.detail.vitals.before")}
              </dt>
              <dd>{value(metric.before, metric.unit)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-1">
              <dt className="text-[10px] text-ink-soft/80">
                {t("reports.detail.vitals.after")}
              </dt>
              <dd>{value(metric.after, metric.unit)}</dd>
            </div>
          </dl>
        </article>
      ))}
    </div>
  );
}
