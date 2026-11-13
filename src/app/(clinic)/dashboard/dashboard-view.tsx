"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { CancelMissionDialog } from "@/components/dashboard/cancel-mission-dialog";
import { CommandBar, RefreshingHint } from "@/components/dashboard/command-bar";
import { KpiGrid } from "@/components/dashboard/kpi-grid";
import { LiveMapPanel } from "@/components/dashboard/live-map-panel";
import { MissionDetails } from "@/components/dashboard/mission-details";
import { MissionLifecycle } from "@/components/dashboard/mission-lifecycle";
import { MissionQueue } from "@/components/dashboard/mission-queue";
import { NewMissionDialog } from "@/components/dashboard/new-mission-dialog";
import { useHospitalName } from "@/components/dashboard/hospital-name-context";
import { dashboardErrorMessageKey } from "@/lib/dashboard/messages";
import type { DashboardErrorCode, DashboardResult } from "@/lib/dashboard/service";
import type { DashboardBootstrap, QueueFilter } from "@/lib/dashboard/types";
import { useDispatchCenter } from "@/lib/dashboard/use-dispatch-center";
import { useI18n } from "@/lib/i18n/provider";
import { useTabState } from "@/lib/navigation/tab-state";

export function DashboardView({
  initialSnapshot,
}: {
  initialSnapshot: DashboardResult<DashboardBootstrap>;
}) {
  return <DispatchCenter initialSnapshot={initialSnapshot} />;
}

/**
 * Freshness clock. Starts at the snapshot's server time — identical on the
 * server and in the first client render — then follows the local clock every
 * `intervalMs` so stale GPS is eventually flagged.
 */
function useClock(start: number, intervalMs: number) {
  const [now, setNow] = useState(start);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return Math.max(now, start);
}

function DispatchCenter({
  initialSnapshot,
}: {
  initialSnapshot: DashboardResult<DashboardBootstrap>;
}) {
  const { t } = useI18n();
  const fallbackHospitalName = useHospitalName();
  const {
    snapshot,
    origins,
    error,
    connection,
    refreshing,
    updatedAt,
    missionTotal,
    hasMore,
    loadingMore,
    missionError,
    refresh,
    loadMore,
    redispatch,
    redispatchCompany,
    cancelMission,
    createMission,
    createCompanyMission,
    loadCompanyOptions,
    loadCompanyRecipients,
  } = useDispatchCenter(initialSnapshot);
  const [selectedId, setSelectedId] = useTabState<string | null>(
    "dashboard:selected",
    null,
  );
  const [filter, setFilter] = useTabState<QueueFilter>("dashboard:filter", "all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [cancelMissionId, setCancelMissionId] = useState<string | null>(null);
  const [cancelNotice, setCancelNotice] = useState(false);

  const serverNowMs = updatedAt ?? 0;
  const clockMs = useClock(serverNowMs, 30_000);

  const selected = useMemo(
    () => snapshot?.missions.find((mission) => mission.id === selectedId) ?? null,
    [snapshot, selectedId],
  );
  const cancelTarget = useMemo(
    () =>
      cancelMissionId === null
        ? null
        : snapshot?.missions.find((mission) => mission.id === cancelMissionId) ?? null,
    [cancelMissionId, snapshot],
  );

  useEffect(() => {
    if (!cancelNotice) return;
    const id = setTimeout(() => setCancelNotice(false), 6000);
    return () => clearTimeout(id);
  }, [cancelNotice]);

  const handleCancel = async (missionId: string): Promise<DashboardErrorCode | null> => {
    const code = await cancelMission(missionId);
    if (!code) {
      setCancelNotice(true);
      setCancelMissionId(null);
    }
    return code;
  };

  const hospitalName = snapshot?.hospital.name ?? fallbackHospitalName;

  return (
    <>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
        <CommandBar
          hospitalName={hospitalName}
          connection={connection}
          updatedAt={updatedAt}
          refreshing={refreshing}
          onRefresh={() => void refresh()}
          onNewMission={() => setDialogOpen(true)}
        />

        <main className="flex-1 space-y-4 p-4 sm:p-6">
          {!snapshot ? (
            <section className="rounded-2xl border border-line/70 bg-white p-6 shadow-soft">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-50 text-accent-700 ring-1 ring-accent-100">
                  <AlertTriangle aria-hidden className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-semibold text-brand-900">
                    {t("dc.command.badge")}
                  </h2>
                  <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                    {t(dashboardErrorMessageKey(error ?? "unexpected"))}
                  </p>
                  <button
                    type="button"
                    onClick={() => void refresh()}
                    disabled={refreshing}
                    className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg bg-brand-800 px-3.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
                  >
                    <RefreshCw aria-hidden className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
                    {t("dc.command.refresh")}
                  </button>
                </div>
              </div>
            </section>
          ) : error === "stale" ? (
            <p
              role="status"
              className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800"
            >
              {t("dc.error.stale")}
            </p>
          ) : null}

          {cancelNotice ? (
            <p
              role="status"
              className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800"
            >
              {t("dc.cancel.success")}
            </p>
          ) : null}

          <KpiGrid kpis={snapshot?.kpis ?? null} />

          {snapshot ? (
            <>
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                <LiveMapPanel
                  snapshot={snapshot}
                  selectedId={selectedId}
                  nowMs={clockMs}
                />
                <MissionQueue
                  missions={snapshot.missions}
                  total={missionTotal}
                  hasMore={hasMore}
                  loadingMore={loadingMore}
                  loadError={missionError !== null}
                  onLoadMore={() => void loadMore()}
                  filter={filter}
                  onFilter={setFilter}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  initialNowMs={serverNowMs || clockMs}
                  onRefresh={() => void refresh()}
                  onCancelRequest={(mission) => setCancelMissionId(mission.id)}
                />
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                <MissionDetails
                  key={selected?.id ?? "empty"}
                  mission={selected}
                  drivers={snapshot.drivers}
                  companyName={selected ? origins[selected.id]?.company_name ?? null : null}
                  onRedispatch={redispatch}
                  onRedispatchCompany={redispatchCompany}
                  onCancelRequest={(mission) => setCancelMissionId(mission.id)}
                  onClose={() => setSelectedId(null)}
                />
                <MissionLifecycle
                  key={`lifecycle-${selected?.id ?? "empty"}`}
                  mission={selected}
                  initialNowMs={serverNowMs || clockMs}
                  onRefresh={() => void refresh()}
                />
              </div>
            </>
          ) : null}
        </main>
      </div>

      {dialogOpen ? (
        <NewMissionDialog
          hospital={snapshot?.hospital ?? null}
          drivers={snapshot?.drivers ?? []}
          onClose={() => setDialogOpen(false)}
          onCreate={createMission}
          onCreateCompany={createCompanyMission}
          loadCompanyOptions={loadCompanyOptions}
          loadCompanyRecipients={loadCompanyRecipients}
          onCreated={(missionId) => {
            setFilter("all");
            setSelectedId(missionId);
          }}
        />
      ) : null}

      {cancelTarget ? (
        <CancelMissionDialog
          mission={cancelTarget}
          onClose={() => setCancelMissionId(null)}
          onConfirm={handleCancel}
        />
      ) : null}

      <RefreshingHint refreshing={refreshing} />

      <span className="sr-only" role="status" aria-live="polite">
        {connection === "live" ? t("dc.command.live") : t("dc.error.stale")}
      </span>
    </>
  );
}
