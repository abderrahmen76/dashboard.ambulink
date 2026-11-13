"use client";

import { Building2, Clock3, Loader2, MapPin } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { formatRelative, isExpiredOffer } from "@/lib/dashboard/format";
import type { DashboardMission, MissionStatus, QueueFilter } from "@/lib/dashboard/types";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { useI18n } from "@/lib/i18n/provider";

const STATUS_LABEL: Record<MissionStatus, MessageKey> = {
  requested: "dc.status.requested",
  accepted: "dc.status.accepted",
  en_route: "dc.status.en_route",
  arrived: "dc.status.arrived",
  in_progress: "dc.status.in_progress",
  completed: "dc.status.completed",
  cancelled: "dc.status.cancelled",
};

const STATUS_TONE: Record<MissionStatus, string> = {
  requested: "bg-amber-50 text-amber-700 ring-amber-200",
  accepted: "bg-sky-50 text-sky-700 ring-sky-200",
  en_route: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  arrived: "bg-violet-50 text-violet-700 ring-violet-200",
  in_progress: "bg-teal-50 text-teal-700 ring-teal-200",
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  cancelled: "bg-slate-100 text-slate-600 ring-slate-200",
};

export const FILTERS: Array<{ value: QueueFilter; label: MessageKey }> = [
  { value: "all", label: "dc.filter.all" },
  { value: "awaiting", label: "dc.filter.awaiting" },
  { value: "accepted", label: "dc.filter.accepted" },
  { value: "en_route", label: "dc.filter.enRoute" },
  { value: "arrived", label: "dc.filter.arrived" },
  { value: "in_progress", label: "dc.filter.inProgress" },
  { value: "completed", label: "dc.filter.completed" },
  { value: "cancelled", label: "dc.filter.cancelled" },
  { value: "expired", label: "dc.filter.expired" },
];

export function matchesFilter(mission: DashboardMission, filter: QueueFilter): boolean {
  if (filter === "all") return true;
  if (filter === "expired") return isExpiredOffer(mission);
  if (filter === "awaiting") {
    return mission.status === "requested" && !mission.driver_id && !isExpiredOffer(mission);
  }
  return mission.status === filter;
}

export function MissionStatusPill({ status }: { status: MissionStatus }) {
  const { t } = useI18n();
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${STATUS_TONE[status]}`}
    >
      {t(STATUS_LABEL[status])}
    </span>
  );
}

/**
 * Local countdown only; the 120 s deadline is enforced by the database. The
 * initial value is derived from the server timestamp so SSR and hydration
 * render the same number, and the tick starts after mount.
 */
export function OfferCountdown({
  deadlineAt,
  initialNowMs,
  onDue,
}: {
  deadlineAt: string;
  initialNowMs: number;
  onDue: () => void;
}) {
  const { t } = useI18n();
  const [now, setNow] = useState(initialNowMs);
  const firedRef = useRef(false);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const left = Math.max(0, Math.ceil((Date.parse(deadlineAt) - now) / 1000));

  useEffect(() => {
    if (left > 0 || firedRef.current) return;
    firedRef.current = true;
    const id = setTimeout(onDue, 1500);
    return () => clearTimeout(id);
  }, [left, onDue]);

  if (left <= 0) {
    return <span className="text-[11px] font-medium text-accent-700">{t("dc.queue.expiredHint")}</span>;
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold tabular-nums text-brand-800">
      <Clock3 aria-hidden className="size-3" />
      {t("dc.queue.liveFor", { seconds: left })}
    </span>
  );
}

export function MissionQueue({
  missions,
  total,
  hasMore,
  loadingMore,
  loadError,
  onLoadMore,
  filter,
  onFilter,
  selectedId,
  onSelect,
  initialNowMs,
  onRefresh,
}: {
  missions: DashboardMission[];
  total: number;
  hasMore: boolean;
  loadingMore: boolean;
  loadError: boolean;
  onLoadMore: () => void;
  filter: QueueFilter;
  onFilter: (filter: QueueFilter) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  initialNowMs: number;
  onRefresh: () => void;
}) {
  const { t } = useI18n();
  const listRef = useRef<HTMLUListElement>(null);
  const previousFirstIdRef = useRef<string | null>(null);
  const previousHeightRef = useRef(0);
  const previousFilterRef = useRef(filter);

  const counts = new Map<QueueFilter, number>();
  for (const entry of FILTERS) {
    counts.set(entry.value, missions.filter((mission) => matchesFilter(mission, entry.value)).length);
  }
  const visible = missions.filter((mission) => matchesFilter(mission, filter));
  const firstId = visible[0]?.id ?? null;

  // A page appended at the bottom keeps scrollTop; a Realtime insert at the
  // top would otherwise push the visible rows down, so the height delta is
  // added back when the user is not already at the top.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    if (previousFilterRef.current !== filter) {
      previousFilterRef.current = filter;
      list.scrollTop = 0;
      previousFirstIdRef.current = firstId;
      previousHeightRef.current = list.scrollHeight;
      return;
    }
    const height = list.scrollHeight;
    const delta = height - previousHeightRef.current;
    if (
      previousFirstIdRef.current !== null &&
      firstId !== previousFirstIdRef.current &&
      delta > 0 &&
      list.scrollTop > 0
    ) {
      list.scrollTop += delta;
    }
    previousFirstIdRef.current = firstId;
    previousHeightRef.current = height;
  }, [filter, firstId, missions]);

  return (
    <section className="flex h-[440px] flex-col rounded-2xl border border-line/70 bg-white shadow-soft lg:h-[520px]">
      <div className="border-b border-line/70 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-brand-900">{t("dc.queue.title")}</h2>
          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
            {total}
          </span>
        </div>
        <div className="-mx-1 mt-2 flex gap-1 overflow-x-auto pb-1">
          {FILTERS.map((entry) => {
            const active = entry.value === filter;
            const count = counts.get(entry.value) ?? 0;
            return (
              <button
                key={entry.value}
                type="button"
                onClick={() => onFilter(entry.value)}
                aria-pressed={active}
                className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                  active
                    ? "bg-brand-800 text-white"
                    : "bg-surface text-ink-soft hover:bg-surface-strong"
                }`}
              >
                {t(entry.label)}
                <span className={active ? "text-brand-100" : "text-ink-soft/70"}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <ul
        ref={listRef}
        onScroll={(event) => {
          const list = event.currentTarget;
          if (!hasMore || loadingMore || loadError) return;
          const remaining = list.scrollHeight - list.scrollTop - list.clientHeight;
          if (remaining < 140) onLoadMore();
        }}
        className="flex-1 divide-y divide-line/60 overflow-y-auto"
      >
        {visible.length === 0 ? (
          <li className="px-4 py-10 text-center text-sm text-ink-soft">
            {missions.length === 0 ? t("dc.queue.emptyAll") : t("dc.queue.empty")}
          </li>
        ) : (
          visible.map((mission) => {
            const expired = isExpiredOffer(mission);
            const active = mission.id === selectedId;
            return (
              <li key={mission.id}>
                <button
                  type="button"
                  onClick={() => onSelect(mission.id)}
                  aria-pressed={active}
                  className={`flex w-full items-start gap-3 px-4 py-3 text-start transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                    active ? "bg-brand-50/80" : "hover:bg-surface/70"
                  }`}
                >
                  <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-surface-strong text-brand-700">
                    <MapPin aria-hidden className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-semibold text-brand-900">
                        {mission.patient_name?.trim() || t("dc.queue.patientUnknown")}
                      </span>
                      {mission.manager_entry ? (
                        <span title={t("dc.details.managerMission")} className="shrink-0">
                          <Building2 aria-hidden className="size-3.5 text-brand-400" />
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-ink-soft">
                      {mission.pickup_label ?? "—"}
                    </span>
                    <span className="mt-1 flex items-center gap-2">
                      <MissionStatusPill status={mission.status} />
                      <span className="text-[11px] text-ink-soft/80">
                        {formatRelative(mission.created_at, initialNowMs, t)}
                      </span>
                    </span>
                  </span>
                  <span className="mt-0.5 shrink-0">
                    {expired ? (
                      <span className="rounded-full bg-accent-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-700 ring-1 ring-accent-100">
                        {t("dc.filter.expired")}
                      </span>
                    ) : mission.attempt?.state === "offering" ? (
                      <OfferCountdown
                        key={mission.attempt.id}
                        deadlineAt={mission.attempt.deadline_at}
                        initialNowMs={initialNowMs}
                        onDue={onRefresh}
                      />
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })
        )}

        {loadError ? (
          <li className="px-4 py-3 text-center">
            <p className="text-xs text-accent-700">{t("dc.queue.loadFailed")}</p>
            <button
              type="button"
              onClick={onLoadMore}
              className="mt-1.5 inline-flex h-8 items-center rounded-lg border border-line bg-white px-3 text-xs font-semibold text-brand-800 transition hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              {t("dc.queue.retry")}
            </button>
          </li>
        ) : hasMore ? (
          <li className="px-4 py-3 text-center">
            <button
              type="button"
              onClick={onLoadMore}
              disabled={loadingMore}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-white px-3 text-xs font-semibold text-brand-800 transition hover:bg-surface disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              {loadingMore ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : null}
              {loadingMore ? t("dc.queue.loadingMore") : t("dc.queue.loadMore")}
            </button>
          </li>
        ) : visible.length > 0 ? (
          <li className="px-4 py-3 text-center text-[11px] text-ink-soft/70">
            {t("dc.queue.end")}
          </li>
        ) : null}
      </ul>
    </section>
  );
}
