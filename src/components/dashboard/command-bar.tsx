"use client";

import { Loader2, Plus, Radio, RefreshCw, WifiOff } from "lucide-react";

import { LanguageSelect } from "@/components/language-select";
import { SignOutButton } from "@/components/sign-out-button";
import { formatTime } from "@/lib/dashboard/format";
import type { ConnectionState } from "@/lib/dashboard/use-dispatch-center";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { useI18n } from "@/lib/i18n/provider";

const STATE_STYLES: Record<
  ConnectionState,
  { className: string; icon: "live" | "offline"; label: MessageKey; pulse: boolean }
> = {
  live: {
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: "live",
    label: "dc.command.live",
    pulse: false,
  },
  connecting: {
    className: "border-amber-200 bg-amber-50 text-amber-700",
    icon: "offline",
    label: "dc.command.connecting",
    pulse: true,
  },
  reconnecting: {
    className: "border-amber-200 bg-amber-50 text-amber-700",
    icon: "offline",
    label: "dc.command.reconnecting",
    pulse: true,
  },
  offline: {
    className: "border-accent-100 bg-accent-50 text-accent-700",
    icon: "offline",
    label: "dc.command.offline",
    pulse: false,
  },
};

export function CommandBar({
  hospitalName,
  connection,
  updatedAt,
  refreshing,
  onRefresh,
  onNewMission,
}: {
  hospitalName: string;
  connection: ConnectionState;
  updatedAt: number | null;
  refreshing: boolean;
  onRefresh: () => void;
  onNewMission: () => void;
}) {
  const { t } = useI18n();
  const state = STATE_STYLES[connection];

  return (
    <header className="sticky top-0 z-30 border-b border-line/80 bg-white/95 backdrop-blur">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-700">
            {t("dc.command.badge")}
          </p>
          <h1 className="truncate text-lg font-semibold tracking-tight text-brand-900">
            {hospitalName}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold ${state.className}`}
            role="status"
            aria-live="polite"
          >
            {state.icon === "live" ? (
              <Radio aria-hidden className="size-3.5" />
            ) : (
              <WifiOff aria-hidden className="size-3.5" />
            )}
            <span className={state.pulse ? "animate-pulse" : undefined}>
              {t(state.label)}
            </span>
          </span>

          {updatedAt ? (
            <span className="hidden text-xs text-ink-soft sm:inline">
              {t("dc.command.updated", { time: formatTime(new Date(updatedAt).toISOString(), "—") })}
            </span>
          ) : null}

          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            aria-label={t("dc.command.refresh")}
            className="grid size-9 place-items-center rounded-full border border-line bg-white text-brand-800 transition hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-60"
          >
            <RefreshCw aria-hidden className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>

          <LanguageSelect />
          <SignOutButton />

          <button
            type="button"
            onClick={onNewMission}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-accent-600 px-3.5 text-sm font-semibold text-white shadow-soft transition hover:bg-accent-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 sm:px-4"
          >
            <Plus aria-hidden className="size-4" />
            <span className="hidden sm:inline">{t("dc.command.newMission")}</span>
            <span className="sr-only sm:hidden">{t("dc.command.newMission")}</span>
          </button>
        </div>
      </div>
    </header>
  );
}

export function RefreshingHint({ refreshing }: { refreshing: boolean }) {
  const { t } = useI18n();
  if (!refreshing) return null;
  return (
    <span
      aria-hidden
      className="pointer-events-none fixed bottom-4 end-4 z-40 inline-flex items-center gap-2 rounded-full bg-brand-900/90 px-3 py-1.5 text-xs font-medium text-white shadow-soft"
    >
      <Loader2 className="size-3.5 animate-spin" />
      {t("dc.command.refresh")}
    </span>
  );
}
