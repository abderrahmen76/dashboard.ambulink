"use client";

import { Building2, Loader2, Phone, Truck, UserRound, X, XCircle } from "lucide-react";
import { useState } from "react";

import { canCancelMission, formatDateTime } from "@/lib/dashboard/format";
import { dashboardErrorMessageKey } from "@/lib/dashboard/messages";
import type { DashboardErrorCode } from "@/lib/dashboard/service";
import type { DashboardDriver, DashboardMission } from "@/lib/dashboard/types";
import { useDriverContact } from "@/lib/dashboard/use-driver-contact";
import { useI18n } from "@/lib/i18n/provider";
import { formatTunisianPhone, normalizeTunisianPhoneDigits, toE164 } from "@/lib/phone";

import { LocationLabel } from "./location-label";
import { MissionStatusPill } from "./mission-queue";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-soft">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-medium text-brand-900">{value}</dd>
    </div>
  );
}

export function MissionDetails({
  mission,
  drivers,
  companyName,
  onRedispatch,
  onRedispatchCompany,
  onCancelRequest,
  onClose,
}: {
  mission: DashboardMission | null;
  drivers: DashboardDriver[];
  companyName: string | null;
  onRedispatch: (missionId: string, driverId: string | null) => Promise<DashboardErrorCode | null>;
  onRedispatchCompany: (missionId: string) => Promise<DashboardErrorCode | null>;
  onCancelRequest: (mission: DashboardMission) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [choice, setChoice] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<DashboardErrorCode | null>(null);
  const driverContact = useDriverContact(
    mission?.id ?? null,
    mission?.driver_id ?? null,
  );

  if (!mission) {
    return (
      <section className="rounded-2xl border border-dashed border-line bg-white/60 px-5 py-8 text-center text-sm text-ink-soft">
        {t("dc.details.empty")}
      </section>
    );
  }

  const eligible = drivers.filter(
    (driver) => driver.availability === true && !driver.active_mission_id,
  );
  const digits = normalizeTunisianPhoneDigits(mission.patient_phone ?? "");
  const phoneLabel = formatTunisianPhone(mission.patient_phone);
  const driverPhone = driverContact.contact?.driver_phone ?? null;
  const driverDigits = normalizeTunisianPhoneDigits(driverPhone ?? "");
  const driverPhoneLabel = formatTunisianPhone(driverPhone);
  const driverName =
    driverContact.contact?.driver_name?.trim() || mission.driver_name?.trim() || null;
  const companyMission = mission.manager_entry && mission.dispatch_mode === "company";
  const canRedispatch =
    mission.manager_entry &&
    mission.status === "requested" &&
    !mission.driver_id &&
    mission.attempt?.state !== "offering";
  const canCancel = canCancelMission(mission);

  const submitRedispatch = async () => {
    setPending(true);
    setError(null);
    const code = await onRedispatch(mission.id, choice || null);
    setPending(false);
    if (code) setError(code);
    else setChoice("");
  };

  const submitCompanyRedispatch = async () => {
    setPending(true);
    setError(null);
    const code = await onRedispatchCompany(mission.id);
    setPending(false);
    if (code) setError(code);
  };

  return (
    <section
      aria-label={t("dc.details.title")}
      className="rounded-2xl border border-line/70 bg-white p-5 shadow-soft"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold text-brand-900">{t("dc.details.title")}</h2>
          <MissionStatusPill status={mission.status} />
          <span className="inline-flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-[10px] font-medium text-ink-soft">
            {companyMission ? (
              <Truck aria-hidden className="size-3" />
            ) : mission.manager_entry ? (
              <Building2 aria-hidden className="size-3" />
            ) : (
              <UserRound aria-hidden className="size-3" />
            )}
            {companyMission
              ? t("dc.details.companyMission")
              : mission.manager_entry
                ? t("dc.details.managerMission")
                : t("dc.details.patientMission")}
          </span>
          <span className="text-[11px] text-ink-soft/70">#{mission.id.slice(0, 8)}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("dc.details.close")}
          className="grid size-8 place-items-center rounded-lg text-ink-soft transition hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>

      {mission.driver_id ? (
        <section
          aria-label={t("dc.details.driverContact")}
          className="mt-4 flex flex-col gap-3 rounded-xl border border-line/70 bg-surface/60 p-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-100 text-brand-800">
              <UserRound aria-hidden className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wide text-ink-soft">
                {t("dc.details.driverContact")}
              </p>
              <p className="truncate text-sm font-semibold text-brand-900">
                {driverName ?? t("dc.details.notAssigned")}
              </p>
            </div>
          </div>
          {driverDigits ? (
            <a
              href={`tel:${toE164(driverDigits)}`}
              aria-label={t("dc.details.callDriver")}
              title={t("dc.details.callDriver")}
              className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg bg-brand-800 px-3.5 text-sm font-semibold text-white transition hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <Phone aria-hidden className="size-4" />
              {driverPhoneLabel}
            </a>
          ) : driverContact.loading ? (
            <span className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-line bg-white px-3 text-xs text-ink-soft">
              <Loader2 aria-hidden className="size-4 animate-spin" />
              {t("dc.details.driverContactLoading")}
            </span>
          ) : (
            <span className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-dashed border-line bg-white px-3 text-xs text-ink-soft">
              {t("dc.details.driverPhoneUnavailable")}
            </span>
          )}
        </section>
      ) : null}

      <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Row
          label={t("dc.details.patient")}
          value={mission.patient_name?.trim() || t("dc.queue.patientUnknown")}
        />
        <Row
          label={t("dc.details.phone")}
          value={
            digits ? (
              <a
                href={`tel:${toE164(digits)}`}
                className="inline-flex items-center gap-1.5 text-brand-700 hover:underline"
              >
                <Phone aria-hidden className="size-3.5" />
                {phoneLabel}
              </a>
            ) : (
              <span className="text-ink-soft">{t("dc.details.noPhone")}</span>
            )
          }
        />
        <Row
          label={t("dc.details.pickup")}
          value={
            <LocationLabel
              label={mission.pickup_label}
              point={
                mission.pickup_lat != null && mission.pickup_lng != null
                  ? { lat: mission.pickup_lat, lng: mission.pickup_lng }
                  : null
              }
            />
          }
        />
        <Row
          label={t("dc.details.destination")}
          value={
            <LocationLabel
              label={mission.destination_label}
              point={
                mission.destination_lat != null && mission.destination_lng != null
                  ? { lat: mission.destination_lat, lng: mission.destination_lng }
                  : null
              }
            />
          }
        />
        <Row
          label={t("dc.details.motif")}
          value={mission.symptoms?.trim() || t("dc.details.noMotif")}
        />
        {companyMission && companyName ? (
          <Row label={t("dc.details.company")} value={companyName} />
        ) : null}
        <Row label={t("dc.details.driver")} value={mission.driver_name ?? t("dc.details.notAssigned")} />
        <Row
          label={t("dc.details.ambulance")}
          value={mission.ambulance_label ?? t("dc.details.notAssigned")}
        />
        <Row
          label={t("dc.details.created")}
          value={formatDateTime(mission.created_at, "—")}
        />
        <Row
          label={t("dc.details.accepted")}
          value={formatDateTime(mission.accepted_at, t("dc.details.notAssigned"))}
        />
        <Row
          label={t("dc.details.completed")}
          value={formatDateTime(mission.completed_at, t("dc.details.notAssigned"))}
        />
      </dl>

      {canRedispatch && companyMission ? (
        <div className="mt-4 flex flex-col gap-2 rounded-xl border border-line/70 bg-surface/60 p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="min-w-0 text-xs text-ink-soft">
            {companyName
              ? t("dc.details.retryCompanyHint", { company: companyName })
              : t("dc.details.retryCompany")}
          </p>
          <button
            type="button"
            onClick={submitCompanyRedispatch}
            disabled={pending}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-brand-800 px-4 text-sm font-semibold text-white transition hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-progress disabled:opacity-60"
          >
            {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
            {t("dc.details.retryCompany")}
          </button>
        </div>
      ) : canRedispatch ? (
        <div className="mt-4 flex flex-col gap-2 rounded-xl border border-line/70 bg-surface/60 p-3 sm:flex-row sm:items-center">
          <label htmlFor="redispatch-driver" className="sr-only">
            {t("dc.new.selectDriver")}
          </label>
          <select
            id="redispatch-driver"
            value={choice}
            onChange={(event) => setChoice(event.target.value)}
            disabled={pending}
            className="h-10 flex-1 rounded-lg border border-line bg-white px-3 text-sm text-brand-900 focus:border-brand-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <option value="">{t("dc.new.broadcast")}</option>
            {eligible.map((driver) => (
              <option key={driver.id} value={driver.id}>
                {driver.full_name ?? driver.id.slice(0, 8)}
                {driver.ambulance_label ? ` · ${driver.ambulance_label}` : ""}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={submitRedispatch}
            disabled={pending || (choice !== "" && eligible.length === 0)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand-800 px-4 text-sm font-semibold text-white transition hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-progress disabled:opacity-60"
          >
            {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
            {choice ? t("dc.details.retryDriver") : t("dc.details.retry")}
          </button>
        </div>
      ) : null}

      {canRedispatch && !companyMission && eligible.length === 0 ? (
        <p className="mt-2 text-xs text-ink-soft">{t("dc.new.noEligible")}</p>
      ) : null}

      {canCancel ? (
        <div className="mt-4 flex flex-col gap-2 rounded-xl border border-accent-100 bg-accent-50/50 p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="min-w-0 text-xs text-ink-soft">{t("dc.details.cancelHint")}</p>
          <button
            type="button"
            onClick={() => onCancelRequest(mission)}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-accent-200 bg-white px-4 text-sm font-semibold text-accent-700 transition hover:bg-accent-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
          >
            <XCircle aria-hidden className="size-4" />
            {t("dc.details.cancel")}
          </button>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-2 rounded-lg bg-accent-50 px-3 py-2 text-xs text-accent-700">
          {t(dashboardErrorMessageKey(error))}
        </p>
      ) : null}
    </section>
  );
}
