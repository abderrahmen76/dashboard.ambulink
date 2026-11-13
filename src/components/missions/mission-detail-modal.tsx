"use client";

import {
  Banknote,
  FileText,
  Flag,
  MapPin,
  UserRound,
  X,
} from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";

import { useI18n } from "@/lib/i18n/provider";
import {
  formatMissionDateTime,
  formatMoney,
  shortReference,
} from "@/lib/missions/format";
import type { MissionRow } from "@/lib/missions/types";
import { useMissionPrice } from "@/lib/missions/use-mission-price";

import { MissionStatusPill } from "./mission-status-pill";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-soft">
        {label}
      </dt>
      <dd className="mt-0.5 break-words text-xs text-ink">{value}</dd>
    </div>
  );
}

export function MissionDetailModal({
  row,
  onClose,
}: {
  row: MissionRow;
  onClose: () => void;
}) {
  const { t, dir, locale } = useI18n();
  const missing = t("ma.detail.notProvided");
  const text = (value: string | null) =>
    value && value.trim() !== "" ? value : missing;
  // Null unless the mission was entered by its currently assigned clinic
  // driver; the server owns that rule, so an ineligible mission renders no row.
  const { price } = useMissionPrice(row.id);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      dir={dir}
      role="dialog"
      aria-modal="true"
      aria-label={t("ma.detail.title")}
      className="fixed inset-0 z-[60] grid place-items-center bg-brand-900/50 p-2 backdrop-blur-sm sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[calc(100dvh-1rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-soft sm:max-h-[calc(100dvh-3rem)]">
        <header className="flex items-start justify-between gap-3 border-b border-line/70 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-700">
              {t("ma.detail.title")}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="font-mono text-[11px] font-medium text-brand-800">
                {shortReference(row.id)}
              </span>
              <MissionStatusPill status={row.status} />
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("ma.detail.close")}
            className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-soft transition hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <X aria-hidden className="size-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5">
            <div className="col-span-2 min-w-0">
              <dt className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-soft">
                <UserRound aria-hidden className="size-3" />
                {t("ma.detail.patient")}
              </dt>
              <dd className="mt-0.5 truncate text-sm font-semibold text-brand-900">
                {text(row.patient_name)}
              </dd>
            </div>
            <Field
              label={t("ma.detail.driver")}
              value={
                row.driver_name && row.driver_name.trim() !== ""
                  ? row.driver_name
                  : t("ma.table.notAssigned")
              }
            />
            <Field
              label={t("ma.detail.ambulance")}
              value={
                row.ambulance_label && row.ambulance_label.trim() !== ""
                  ? row.ambulance_label
                  : t("ma.table.notAssigned")
              }
            />
          </dl>

          {price !== null ? (
            <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-line/70 bg-surface/40 px-3 py-2">
              <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-soft">
                <Banknote aria-hidden className="size-3.5 text-emerald-600" />
                {t("ma.detail.price")}
              </span>
              <span className="text-sm font-semibold text-brand-900">
                {formatMoney(price, locale)}
              </span>
            </div>
          ) : null}

          <div className="mt-3 space-y-1.5 rounded-lg border border-line/70 bg-surface/40 px-3 py-2">
            <p className="flex items-start gap-1.5 text-xs text-ink">
              <MapPin aria-hidden className="mt-0.5 size-3.5 shrink-0 text-brand-500" />
              <span className="min-w-0 break-words">{text(row.pickup_label)}</span>
            </p>
            <p className="flex items-start gap-1.5 text-xs text-ink-soft">
              <Flag aria-hidden className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
              <span className="min-w-0 break-words">{text(row.destination_label)}</span>
            </p>
          </div>

          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5">
            <Field
              label={t("ma.detail.created")}
              value={formatMissionDateTime(row.created_at, missing)}
            />
            <Field
              label={t("ma.detail.accepted")}
              value={formatMissionDateTime(row.accepted_at, missing)}
            />
            <Field
              label={t("ma.detail.completed")}
              value={formatMissionDateTime(row.completed_at, missing)}
            />
            <Field
              label={t("ma.detail.cancelled")}
              value={formatMissionDateTime(row.cancelled_at, missing)}
            />
          </dl>

          <div className="mt-3 border-t border-line/60 pt-3">
            <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-soft">
              <FileText aria-hidden className="size-3" />
              {t("ma.detail.symptoms")}
            </p>
            <p className="mt-1 whitespace-pre-line break-words text-xs leading-relaxed text-ink">
              {text(row.symptoms)}
            </p>
          </div>

          <div className="mt-3 border-t border-line/60 pt-3">
            <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-soft">
              <FileText aria-hidden className="size-3" />
              {t("ma.detail.notes")}
            </p>
            <p className="mt-1 whitespace-pre-line break-words text-xs leading-relaxed text-ink">
              {text(row.notes)}
            </p>
          </div>

          <div className="mt-3 border-t border-line/60 pt-2">
            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-ink-soft/70">
              {t("ma.table.reference")}
            </p>
            <p className="mt-0.5 break-all font-mono text-[10px] text-ink-soft/80">
              {row.id}
            </p>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
