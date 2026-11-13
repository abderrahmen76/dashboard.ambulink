"use client";

import { Check, Circle, X } from "lucide-react";
import type { ReactNode } from "react";

import { formatDateTime } from "@/lib/dashboard/format";
import type { DashboardMission } from "@/lib/dashboard/types";
import type { MessageKey, TranslateParams } from "@/lib/i18n/dictionaries";
import { useI18n } from "@/lib/i18n/provider";

import { OfferCountdown } from "./mission-queue";

type StepState = "done" | "current" | "upcoming" | "expired" | "cancelled";

type Step = {
  key: string;
  label: MessageKey;
  state: StepState;
  caption?: ReactNode;
  driverInfo?: ReactNode;
};

const RANK: Record<string, number> = {
  requested: 0,
  accepted: 2,
  en_route: 3,
  arrived: 4,
  in_progress: 5,
  completed: 6,
};

function StepIcon({ state }: { state: StepState }) {
  if (state === "done") return <Check aria-hidden className="size-3.5" strokeWidth={3} />;
  if (state === "cancelled") return <X aria-hidden className="size-3.5" strokeWidth={3} />;
  if (state === "expired") return <Circle aria-hidden className="size-2 fill-current" />;
  if (state === "current") {
    return (
      <span className="relative grid size-2.5 place-items-center">
        <span className="absolute inline-flex size-2.5 animate-ping rounded-full bg-brand-300" />
        <span className="relative inline-flex size-2.5 rounded-full bg-current" />
      </span>
    );
  }
  return <Circle aria-hidden className="size-2" />;
}

const STATE_STYLES: Record<StepState, string> = {
  done: "bg-brand-800 text-white ring-2 ring-brand-100",
  current: "bg-brand-800 text-white ring-4 ring-brand-200",
  upcoming: "bg-white text-ink-soft/70 ring-2 ring-line",
  expired: "bg-amber-500 text-white ring-4 ring-amber-100",
  cancelled: "bg-accent-600 text-white ring-4 ring-accent-100",
};

const LINE_STYLES: Record<StepState, string> = {
  done: "bg-brand-300",
  current: "bg-line",
  upcoming: "bg-line",
  expired: "bg-amber-200",
  cancelled: "bg-accent-100",
};

export function MissionLifecycle({
  mission,
  initialNowMs,
  onRefresh,
}: {
  mission: DashboardMission | null;
  initialNowMs: number;
  onRefresh: () => void;
}) {
  const { t } = useI18n();

  if (!mission) {
    return (
      <section className="rounded-2xl border border-dashed border-line bg-white/60 px-5 py-8 text-center text-sm text-ink-soft">
        {t("dc.lifecycle.empty")}
      </section>
    );
  }

  const steps: Step[] = [];
  const cancelled = mission.status === "cancelled";
  const attempt = mission.attempt;
  const accepted = !!mission.accepted_at || !!mission.driver_id;
  const rank = RANK[mission.status] ?? 0;
  const acceptedIndex = 2;

  const driverInfo =
    accepted && (mission.driver_name || mission.ambulance_label)
      ? [mission.driver_name, mission.ambulance_label].filter(Boolean).join(" · ")
      : null;

  steps.push({
    key: "requested",
    label: "dc.status.requested",
    state: "done",
    caption: formatDateTime(mission.created_at, t("dc.details.notAssigned")),
  });

  const dispatchState: StepState =
    accepted || cancelled
      ? "done"
      : attempt?.state === "expired"
        ? "expired"
        : "current";

  steps.push({
    key: "dispatch",
    label: "dc.details.dispatch",
    state: dispatchState,
    caption: renderDispatchCaption(attempt, initialNowMs, onRefresh, t),
  });

  if (cancelled) {
    if (accepted) {
      steps.push({
        key: "accepted",
        label: "dc.status.accepted",
        state: "done",
        caption: formatDateTime(mission.accepted_at, t("dc.details.notAssigned")),
        driverInfo,
      });
    }
    steps.push({
      key: "cancelled",
      label: "dc.status.cancelled",
      state: "cancelled",
      caption: mission.cancelled_at
        ? t("dc.lifecycle.cancelledAt", { time: formatDateTime(mission.cancelled_at, "—") })
        : t("dc.lifecycle.cancelledNoTime"),
    });
  } else if (rank < acceptedIndex) {
    // The mission is still waiting for acceptance: later stages are listed
    // as upcoming, not as if they had happened.
    steps.push(
      {
        key: "accepted",
        label: "dc.status.accepted",
        state: "upcoming",
        caption: t("dc.details.notAssigned"),
      },
      {
        key: "en_route",
        label: "dc.status.en_route",
        state: "upcoming",
      },
      {
        key: "arrived",
        label: "dc.status.arrived",
        state: "upcoming",
      },
      {
        key: "in_progress",
        label: "dc.status.in_progress",
        state: "upcoming",
      },
      {
        key: "completed",
        label: "dc.status.completed",
        state: "upcoming",
      },
    );
  } else {
    const stages: Array<{ key: string; label: MessageKey; rank: number }> = [
      { key: "accepted", label: "dc.status.accepted", rank: 2 },
      { key: "en_route", label: "dc.status.en_route", rank: 3 },
      { key: "arrived", label: "dc.status.arrived", rank: 4 },
      { key: "in_progress", label: "dc.status.in_progress", rank: 5 },
      { key: "completed", label: "dc.status.completed", rank: 6 },
    ];
    for (const stage of stages) {
      const state: StepState =
        rank > stage.rank ? "done" : rank === stage.rank ? "current" : "upcoming";
      const caption =
        stage.key === "accepted"
          ? formatDateTime(mission.accepted_at, t("dc.details.notAssigned"))
          : stage.key === "completed"
            ? formatDateTime(mission.completed_at, t("dc.details.notAssigned"))
            : state === "done" || state === "current"
              ? t("dc.lifecycle.noEventTime")
              : undefined;
      steps.push({
        key: stage.key,
        label: stage.label,
        state,
        caption,
        driverInfo: stage.key === "accepted" ? driverInfo : undefined,
      });
    }
  }

  return (
    <section
      aria-label={t("dc.lifecycle.title")}
      className="rounded-2xl border border-line/70 bg-white p-5 shadow-soft"
    >
      <h2 className="text-sm font-semibold text-brand-900">{t("dc.lifecycle.title")}</h2>
      <p className="mt-0.5 text-xs text-ink-soft">{t("dc.lifecycle.subtitle")}</p>

      <ol className="mt-4">
        {steps.map((step, index) => (
          <li key={step.key} className="relative flex gap-3 pb-4 last:pb-0">
            {index < steps.length - 1 ? (
              <span
                aria-hidden
                className={`absolute start-[0.6875rem] top-7 h-[calc(100%-1.25rem)] w-px ${LINE_STYLES[step.state]}`}
              />
            ) : null}
            <span
              className={`z-10 grid size-6 shrink-0 place-items-center rounded-full ${STATE_STYLES[step.state]}`}
            >
              <StepIcon state={step.state} />
              {step.state === "current" ? (
                <span className="sr-only">{t("dc.lifecycle.current")}</span>
              ) : null}
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={`text-sm ${
                    step.state === "current"
                      ? "font-semibold text-brand-900"
                      : step.state === "cancelled"
                        ? "font-semibold text-accent-700"
                        : step.state === "expired"
                          ? "font-semibold text-amber-700"
                          : step.state === "done"
                            ? "font-medium text-brand-900"
                            : "font-medium text-ink-soft/80"
                  }`}
                >
                  {t(step.label)}
                </span>
                {step.state === "expired" ? (
                  <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-200">
                    {t("dc.queue.expiredHint")}
                  </span>
                ) : null}
              </div>
              {step.caption ? (
                <p className="mt-0.5 text-xs text-ink-soft">{step.caption}</p>
              ) : null}
              {step.driverInfo ? (
                <p className="mt-0.5 text-xs font-medium text-brand-700">{step.driverInfo}</p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function renderDispatchCaption(
  attempt: DashboardMission["attempt"],
  initialNowMs: number,
  onRefresh: () => void,
  t: (key: MessageKey, params?: TranslateParams) => string,
): ReactNode {
  if (!attempt) return t("dc.lifecycle.noDispatch");
  if (attempt.state === "offering") {
    return (
      <span className="flex flex-wrap items-center gap-1.5">
        <OfferCountdown
          key={attempt.id}
          deadlineAt={attempt.deadline_at}
          initialNowMs={initialNowMs}
          onDue={onRefresh}
        />
        <span>{t("dc.lifecycle.offeredTo", { count: attempt.offered_count })}</span>
        <span className="text-ink-soft/80">
          {t("dc.lifecycle.expiresAt", {
            time: formatDateTime(attempt.deadline_at, "—"),
          })}
        </span>
      </span>
    );
  }
  if (attempt.state === "expired") {
    return (
      <span>
        {t("dc.lifecycle.offeredTo", { count: attempt.offered_count })} ·{" "}
        {t("dc.lifecycle.expiresAt", {
          time: formatDateTime(attempt.deadline_at, "—"),
        })}
      </span>
    );
  }
  return t("dc.lifecycle.offeredTo", { count: attempt.offered_count });
}
