"use client";

import { Loader2, TriangleAlert, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { fleetAssignErrorMessageKey } from "@/lib/fleet/messages";
import type {
  FleetAmbulance,
  FleetAssignErrorCode,
  FleetAssignResult,
  FleetDriver,
} from "@/lib/fleet/types";
import { useI18n } from "@/lib/i18n/provider";

export function FleetDriverDialog({
  ambulance,
  drivers,
  onClose,
  onAssign,
  onAssigned,
}: {
  ambulance: FleetAmbulance;
  drivers: FleetDriver[];
  onClose: () => void;
  onAssign: (
    ambulanceId: string,
    driverId: string | null,
    confirmReplace: boolean,
  ) => Promise<FleetAssignResult>;
  onAssigned: () => void;
}) {
  const { t } = useI18n();
  const titleId = useId();
  const [selectedId, setSelectedId] = useState(ambulance.driver_id ?? "");
  const [confirm, setConfirm] = useState(false);
  const [pending, setPending] = useState<"assign" | "unassign" | null>(null);
  const [errorCode, setErrorCode] = useState<FleetAssignErrorCode | null>(null);
  const [serverDetail, setServerDetail] = useState<string | null>(null);
  const [serverConflict, setServerConflict] = useState(false);
  const [unassignArmed, setUnassignArmed] = useState(false);
  const aliveRef = useRef(true);
  const onCloseRef = useRef(onClose);

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

  const selected = drivers.find((driver) => driver.id === selectedId) ?? null;
  const vehicleHasOtherDriver =
    ambulance.driver_id !== null && selectedId !== ambulance.driver_id;
  const driverOnOtherVehicle =
    selected?.ambulance_id != null && selected.ambulance_id !== ambulance.id;
  const needsConfirm = vehicleHasOtherDriver || driverOnOtherVehicle || serverConflict;
  const noChange = selectedId === (ambulance.driver_id ?? "");

  const submitAssign = async () => {
    if (pending || !selectedId || noChange || (needsConfirm && !confirm)) return;
    setPending("assign");
    setErrorCode(null);
    setServerDetail(null);
    const result = await onAssign(ambulance.id, selectedId, needsConfirm ? confirm : false);
    if (!aliveRef.current) return;
    setPending(null);
    if (result.ok) {
      onAssigned();
      return;
    }
    setErrorCode(result.code);
    if (
      result.code === "ambulance_already_assigned" ||
      result.code === "driver_assigned_elsewhere"
    ) {
      setServerConflict(true);
      setConfirm(false);
      setServerDetail(result.ambulanceLabel ?? result.driverName ?? null);
    }
  };

  const submitUnassign = async () => {
    if (pending) return;
    if (!unassignArmed) {
      setUnassignArmed(true);
      return;
    }
    setPending("unassign");
    setErrorCode(null);
    const result = await onAssign(ambulance.id, null, false);
    if (!aliveRef.current) return;
    setPending(null);
    if (result.ok) {
      onAssigned();
      return;
    }
    setUnassignArmed(false);
    setErrorCode(result.code);
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
              {t("fleet.assign.title")}
            </h2>
            <p className="mt-0.5 truncate text-xs text-ink-soft">
              {ambulance.label?.trim() || ambulance.plate_number?.trim() || "—"}
            </p>
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

        <div className="space-y-4 px-5 py-4">
          <div className="rounded-xl border border-line/70 bg-surface/60 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-soft">
              {t("fleet.assign.current")}
            </p>
            <p className="mt-0.5 text-sm font-medium text-brand-900">
              {ambulance.driver_id
                ? ambulance.driver_name?.trim() || t("dc.details.notAssigned")
                : t("fleet.assign.none")}
            </p>
            {ambulance.driver_id ? (
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void submitUnassign()}
                  disabled={pending !== null}
                  className={`inline-flex h-7 items-center rounded-lg px-2.5 text-[11px] font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-60 ${
                    unassignArmed
                      ? "bg-accent-600 text-white hover:bg-accent-700"
                      : "border border-line bg-white text-accent-700 hover:bg-accent-50"
                  }`}
                >
                  {pending === "unassign" ? (
                    <Loader2 aria-hidden className="me-1 size-3 animate-spin" />
                  ) : null}
                  {unassignArmed
                    ? t("fleet.assign.confirmUnassign")
                    : t("fleet.assign.unassign")}
                </button>
                {unassignArmed ? (
                  <button
                    type="button"
                    onClick={() => setUnassignArmed(false)}
                    disabled={pending !== null}
                    className="inline-flex h-7 items-center rounded-lg border border-line bg-white px-2.5 text-[11px] font-semibold text-brand-900 transition hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-60"
                  >
                    {t("dc.new.cancel")}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          <div>
            <p className="text-xs font-semibold text-brand-900">{t("fleet.assign.choose")}</p>

            {drivers.length === 0 ? (
              <p className="mt-2 rounded-xl border border-line/70 bg-surface/60 px-3 py-3 text-sm text-ink-soft">
                {t("fleet.assign.noDrivers")}
              </p>
            ) : (
              <ul className="mt-2 max-h-64 space-y-1.5 overflow-y-auto">
                {drivers.map((driver) => {
                  const onMission = driver.active_mission_id !== null;
                  const checked = driver.id === selectedId;
                  return (
                    <li key={driver.id}>
                      <label
                        className={`flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 transition ${
                          checked
                            ? "border-brand-300 bg-brand-50/70"
                            : "border-line bg-white hover:bg-surface/60"
                        } ${onMission ? "cursor-not-allowed opacity-60" : ""}`}
                      >
                        <input
                          type="radio"
                          name="fleet-driver"
                          value={driver.id}
                          checked={checked}
                          disabled={onMission || pending !== null}
                          onChange={() => {
                            setSelectedId(driver.id);
                            setConfirm(false);
                            setServerConflict(false);
                            setServerDetail(null);
                            setErrorCode(null);
                          }}
                          className="mt-1 size-4 accent-brand-800"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="truncate text-sm font-medium text-brand-900">
                              {driver.full_name?.trim() || driver.id.slice(0, 8)}
                            </span>
                            {onMission ? (
                              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-200">
                                {t("fleet.assign.onMission")}
                              </span>
                            ) : driver.availability !== true ? (
                              <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-ink-soft ring-1 ring-line">
                                {t("fleet.assign.offline")}
                              </span>
                            ) : null}
                          </span>
                          {driver.ambulance_id &&
                          driver.id !== ambulance.driver_id ? (
                            <span className="mt-0.5 block text-[11px] text-ink-soft">
                              {t("fleet.assign.assignedTo", {
                                ambulance:
                                  driver.ambulance_label?.trim() ||
                                  driver.ambulance_id.slice(0, 8),
                              })}
                            </span>
                          ) : null}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {needsConfirm ? (
            <label className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
              <input
                type="checkbox"
                checked={confirm}
                onChange={(event) => setConfirm(event.target.checked)}
                disabled={pending !== null}
                className="mt-0.5 size-4 accent-brand-800"
              />
              <span className="min-w-0 text-[11px] leading-relaxed text-amber-800">
                <span className="block font-semibold">{t("fleet.assign.checkbox")}</span>
                <span className="block">{t("fleet.assign.confirmHint")}</span>
                {serverDetail ? <span className="mt-0.5 block font-medium">{serverDetail}</span> : null}
              </span>
            </label>
          ) : null}

          <p className="text-[11px] leading-relaxed text-ink-soft">
            {t("fleet.assign.eligibilityHint")}
          </p>
          {ambulance.driver_id ? (
            <p className="text-[11px] leading-relaxed text-ink-soft">
              {t("fleet.assign.unassignHint")}
            </p>
          ) : null}

          {errorCode ? (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-accent-100 bg-accent-50 px-3 py-2 text-xs font-medium text-accent-700"
            >
              <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
              {t(fleetAssignErrorMessageKey(errorCode))}
            </p>
          ) : null}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={pending !== null}
              className="inline-flex h-10 items-center rounded-lg border border-line bg-white px-3.5 text-sm font-semibold text-brand-900 transition hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-60"
            >
              {t("dc.details.close")}
            </button>
            <button
              type="button"
              onClick={() => void submitAssign()}
              disabled={
                pending !== null ||
                !selectedId ||
                noChange ||
                (needsConfirm && !confirm)
              }
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-800 px-4 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending === "assign" ? (
                <Loader2 aria-hidden className="size-4 animate-spin" />
              ) : null}
              {pending === "assign"
                ? t("fleet.assign.assigning")
                : t("fleet.assign.submit")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
