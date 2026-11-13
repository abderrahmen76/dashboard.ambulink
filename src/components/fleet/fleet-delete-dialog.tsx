"use client";

import { Loader2, Trash2, TriangleAlert, X } from "lucide-react";
import { useEffect, useId, useState } from "react";

import { vehicleState } from "@/lib/fleet/status";
import { fleetArchiveErrorMessageKey } from "@/lib/fleet/messages";
import type { FleetAmbulance, FleetArchiveErrorCode } from "@/lib/fleet/types";
import { useI18n } from "@/lib/i18n/provider";

/**
 * Confirmation for retiring a vehicle from the registry. "Delete" archives the
 * ambulance server-side, so the dialog says so instead of promising a purge;
 * the RPC still re-checks ownership, state and any active mission.
 */
export function FleetDeleteDialog({
  ambulance,
  onClose,
  onArchive,
  onArchived,
}: {
  ambulance: FleetAmbulance;
  onClose: () => void;
  onArchive: (ambulanceId: string) => Promise<FleetArchiveErrorCode | null>;
  onArchived: () => void;
}) {
  const { t } = useI18n();
  const titleId = useId();
  const bodyId = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<FleetArchiveErrorCode | null>(null);

  const onMission = vehicleState(ambulance) === "on_mission";

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", handleKey);
    };
  }, [onClose, pending]);

  const confirm = async () => {
    if (pending || onMission) return;
    setPending(true);
    setError(null);
    const code = await onArchive(ambulance.id);
    setPending(false);
    if (code) {
      setError(code);
      return;
    }
    onArchived();
  };

  const vehicle =
    ambulance.label?.trim() || ambulance.plate_number?.trim() || "—";

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
              {t("fleet.delete.title")}
            </h2>
            <p id={bodyId} className="mt-1 text-sm leading-relaxed text-ink-soft">
              {t("fleet.delete.body", { vehicle })}
            </p>
            <dl className="mt-2 space-y-0.5 text-xs text-ink-soft">
              <div className="flex gap-1.5">
                <dt className="font-semibold">{t("fleet.table.registration")}:</dt>
                <dd dir="ltr" className="truncate font-mono">
                  {ambulance.plate_number?.trim() || "—"}
                </dd>
              </div>
              {ambulance.driver_name?.trim() ? (
                <div className="flex gap-1.5">
                  <dt className="font-semibold">{t("fleet.details.driver")}:</dt>
                  <dd className="truncate">{ambulance.driver_name}</dd>
                </div>
              ) : null}
            </dl>
            <p className="mt-2 text-xs text-ink-soft/80">{t("fleet.delete.note")}</p>
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

        {onMission ? (
          <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
            <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            {t("fleet.delete.missionBlocked")}
          </p>
        ) : null}

        {error ? (
          <p
            role="alert"
            className="mt-3 rounded-lg bg-accent-50 px-3 py-2 text-xs text-accent-700"
          >
            {t(fleetArchiveErrorMessageKey(error))}
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
            disabled={pending || onMission}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-accent-600 px-4 text-sm font-semibold text-white transition hover:bg-accent-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
            {pending ? t("fleet.delete.deleting") : t("fleet.delete.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
