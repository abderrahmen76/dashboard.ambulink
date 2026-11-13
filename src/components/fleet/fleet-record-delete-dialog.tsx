"use client";

import { Loader2, Trash2, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { fleetRecordErrorMessageKey } from "@/lib/fleet/messages";
import type {
  FleetRecordDeleteResult,
  FleetRecordSaveErrorCode,
} from "@/lib/fleet/types";
import { useI18n } from "@/lib/i18n/provider";

/**
 * Confirmation for removing one fuel/maintenance row. The RPC deletes only the
 * selected record and recalculates the vehicle mileage from what survives, so
 * the copy says the reading is reconciled rather than lowered.
 */
export function FleetRecordDeleteDialog({
  summary,
  onClose,
  onDelete,
  onDeleted,
}: {
  summary: string;
  onClose: () => void;
  onDelete: () => Promise<FleetRecordDeleteResult>;
  onDeleted: () => void;
}) {
  const { t } = useI18n();
  const titleId = useId();
  const bodyId = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<FleetRecordSaveErrorCode | null>(null);
  const onCloseRef = useRef(onClose);
  const pendingRef = useRef(pending);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pendingRef.current) onCloseRef.current();
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", handleKey);
    };
  }, []);

  const confirm = async () => {
    if (pending) return;
    setPending(true);
    setError(null);
    const result = await onDelete();
    setPending(false);
    if (!result.ok) {
      setError(result.code);
      return;
    }
    onDeleted();
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-brand-900/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !pending) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className="w-full max-w-md rounded-2xl border border-line/70 bg-white p-5 shadow-xl"
      >
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-50 text-accent-700 ring-1 ring-accent-100">
            <Trash2 aria-hidden className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-sm font-semibold text-brand-900">
              {t("fleet.record.deleteTitle")}
            </h2>
            <p id={bodyId} className="mt-1 text-sm leading-relaxed text-ink-soft">
              {t("fleet.record.deleteBody", { summary })}
            </p>
            <p className="mt-2 text-xs text-ink-soft/80">{t("fleet.record.deleteNote")}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            aria-label={t("dc.details.close")}
            className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-soft transition hover:bg-surface hover:text-brand-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-60"
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>

        {error ? (
          <p
            role="alert"
            className="mt-3 rounded-lg bg-accent-50 px-3 py-2 text-xs text-accent-700"
          >
            {t(fleetRecordErrorMessageKey(error))}
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
            {t("dc.new.cancel")}
          </button>
          <button
            type="button"
            onClick={() => void confirm()}
            disabled={pending}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-accent-600 px-4 text-sm font-semibold text-white transition hover:bg-accent-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
            {pending ? t("fleet.record.deleting") : t("fleet.record.deleteConfirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
