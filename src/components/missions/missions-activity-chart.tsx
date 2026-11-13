"use client";

import { useMemo } from "react";

import { useI18n } from "@/lib/i18n/provider";
import {
  formatDay,
  shiftDay,
  tunisYmdOf,
  weekStartOf,
} from "@/lib/missions/format";
import type { AnalyticsBucket, MissionSeriesPoint } from "@/lib/missions/types";

export function MissionsActivityChart({
  series,
  bucket,
  from,
  to,
}: {
  series: MissionSeriesPoint[];
  bucket: AnalyticsBucket;
  from: string;
  to: string;
}) {
  const { t } = useI18n();

  const rows = useMemo(() => {
    const byBucket = new Map(series.map((point) => [point.bucket, point]));
    const keys: string[] = [];
    const end = tunisYmdOf(to);
    let cursor = bucket === "week" ? weekStartOf(tunisYmdOf(from)) : tunisYmdOf(from);
    // Bounded so a malformed range can never build an unbounded axis.
    while (cursor <= end && keys.length < 400) {
      keys.push(cursor);
      cursor = shiftDay(cursor, bucket === "week" ? 7 : 1);
    }
    return keys.map((key) => {
      const point = byBucket.get(key);
      const total = point?.total ?? 0;
      const completed = point?.completed ?? 0;
      const cancelled = point?.cancelled ?? 0;
      return {
        key,
        total,
        completed,
        cancelled,
        other: Math.max(0, total - completed - cancelled),
      };
    });
  }, [series, bucket, from, to]);

  const max = rows.reduce((highest, row) => Math.max(highest, row.total), 0);
  const axisMax = Math.max(1, max);
  const step = Math.max(1, Math.ceil(rows.length / 7));

  const legend = [
    { key: "completed", color: "bg-emerald-500", label: t("ma.chart.completed") },
    { key: "cancelled", color: "bg-accent-600", label: t("ma.chart.cancelled") },
    { key: "other", color: "bg-brand-500", label: t("ma.chart.other") },
  ];

  return (
    <section
      aria-label={t("ma.chart.activity")}
      className="min-w-0 rounded-xl border border-line/70 bg-white px-3 py-2.5"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-brand-900">{t("ma.chart.activity")}</h2>
          <p className="text-[11px] text-ink-soft">
            {bucket === "week" ? t("ma.chart.hintWeek") : t("ma.chart.hintDay")}
          </p>
        </div>
        <ul className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {legend.map((item) => (
            <li key={item.key} className="flex items-center gap-1 text-[10px] text-ink-soft">
              <span aria-hidden className={`size-2 rounded-sm ${item.color}`} />
              {item.label}
            </li>
          ))}
        </ul>
      </div>

      {max === 0 ? (
        <p className="grid h-44 place-items-center text-xs italic text-ink-soft/70">
          {t("ma.chart.empty")}
        </p>
      ) : (
        <>
          <div className="relative mt-3 h-44">
            <div aria-hidden className="absolute inset-0 flex flex-col justify-between">
              {[axisMax, Math.round(axisMax / 2), 0].map((value, index) => (
                <div key={index} className="flex items-center gap-1.5">
                  <span className="w-6 shrink-0 text-end text-[9px] tabular-nums text-ink-soft/70">
                    {value}
                  </span>
                  <span className="h-px flex-1 bg-line/60" />
                </div>
              ))}
            </div>

            <div className="absolute inset-y-0 start-[30px] end-0 flex items-end gap-[3px]">
              {rows.map((row) => {
                const date = formatDay(row.key, { withYear: true }) ?? row.key;
                return (
                  <div
                    key={row.key}
                    role="img"
                    title={`${date} · ${t("ma.chart.total")} ${row.total} · ${t("ma.chart.completed")} ${row.completed} · ${t("ma.chart.cancelled")} ${row.cancelled}`}
                    aria-label={`${date}: ${row.total}`}
                    className="flex h-full min-w-0 flex-1 items-end"
                  >
                    {row.total > 0 ? (
                      <div
                        className="flex w-full flex-col overflow-hidden rounded-sm"
                        style={{ height: `${(row.total / axisMax) * 100}%` }}
                      >
                        {row.other > 0 ? (
                          <span
                            aria-hidden
                            className="w-full bg-brand-500"
                            style={{ height: `${(row.other / row.total) * 100}%` }}
                          />
                        ) : null}
                        {row.cancelled > 0 ? (
                          <span
                            aria-hidden
                            className="w-full bg-accent-600"
                            style={{ height: `${(row.cancelled / row.total) * 100}%` }}
                          />
                        ) : null}
                        {row.completed > 0 ? (
                          <span
                            aria-hidden
                            className="w-full bg-emerald-500"
                            style={{ height: `${(row.completed / row.total) * 100}%` }}
                          />
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-1 flex gap-[3px] ps-[30px]" aria-hidden>
            {rows.map((row, index) => (
              <span
                key={row.key}
                className="min-w-0 flex-1 truncate text-center text-[9px] tabular-nums text-ink-soft/80"
              >
                {index % step === 0 || index === rows.length - 1
                  ? formatDay(row.key)
                  : ""}
              </span>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
