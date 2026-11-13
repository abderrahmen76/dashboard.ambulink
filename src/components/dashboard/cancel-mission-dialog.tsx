"use client";

import { Loader2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { dashboardErrorMessageKey } from "@/lib/dashboard/messages";
import type { DashboardErrorCode } from "@/lib/dashboard/service";
import type { DashboardMission } from "@/lib/dashboard/types";
import { useI18n } from "@/lib/i18n/provider";

/**
 * Confirmation for the explicit manager cancellation. The dialog never
 * cancels on its own; the RPC still re-checks ownership and status.
 */
export function CancelMissionDialog({
  mission,
  onClose,
  onConfirm,
}: {
  mission: DashboardMission;
  onClose: () => void;
  onConfirm: (missionId: string) => Promise<DashboardErrorCode | null>;
}) {
  const { t } = useI18n();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<DashboardErrorCode | null>(null);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose, pending]);

  const confirm = async () => {
    setPending(true);
    setError(null);
    const code = await onConfirm(mission.id);
    setPending(false);
    if (code) setError(code);
    else onClose();
  };

  const patient = mission.patient_name?.trim() || t("dc.queue.patientUnknown");

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-brand-950/40 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !pending) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-mission-title"
        aria-describedby="cancel-mission-body"
        className="w-full max-w-md rounded-2xl border border-line/70 bg-white p-5 shadow-xl"
      >
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-50 text-accent-700 ring-1 ring-accent-100">
            <XCircle aria-hidden className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="cancel-mission-title" className="text-sm font-semibold text-brand-900">
              {t("dc.cancel.title")}
            </h2>
            <p id="cancel-mission-body" className="mt-1 text-sm leading-relaxed text-ink-soft">
              {t("dc.cancel.body", { patient })}
            </p>
            <p className="mt-2 text-xs text-ink-soft/80">{t("dc.cancel.note")}</p>
          </div>
        </div>

        {error ? (
          <p role="alert" className="mt-3 rounded-lg bg-accent-50 px-3 py-2 text-xs text-accent-700">
            {t(dashboardErrorMessageKey(error))}
          </p>
        ) : null}

        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            autoFocus
            onClick={onClose}
            disabled={pending}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-line bg-white px-4 text-sm font-semibold text-brand-800 transition hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-60"
          >
            {t("dc.cancel.keep")}
          </button>
          <button
            type="button"
            onClick={() => void confirm()}
            disabled={pending}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-accent-600 px-4 text-sm font-semibold text-white transition hover:bg-accent-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 disabled:cursor-progress disabled:opacity-60"
          >
            {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
            {pending ? t("dc.cancel.cancelling") : t("dc.cancel.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
