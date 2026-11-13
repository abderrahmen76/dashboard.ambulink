"use client";

import { Loader2, Trash2, TriangleAlert, X } from "lucide-react";
import { useEffect, useId, useState } from "react";

import { driverDeleteErrorMessageKey } from "@/lib/drivers/messages";
import type { DriverDeleteErrorCode, DriverRow } from "@/lib/drivers/types";
import { useI18n } from "@/lib/i18n/provider";
import { formatTunisianPhone, normalizeTunisianPhoneDigits } from "@/lib/phone";

/**
 * Confirmation for removing a driver from the hospital registry. The RPC
 * deactivates the hospital membership and releases the vehicle; the auth
 * account, profile and mission history are never deleted.
 */
export function DriverDeleteDialog({
  driver,
  onClose,
  onDeactivate,
  onDeactivated,
}: {
  driver: DriverRow;
  onClose: () => void;
  onDeactivate: (driverId: string) => Promise<DriverDeleteErrorCode | null>;
  onDeactivated: () => void;
}) {
  const { t } = useI18n();
  const titleId = useId();
  const bodyId = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<DriverDeleteErrorCode | null>(null);

  const onMission = driver.status === "on_mission";

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
    const code = await onDeactivate(driver.id);
    setPending(false);
    if (code) {
      setError(code);
      return;
    }
    onDeactivated();
  };

  const name = driver.full_name?.trim() || "—";
  const phoneDigits = driver.phone ? normalizeTunisianPhoneDigits(driver.phone) : null;
  const phone = driver.phone
    ? phoneDigits
      ? formatTunisianPhone(driver.phone)
      : driver.phone
    : null;

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
              {t("drivers.delete.title")}
            </h2>
            <p id={bodyId} className="mt-1 text-sm leading-relaxed text-ink-soft">
              {t("drivers.delete.body", { name })}
            </p>
            <dl className="mt-2 space-y-0.5 text-xs text-ink-soft">
              <div className="flex gap-1.5">
                <dt className="font-semibold">{t("drivers.details.phone")}:</dt>
                <dd dir="ltr" className="truncate">
                  {phone ?? t("drivers.phone.missing")}
                </dd>
              </div>
              {driver.ambulance ? (
                <div className="flex gap-1.5">
                  <dt className="font-semibold">{t("drivers.assign.current")}:</dt>
                  <dd className="truncate">
                    {driver.ambulance.label?.trim() ||
                      driver.ambulance.plate_number?.trim() ||
                      "—"}
                  </dd>
                </div>
              ) : null}
            </dl>
            <p className="mt-2 text-xs text-ink-soft/80">{t("drivers.delete.note")}</p>
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
            {t("drivers.delete.missionBlocked")}
          </p>
        ) : null}

        {error ? (
          <p
            role="alert"
            className="mt-3 rounded-lg bg-accent-50 px-3 py-2 text-xs text-accent-700"
          >
            {t(driverDeleteErrorMessageKey(error))}
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
            {pending ? t("drivers.delete.deleting") : t("drivers.delete.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
