"use client";

import { Loader2, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";

import { fleetSaveErrorMessageKey } from "@/lib/fleet/messages";
import type {
  FleetAmbulance,
  FleetSaveErrorCode,
  FleetSaveResult,
  SaveAmbulanceInput,
} from "@/lib/fleet/types";
import { useI18n } from "@/lib/i18n/provider";

const fieldClass =
  "h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink focus:border-brand-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:bg-surface disabled:text-ink-soft";
const labelClass = "block text-xs font-medium text-brand-900";

type Validation = "label" | "mileage" | null;

export function FleetVehicleDialog({
  ambulance,
  onClose,
  onSave,
  onSaved,
}: {
  ambulance: FleetAmbulance | null;
  onClose: () => void;
  onSave: (input: SaveAmbulanceInput) => Promise<FleetSaveResult>;
  onSaved: (ambulanceId: string) => void;
}) {
  const { t } = useI18n();
  const titleId = useId();
  const [label, setLabel] = useState(ambulance?.label ?? "");
  const [plate, setPlate] = useState(ambulance?.plate_number ?? "");
  const [mileage, setMileage] = useState(
    ambulance?.mileage != null ? String(ambulance.mileage) : "",
  );
  const [status, setStatus] = useState<"available" | "maintenance">(
    ambulance?.status === "maintenance" ? "maintenance" : "available",
  );
  const [validation, setValidation] = useState<Validation>(null);
  const [serverError, setServerError] = useState<FleetSaveErrorCode | null>(null);
  const [pending, setPending] = useState(false);
  const aliveRef = useRef(true);
  const onCloseRef = useRef(onClose);

  const locked = Boolean(ambulance?.active_mission);
  const editing = ambulance !== null;

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    aliveRef.current = true;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      aliveRef.current = false;
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", handleKey);
    };
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;

    const trimmedLabel = label.trim();
    if (!trimmedLabel) {
      setValidation("label");
      return;
    }

    const rawMileage = mileage.trim().replace(",", ".");
    let parsedMileage: number | null = null;
    if (rawMileage) {
      const value = Number(rawMileage);
      if (!Number.isFinite(value) || value < 0 || value > 9999999) {
        setValidation("mileage");
        return;
      }
      parsedMileage = value;
    }

    setValidation(null);
    setServerError(null);
    setPending(true);
    const result = await onSave({
      ambulanceId: ambulance?.id ?? null,
      label: trimmedLabel,
      plateNumber: plate.trim() || null,
      mileage: parsedMileage,
      status,
    });
    if (!aliveRef.current) return;
    setPending(false);
    if (result.ok) {
      onSaved(result.ambulanceId);
      return;
    }
    setServerError(result.code);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-brand-900/50 p-3 sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="mt-6 w-full max-w-lg rounded-2xl bg-white shadow-card"
      >
        <div className="flex items-start justify-between gap-3 border-b border-line/70 px-5 py-4">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-brand-900">
              {editing ? t("fleet.vehicle.editTitle") : t("fleet.vehicle.newTitle")}
            </h2>
            <p className="mt-0.5 text-xs text-ink-soft">{t("fleet.registry")}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("dc.details.close")}
            className="grid size-8 place-items-center rounded-lg text-ink-soft transition hover:bg-surface hover:text-brand-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3.5 px-5 py-4">
          <div>
            <label htmlFor={`${titleId}-label`} className={labelClass}>
              {t("fleet.vehicle.label")}
            </label>
            <input
              id={`${titleId}-label`}
              value={label}
              onChange={(event) => {
                setLabel(event.target.value);
                if (validation === "label") setValidation(null);
              }}
              autoFocus
              placeholder={t("fleet.vehicle.labelPlaceholder")}
              className={`${fieldClass} mt-1`}
              aria-invalid={validation === "label" || undefined}
            />
            {validation === "label" ? (
              <p role="alert" className="mt-1 text-xs font-medium text-accent-700">
                {t("fleet.vehicle.error.label")}
              </p>
            ) : null}
          </div>

          <div>
            <label htmlFor={`${titleId}-plate`} className={labelClass}>
              {t("fleet.vehicle.plate")}
            </label>
            <input
              id={`${titleId}-plate`}
              value={plate}
              onChange={(event) => setPlate(event.target.value)}
              placeholder={t("fleet.vehicle.platePlaceholder")}
              className={`${fieldClass} mt-1 font-mono`}
            />
          </div>

          <div>
            <label htmlFor={`${titleId}-mileage`} className={labelClass}>
              {t("fleet.vehicle.mileage")}
            </label>
            <input
              id={`${titleId}-mileage`}
              value={mileage}
              onChange={(event) => {
                setMileage(event.target.value);
                if (validation === "mileage") setValidation(null);
              }}
              inputMode="decimal"
              placeholder={t("fleet.vehicle.mileagePlaceholder")}
              className={`${fieldClass} mt-1`}
              aria-invalid={validation === "mileage" || undefined}
            />
            {validation === "mileage" ? (
              <p role="alert" className="mt-1 text-xs font-medium text-accent-700">
                {t("fleet.vehicle.error.mileage")}
              </p>
            ) : null}
          </div>

          <div>
            <label htmlFor={`${titleId}-status`} className={labelClass}>
              {t("fleet.vehicle.status")}
            </label>
            <select
              id={`${titleId}-status`}
              value={status}
              onChange={(event) =>
                setStatus(event.target.value === "maintenance" ? "maintenance" : "available")
              }
              disabled={locked}
              className={`${fieldClass} mt-1`}
            >
              <option value="available">{t("fleet.state.available")}</option>
              <option value="maintenance">{t("fleet.state.maintenance")}</option>
            </select>
            {locked ? (
              <p className="mt-1 text-[11px] text-ink-soft">{t("fleet.vehicle.statusLocked")}</p>
            ) : null}
          </div>

          {serverError ? (
            <p
              role="alert"
              className="rounded-lg border border-accent-100 bg-accent-50 px-3 py-2 text-xs font-medium text-accent-700"
            >
              {t(fleetSaveErrorMessageKey(serverError))}
            </p>
          ) : null}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="inline-flex h-10 items-center rounded-lg border border-line bg-white px-3.5 text-sm font-semibold text-brand-900 transition hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-60"
            >
              {t("dc.new.cancel")}
            </button>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-800 px-4 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-progress disabled:opacity-70"
            >
              {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
              {pending ? t("fleet.vehicle.saving") : t("fleet.vehicle.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
