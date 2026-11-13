"use client";

import { FileText, Printer, X } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";

import { useI18n } from "@/lib/i18n/provider";
import type { ReportDetail } from "@/lib/reports/types";

import { MedicalReportPrint } from "./medical-report-print";

/**
 * On-demand document viewer. Reports have no stored PDF and the dashboard must
 * never render the A4 document by default: this mounts only when the user opens
 * it, in a portal so printing sends just the document, never the dashboard.
 */
export function DocumentPreview({
  detail,
  revisionNo,
  onClose,
}: {
  detail: ReportDetail;
  revisionNo: number;
  onClose: () => void;
}) {
  const { t, dir } = useI18n();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    document.body.classList.add("document-viewer-open");
    return () => document.body.classList.remove("document-viewer-open");
  }, []);

  return createPortal(
    <div
      dir={dir}
      role="dialog"
      aria-modal="true"
      aria-label={t("reports.document.previewTitle")}
      className="document-viewer fixed inset-0 z-[60] flex bg-brand-900/50 backdrop-blur-sm"
    >
      <div className="mx-auto flex h-full w-full max-w-4xl flex-col p-2 sm:p-6">
        <div className="document-viewer-chrome flex items-center justify-between gap-2 rounded-t-xl border border-b-0 border-line bg-white px-3 py-2">
          <p className="inline-flex min-w-0 items-center gap-2 text-xs font-semibold text-brand-900">
            <FileText aria-hidden className="size-4 shrink-0 text-brand-700" />
            <span className="truncate">{t("reports.document.previewTitle")}</span>
          </p>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 text-[11px] font-semibold text-brand-800 transition hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <Printer aria-hidden className="size-3.5" />
              {t("reports.detail.print")}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label={t("reports.document.close")}
              className="grid size-8 place-items-center rounded-lg text-ink-soft transition hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <X aria-hidden className="size-4" />
            </button>
          </div>
        </div>

        <div className="document-viewer-body min-h-0 flex-1 overflow-y-auto rounded-b-xl border border-line bg-white p-3 sm:p-6">
          <MedicalReportPrint detail={detail} selectedRevision={revisionNo} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
