"use client";

import { CheckCircle2, Clock3 } from "lucide-react";

import { useI18n } from "@/lib/i18n/provider";
import { formatReportDateTime } from "@/lib/reports/format";
import type { ReportRevision } from "@/lib/reports/types";

export function RevisionTimeline({
  revisions,
  selectedRevision,
  onSelect,
}: {
  revisions: ReportRevision[];
  selectedRevision: number;
  onSelect: (revisionNo: number) => void;
}) {
  const { t } = useI18n();

  if (revisions.length === 0) {
    return (
      <p className="text-xs text-ink-soft">{t("reports.revisions.empty")}</p>
    );
  }

  return (
    <ol className="space-y-2">
      {revisions.map((revision, index) => {
        const selected = revision.revision_no === selectedRevision;
        return (
          <li key={revision.revision_no}>
            <button
              type="button"
              onClick={() => onSelect(revision.revision_no)}
              aria-current={selected ? "true" : undefined}
              className={`w-full rounded-xl border p-3 text-start transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                selected
                  ? "border-brand-300 bg-brand-50/70 ring-1 ring-brand-200"
                  : "border-line/70 bg-white hover:border-brand-200 hover:bg-brand-50/40"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 text-xs font-semibold text-brand-900">
                  {t("reports.revisions.revision", { value: revision.revision_no })}
                  {index === 0 ? (
                    <span className="rounded-full bg-brand-800 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
                      {t("reports.revisions.latest")}
                    </span>
                  ) : null}
                </span>
                {revision.reviewed_at ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700">
                    <CheckCircle2 aria-hidden className="size-3" />
                    {t("reports.revisions.reviewedAt")}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700">
                    <Clock3 aria-hidden className="size-3" />
                    {t("reports.review.pending")}
                  </span>
                )}
              </div>

              <dl className="mt-2 grid gap-x-3 gap-y-1 text-[11px] text-ink-soft sm:grid-cols-2">
                <div className="flex items-center justify-between gap-2">
                  <dt>{t("reports.revisions.finalizedAt")}</dt>
                  <dd className="tabular-nums">
                    {formatReportDateTime(revision.finalized_at, "—")}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt>{t("reports.revisions.transmittedAt")}</dt>
                  <dd className="tabular-nums">
                    {formatReportDateTime(revision.transmitted_at, "—")}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2 sm:col-span-2">
                  <dt>{t("reports.revisions.finalizedBy")}</dt>
                  <dd className="truncate font-medium text-ink">
                    {revision.finalized_by_name ?? "—"}
                  </dd>
                </div>
              </dl>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
