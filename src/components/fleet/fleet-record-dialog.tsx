"use client";

import { Loader2, X } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import { fleetRecordErrorMessageKey } from "@/lib/fleet/messages";
import type {
  CreateFuelRecordInput,
  CreateMaintenanceRecordInput,
  FleetAmbulance,
  FleetRecordSaveErrorCode,
  FleetRecordSaveResult,
} from "@/lib/fleet/types";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { useI18n } from "@/lib/i18n/provider";

const fieldClass =
  "h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink focus:border-brand-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:bg-surface disabled:text-ink-soft";
const labelClass = "block text-xs font-medium text-brand-900";
const MAX_MILEAGE = 9_999_999;

type Validation =
  | "priceRequired"
  | "priceInvalid"
  | "mileageRequired"
  | "mileageInvalid"
  | null;

const VALIDATION_KEYS: Record<
  Exclude<Validation, null>,
  MessageKey
> = {
  priceRequired: "fleet.record.error.priceRequired",
  priceInvalid: "fleet.record.error.priceInvalid",
  mileageRequired: "fleet.record.error.mileageRequired",
  mileageInvalid: "fleet.record.error.mileageInvalid",
};

function newRequestKey(): string | null {
  if (typeof crypto === "undefined" || typeof crypto.randomUUID !== "function") {
    return null;
  }
  return crypto.randomUUID();
}

/** `undefined` = unparsable; `null` = empty input; number = usable value. */
function parseAmount(raw: string, max: number): number | null | undefined {
  const value = raw.trim().replace(",", ".");
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > max) return undefined;
  return parsed;
}

function toIsoDateTime(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error: string | null;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="mt-1 text-xs font-medium text-accent-700">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-[11px] text-ink-soft">{hint}</p>
      ) : null}
    </div>
  );
}

function RecordDialogShell({
  titleId,
  title,
  subtitle,
  onClose,
  onSubmit,
  pending,
  serverError,
  children,
}: {
  titleId: string;
  title: string;
  subtitle: string;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  pending: boolean;
  serverError: FleetRecordSaveErrorCode | null;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", handleKey);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-brand-900/50 p-3 sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="mt-6 w-full max-w-lg rounded-2xl bg-white shadow-card"
      >
        <div className="flex items-start justify-between gap-3 border-b border-line/70 px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="truncate text-base font-semibold text-brand-900">
              {title}
            </h2>
            <p className="mt-0.5 truncate text-xs text-ink-soft">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("dc.details.close")}
            className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-soft transition hover:bg-surface hover:text-brand-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-3.5 px-5 py-4">
          {children}

          {serverError ? (
            <p
              role="alert"
              className="rounded-lg border border-accent-100 bg-accent-50 px-3 py-2 text-xs font-medium text-accent-700"
            >
              {t(fleetRecordErrorMessageKey(serverError))}
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
              {pending ? t("fleet.record.saving") : t("fleet.record.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function vehicleSubtitle(ambulance: FleetAmbulance): string {
  return [ambulance.label?.trim(), ambulance.plate_number?.trim()]
    .filter(Boolean)
    .join(" · ");
}

export function FleetFuelDialog({
  ambulance,
  onClose,
  onSave,
  onSaved,
}: {
  ambulance: FleetAmbulance;
  onClose: () => void;
  onSave: (input: CreateFuelRecordInput) => Promise<FleetRecordSaveResult>;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const titleId = useId();
  const [requestKey] = useState(newRequestKey);
  const [price, setPrice] = useState("");
  const [liters, setLiters] = useState("");
  const [pricePerLiter, setPricePerLiter] = useState("");
  const [mileage, setMileage] = useState(
    ambulance.mileage != null ? String(ambulance.mileage) : "",
  );
  const [fuelType, setFuelType] = useState("");
  const [station, setStation] = useState("");
  const [recordedAt, setRecordedAt] = useState("");
  const [notes, setNotes] = useState("");
  const [validation, setValidation] = useState<Validation>(null);
  const [quantityError, setQuantityError] = useState(false);
  const [unitError, setUnitError] = useState(false);
  const [serverError, setServerError] = useState<FleetRecordSaveErrorCode | null>(null);
  const [pending, setPending] = useState(false);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;

    const totalPrice = parseAmount(price, 99_999_999);
    if (totalPrice === null) {
      setValidation("priceRequired");
      return;
    }
    if (totalPrice === undefined) {
      setValidation("priceInvalid");
      return;
    }

    const parsedMileage = parseAmount(mileage, MAX_MILEAGE);
    if (parsedMileage === null) {
      setValidation("mileageRequired");
      return;
    }
    if (parsedMileage === undefined) {
      setValidation("mileageInvalid");
      return;
    }

    const parsedLiters = parseAmount(liters, 99_999);
    const parsedPerLiter = parseAmount(pricePerLiter, 9_999);
    if (parsedLiters === undefined || parsedPerLiter === undefined) {
      setQuantityError(parsedLiters === undefined);
      setUnitError(parsedPerLiter === undefined);
      return;
    }

    setValidation(null);
    setQuantityError(false);
    setUnitError(false);
    setServerError(null);
    setPending(true);
    const result = await onSave({
      requestKey,
      ambulanceId: ambulance.id,
      liters: parsedLiters,
      totalPrice,
      pricePerLiter: parsedPerLiter,
      mileage: parsedMileage,
      fuelType: fuelType.trim() || null,
      station: station.trim() || null,
      notes: notes.trim() || null,
      recordedAt: toIsoDateTime(recordedAt),
    });
    if (!aliveRef.current) return;
    setPending(false);
    if (result.ok) {
      onSaved();
      return;
    }
    setServerError(result.code);
  };

  return (
    <RecordDialogShell
      titleId={titleId}
      title={t("fleet.fuel.formTitle")}
      subtitle={vehicleSubtitle(ambulance)}
      onClose={onClose}
      onSubmit={submit}
      pending={pending}
      serverError={serverError}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field
          id={`${titleId}-price`}
          label={t("fleet.fuel.price")}
          error={
            validation === "priceRequired" || validation === "priceInvalid"
              ? t(VALIDATION_KEYS[validation])
              : null
          }
        >
          <input
            id={`${titleId}-price`}
            value={price}
            onChange={(event) => {
              setPrice(event.target.value);
              if (validation === "priceRequired" || validation === "priceInvalid") {
                setValidation(null);
              }
            }}
            inputMode="decimal"
            autoFocus
            placeholder={t("fleet.record.required")}
            className={`${fieldClass} mt-1`}
            aria-invalid={
              validation === "priceRequired" || validation === "priceInvalid"
                ? true
                : undefined
            }
          />
        </Field>

        <Field
          id={`${titleId}-mileage`}
          label={t("fleet.record.mileage")}
          hint={t("fleet.record.mileageHint")}
          error={
            validation === "mileageRequired" || validation === "mileageInvalid"
              ? t(VALIDATION_KEYS[validation])
              : null
          }
        >
          <input
            id={`${titleId}-mileage`}
            value={mileage}
            onChange={(event) => {
              setMileage(event.target.value);
              if (validation === "mileageRequired" || validation === "mileageInvalid") {
                setValidation(null);
              }
            }}
            inputMode="decimal"
            className={`${fieldClass} mt-1`}
            aria-invalid={
              validation === "mileageRequired" || validation === "mileageInvalid"
                ? true
                : undefined
            }
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field
          id={`${titleId}-liters`}
          label={t("fleet.fuel.litersLabel")}
          error={quantityError ? t("fleet.record.error.numberInvalid") : null}
        >
          <input
            id={`${titleId}-liters`}
            value={liters}
            onChange={(event) => {
              setLiters(event.target.value);
              if (quantityError) setQuantityError(false);
            }}
            inputMode="decimal"
            placeholder={t("fleet.record.optional")}
            className={`${fieldClass} mt-1`}
            aria-invalid={quantityError || undefined}
          />
        </Field>

        <Field
          id={`${titleId}-per-liter`}
          label={t("fleet.fuel.pricePerLiter")}
          error={unitError ? t("fleet.record.error.numberInvalid") : null}
        >
          <input
            id={`${titleId}-per-liter`}
            value={pricePerLiter}
            onChange={(event) => {
              setPricePerLiter(event.target.value);
              if (unitError) setUnitError(false);
            }}
            inputMode="decimal"
            placeholder={t("fleet.record.optional")}
            className={`${fieldClass} mt-1`}
            aria-invalid={unitError || undefined}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field id={`${titleId}-type`} label={t("fleet.fuel.type")} error={null}>
          <input
            id={`${titleId}-type`}
            value={fuelType}
            onChange={(event) => setFuelType(event.target.value)}
            placeholder={t("fleet.record.optional")}
            className={`${fieldClass} mt-1`}
          />
        </Field>

        <Field id={`${titleId}-station`} label={t("fleet.fuel.station")} error={null}>
          <input
            id={`${titleId}-station`}
            value={station}
            onChange={(event) => setStation(event.target.value)}
            placeholder={t("fleet.record.optional")}
            className={`${fieldClass} mt-1`}
          />
        </Field>
      </div>

      <Field id={`${titleId}-date`} label={t("fleet.record.date")} error={null}>
        <input
          id={`${titleId}-date`}
          type="datetime-local"
          value={recordedAt}
          onChange={(event) => setRecordedAt(event.target.value)}
          className={`${fieldClass} mt-1`}
        />
      </Field>

      <Field id={`${titleId}-notes`} label={t("fleet.record.notes")} error={null}>
        <textarea
          id={`${titleId}-notes`}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={2}
          placeholder={t("fleet.record.optional")}
          className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink focus:border-brand-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        />
      </Field>
    </RecordDialogShell>
  );
}

export function FleetMaintenanceDialog({
  ambulance,
  onClose,
  onSave,
  onSaved,
}: {
  ambulance: FleetAmbulance;
  onClose: () => void;
  onSave: (
    input: CreateMaintenanceRecordInput,
  ) => Promise<FleetRecordSaveResult>;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const titleId = useId();
  const [requestKey] = useState(newRequestKey);
  const [price, setPrice] = useState("");
  const [mileage, setMileage] = useState(
    ambulance.mileage != null ? String(ambulance.mileage) : "",
  );
  const [maintenanceType, setMaintenanceType] = useState("");
  const [mechanicName, setMechanicName] = useState("");
  const [repairs, setRepairs] = useState("");
  const [nextMileage, setNextMileage] = useState("");
  const [nextDate, setNextDate] = useState("");
  const [performedAt, setPerformedAt] = useState("");
  const [notes, setNotes] = useState("");
  const [validation, setValidation] = useState<Validation>(null);
  const [nextMileageError, setNextMileageError] = useState(false);
  const [serverError, setServerError] = useState<FleetRecordSaveErrorCode | null>(null);
  const [pending, setPending] = useState(false);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;

    const parsedPrice = parseAmount(price, 99_999_999);
    if (parsedPrice === null) {
      setValidation("priceRequired");
      return;
    }
    if (parsedPrice === undefined) {
      setValidation("priceInvalid");
      return;
    }

    const parsedMileage = parseAmount(mileage, MAX_MILEAGE);
    if (parsedMileage === null) {
      setValidation("mileageRequired");
      return;
    }
    if (parsedMileage === undefined) {
      setValidation("mileageInvalid");
      return;
    }

    const parsedNextMileage = parseAmount(nextMileage, MAX_MILEAGE);
    if (parsedNextMileage === undefined) {
      setNextMileageError(true);
      return;
    }

    setValidation(null);
    setNextMileageError(false);
    setServerError(null);
    setPending(true);
    const result = await onSave({
      requestKey,
      ambulanceId: ambulance.id,
      mechanicName: mechanicName.trim() || null,
      price: parsedPrice,
      repairs: repairs.trim() || null,
      mileage: parsedMileage,
      maintenanceType: maintenanceType.trim() || null,
      notes: notes.trim() || null,
      nextMaintenanceMileage: parsedNextMileage,
      nextMaintenanceOn: nextDate.trim() || null,
      performedAt: toIsoDateTime(performedAt),
    });
    if (!aliveRef.current) return;
    setPending(false);
    if (result.ok) {
      onSaved();
      return;
    }
    setServerError(result.code);
  };

  return (
    <RecordDialogShell
      titleId={titleId}
      title={t("fleet.maintenance.formTitle")}
      subtitle={vehicleSubtitle(ambulance)}
      onClose={onClose}
      onSubmit={submit}
      pending={pending}
      serverError={serverError}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field
          id={`${titleId}-price`}
          label={t("fleet.maintenance.price")}
          error={
            validation === "priceRequired" || validation === "priceInvalid"
              ? t(VALIDATION_KEYS[validation])
              : null
          }
        >
          <input
            id={`${titleId}-price`}
            value={price}
            onChange={(event) => {
              setPrice(event.target.value);
              if (validation === "priceRequired" || validation === "priceInvalid") {
                setValidation(null);
              }
            }}
            inputMode="decimal"
            autoFocus
            placeholder={t("fleet.record.required")}
            className={`${fieldClass} mt-1`}
            aria-invalid={
              validation === "priceRequired" || validation === "priceInvalid"
                ? true
                : undefined
            }
          />
        </Field>

        <Field
          id={`${titleId}-mileage`}
          label={t("fleet.record.mileage")}
          hint={t("fleet.record.mileageHint")}
          error={
            validation === "mileageRequired" || validation === "mileageInvalid"
              ? t(VALIDATION_KEYS[validation])
              : null
          }
        >
          <input
            id={`${titleId}-mileage`}
            value={mileage}
            onChange={(event) => {
              setMileage(event.target.value);
              if (validation === "mileageRequired" || validation === "mileageInvalid") {
                setValidation(null);
              }
            }}
            inputMode="decimal"
            className={`${fieldClass} mt-1`}
            aria-invalid={
              validation === "mileageRequired" || validation === "mileageInvalid"
                ? true
                : undefined
            }
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field id={`${titleId}-type`} label={t("fleet.maintenance.type")} error={null}>
          <input
            id={`${titleId}-type`}
            value={maintenanceType}
            onChange={(event) => setMaintenanceType(event.target.value)}
            placeholder={t("fleet.record.optional")}
            className={`${fieldClass} mt-1`}
          />
        </Field>

        <Field
          id={`${titleId}-mechanic`}
          label={t("fleet.maintenance.mechanic")}
          error={null}
        >
          <input
            id={`${titleId}-mechanic`}
            value={mechanicName}
            onChange={(event) => setMechanicName(event.target.value)}
            placeholder={t("fleet.record.optional")}
            className={`${fieldClass} mt-1`}
          />
        </Field>
      </div>

      <Field id={`${titleId}-repairs`} label={t("fleet.maintenance.repairs")} error={null}>
        <textarea
          id={`${titleId}-repairs`}
          value={repairs}
          onChange={(event) => setRepairs(event.target.value)}
          rows={2}
          placeholder={t("fleet.record.optional")}
          className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink focus:border-brand-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        />
      </Field>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field
          id={`${titleId}-next-mileage`}
          label={t("fleet.maintenance.nextMileage")}
          error={nextMileageError ? t("fleet.record.error.numberInvalid") : null}
        >
          <input
            id={`${titleId}-next-mileage`}
            value={nextMileage}
            onChange={(event) => {
              setNextMileage(event.target.value);
              if (nextMileageError) setNextMileageError(false);
            }}
            inputMode="decimal"
            placeholder={t("fleet.record.optional")}
            className={`${fieldClass} mt-1`}
            aria-invalid={nextMileageError || undefined}
          />
        </Field>

        <Field
          id={`${titleId}-next-date`}
          label={t("fleet.maintenance.nextDate")}
          error={null}
        >
          <input
            id={`${titleId}-next-date`}
            type="date"
            value={nextDate}
            onChange={(event) => setNextDate(event.target.value)}
            className={`${fieldClass} mt-1`}
          />
        </Field>
      </div>

      <Field id={`${titleId}-performed`} label={t("fleet.record.date")} error={null}>
        <input
          id={`${titleId}-performed`}
          type="datetime-local"
          value={performedAt}
          onChange={(event) => setPerformedAt(event.target.value)}
          className={`${fieldClass} mt-1`}
        />
      </Field>

      <Field id={`${titleId}-notes`} label={t("fleet.record.notes")} error={null}>
        <textarea
          id={`${titleId}-notes`}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={2}
          placeholder={t("fleet.record.optional")}
          className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink focus:border-brand-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        />
      </Field>
    </RecordDialogShell>
  );
}
