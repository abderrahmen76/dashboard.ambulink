"use client";

import {
  Ambulance as AmbulanceIcon,
  Clock3,
  Phone,
  RefreshCw,
  UserCog,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";

import {
  formatDateTime,
  formatDuration,
  formatInteger,
} from "@/lib/dashboard/format";
import type { MissionStatus } from "@/lib/dashboard/types";
import { driverErrorMessageKey } from "@/lib/drivers/messages";
import type { DriverErrorCode, DriverRow, DriverStats } from "@/lib/drivers/types";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { useI18n } from "@/lib/i18n/provider";

import { DriverStatusBadge } from "./driver-status-badge";
import { driverInitials, driverPhoneParts } from "./drivers-table";

const MISSION_STATUS_KEYS: Record<MissionStatus, MessageKey> = {
  requested: "dc.status.requested",
  accepted: "dc.status.accepted",
  en_route: "dc.status.en_route",
  arrived: "dc.status.arrived",
  in_progress: "dc.status.in_progress",
  completed: "dc.status.completed",
  cancelled: "dc.status.cancelled",
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-soft">
        {label}
      </dt>
      <dd className="mt-0.5 truncate text-sm text-ink">{children}</dd>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line/70 bg-surface/60 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-soft">
        {label}
      </p>
      <p className="mt-0.5 truncate text-sm font-semibold tabular-nums text-brand-900">
        {value}
      </p>
    </div>
  );
}

export function DriverDetails({
  driver,
  stats,
  statsLoading,
  statsError,
  refreshing,
  onAssign,
  onRefresh,
}: {
  driver: DriverRow | null;
  stats: DriverStats | null;
  statsLoading: boolean;
  statsError: DriverErrorCode | null;
  refreshing: boolean;
  onAssign: (driver: DriverRow) => void;
  onRefresh: () => void;
}) {
  const { t, locale } = useI18n();

  if (!driver) {
    return (
      <aside className="flex h-full min-h-[280px] flex-col items-center justify-center gap-2 rounded-2xl border border-line/70 bg-white p-6 text-center shadow-soft">
        <span className="grid size-11 place-items-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
          <Users aria-hidden className="size-5" />
        </span>
        <p className="text-sm font-semibold text-brand-900">{t("drivers.details.empty")}</p>
        <p className="text-xs text-ink-soft">{t("drivers.details.emptyHint")}</p>
      </aside>
    );
  }

  const phone = driverPhoneParts(driver.phone);
  const mission = driver.active_mission;
  const ambulance = driver.ambulance;
  const online = driver.availability === true;
  const busy = driver.status === "on_mission";

  return (
    <aside className="flex h-full flex-col overflow-hidden rounded-2xl border border-line/70 bg-white shadow-soft">
      <header className="flex items-start justify-between gap-3 border-b border-line/60 px-4 py-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-700">
            {t("drivers.details.title")}
          </p>
          <div className="mt-1 flex min-w-0 items-center gap-2">
            <span
              aria-hidden
              className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-50 text-xs font-semibold text-brand-800 ring-1 ring-brand-100"
            >
              {driverInitials(driver.full_name)}
            </span>
            <h2 className="min-w-0 truncate text-base font-semibold text-brand-900">
              {driver.full_name?.trim() || "—"}
            </h2>
          </div>
          <div className="mt-1.5">
            <DriverStatusBadge status={driver.status} />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => onAssign(driver)}
            disabled={busy}
            aria-label={t("drivers.assign.title")}
            title={
              busy ? t("fleet.assign.error.driverMission") : t("drivers.assign.title")
            }
            className="grid size-8 place-items-center rounded-lg border border-line text-brand-800 transition hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white"
          >
            <UserCog aria-hidden className="size-4" />
          </button>
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            aria-label={t("dc.command.refresh")}
            title={t("dc.command.refresh")}
            className="grid size-8 place-items-center rounded-lg border border-line text-brand-800 transition hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-60"
          >
            <RefreshCw aria-hidden className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <section aria-label={t("drivers.details.contact")}>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-3">
            <Field label={t("drivers.details.phone")}>
              {phone.label && phone.href ? (
                <a
                  href={phone.href}
                  className="inline-flex items-center gap-1.5 text-brand-700 underline-offset-2 transition hover:text-brand-900 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                >
                  <Phone aria-hidden className="size-3.5 shrink-0" />
                  <span dir="ltr">{phone.label}</span>
                </a>
              ) : (
                <span className="text-ink-soft">{t("drivers.phone.missing")}</span>
              )}
            </Field>
            <Field label={t("drivers.details.app")}>
              <span className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden
                  className={`size-1.5 rounded-full ${online ? "bg-emerald-500" : "bg-slate-400"}`}
                />
                {online ? t("fleet.details.driverOnline") : t("fleet.details.driverOffline")}
              </span>
            </Field>
          </dl>
        </section>

        <section aria-label={t("dc.details.ambulance")} className="border-t border-line/60 pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-soft">
            {t("dc.details.ambulance")}
          </h3>

          {ambulance ? (
            <div className="mt-2 flex items-center gap-2.5 rounded-xl bg-surface/70 p-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white text-brand-700 ring-1 ring-line">
                <AmbulanceIcon aria-hidden className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-brand-900">
                  {ambulance.label?.trim() || "—"}
                </p>
                <p className="truncate font-mono text-[11px] text-ink-soft">
                  {ambulance.plate_number?.trim() || "—"}
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-2 space-y-1">
              <p className="text-sm text-ink-soft">{t("fleet.state.unassigned")}</p>
              <p className="text-[11px] leading-relaxed text-ink-soft">
                {t("fleet.assign.eligibilityHint")}
              </p>
            </div>
          )}
        </section>

        <section aria-label={t("fleet.details.mission")} className="border-t border-line/60 pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-soft">
            {t("fleet.details.mission")}
          </h3>

          {mission ? (
            <div className="mt-2 space-y-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                  {t(MISSION_STATUS_KEYS[mission.status] ?? "dc.status.accepted")}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] text-ink-soft">
                  <Clock3 aria-hidden className="size-3.5" />
                  {formatDateTime(mission.created_at, "—")}
                </span>
              </div>

              <div className="space-y-2 rounded-xl bg-surface/70 p-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-soft">
                    {t("dc.details.pickup")}
                  </p>
                  <p className="mt-0.5 text-sm text-ink">
                    {mission.pickup_label?.trim() || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-soft">
                    {t("dc.details.destination")}
                  </p>
                  <p className="mt-0.5 text-sm text-ink">
                    {mission.destination_label?.trim() || "—"}
                  </p>
                </div>
                <p className="text-[11px] text-ink-soft">
                  {t("dc.details.accepted")}: {formatDateTime(mission.accepted_at, "—")}
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm text-ink-soft">{t("drivers.mission.none")}</p>
          )}
        </section>

        <section aria-label={t("drivers.details.activity")} className="border-t border-line/60 pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-soft">
            {t("drivers.details.activity")}
          </h3>

          {statsError ? (
            <p role="alert" className="mt-2 text-xs text-accent-700">
              {t(driverErrorMessageKey(statsError))}
            </p>
          ) : statsLoading || !stats ? (
            <p className="mt-2 text-xs text-ink-soft">
              {t("drivers.details.statsLoading")}
            </p>
          ) : stats.assigned_count === 0 ? (
            <p className="mt-2 text-xs text-ink-soft">{t("drivers.details.statsEmpty")}</p>
          ) : (
            <div className="mt-2 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <StatTile
                  label={t("drivers.details.assignedCount")}
                  value={formatInteger(stats.assigned_count, locale)}
                />
                <StatTile
                  label={t("drivers.details.completedCount")}
                  value={formatInteger(stats.completed_count, locale)}
                />
                <StatTile
                  label={t("drivers.details.cancelledCount")}
                  value={formatInteger(stats.cancelled_count, locale)}
                />
                <StatTile
                  label={t("drivers.details.avgAccept")}
                  value={
                    stats.avg_accept_seconds != null
                      ? formatDuration(stats.avg_accept_seconds, t)
                      : "—"
                  }
                />
              </div>
              <dl className="space-y-1 text-[11px] text-ink-soft">
                <div className="flex items-center justify-between gap-2">
                  <dt>{t("drivers.details.firstAssigned")}</dt>
                  <dd className="font-medium text-ink">
                    {formatDateTime(stats.first_assigned_at, "—")}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt>{t("drivers.details.lastCompleted")}</dt>
                  <dd className="font-medium text-ink">
                    {formatDateTime(stats.last_completed_at, "—")}
                  </dd>
                </div>
              </dl>
            </div>
          )}
        </section>
      </div>
    </aside>
  );
}
