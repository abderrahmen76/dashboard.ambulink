import type { Locale } from "@/lib/i18n/config";
import type { MessageKey, TranslateParams } from "@/lib/i18n/dictionaries";

import type { GpsFreshness } from "./types";

export const TUNIS_TIME_ZONE = "Africa/Tunis";

/** Live GPS window used across AmbuLink (120 s); beyond it the fix is delayed. */
export const GPS_LIVE_MS = 120_000;
export const GPS_DELAYED_MS = 600_000;

const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: TUNIS_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  numberingSystem: "latn",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: TUNIS_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  numberingSystem: "latn",
});

/**
 * Explicit `Africa/Tunis` + latn digits keep server and client output identical,
 * so the SSR pass and hydration never disagree on a timestamp.
 */
export function formatTime(iso: string | null, fallback: string): string {
  if (!iso) return fallback;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return fallback;
  return timeFormatter.format(date);
}

export function formatDateTime(iso: string | null, fallback: string): string {
  if (!iso) return fallback;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return fallback;
  const parts = dateTimeFormatter.formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("day")}/${get("month")} ${get("hour")}:${get("minute")}`;
}

export function formatInteger(value: number | null | undefined, locale: Locale): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat(locale === "ar" ? "ar-TN" : locale === "fr" ? "fr-TN" : "en-GB", {
    maximumFractionDigits: 0,
    numberingSystem: "latn",
  }).format(value);
}

export function formatDuration(
  seconds: number,
  t: (key: MessageKey, params?: TranslateParams) => string,
): string {
  const total = Math.max(0, Math.round(seconds));
  if (total < 60) return t("dc.kpi.seconds", { value: total });
  return t("dc.kpi.minutes", {
    minutes: Math.floor(total / 60),
    seconds: total % 60,
  });
}

export function formatRelative(
  iso: string | null,
  nowMs: number,
  t: (key: MessageKey, params?: TranslateParams) => string,
): string {
  if (!iso) return t("dc.time.now");
  const timestamp = new Date(iso).getTime();
  if (Number.isNaN(timestamp)) return t("dc.time.now");
  const seconds = Math.max(0, Math.round((nowMs - timestamp) / 1000));
  if (seconds < 45) return t("dc.time.now");
  if (seconds < 3600) return t("dc.time.secondsAgo", { count: seconds });
  if (seconds < 86_400) return t("dc.time.minutesAgo", { count: Math.round(seconds / 60) });
  return t("dc.time.hoursAgo", { count: Math.round(seconds / 3600) });
}

export function gpsFreshness(updatedAt: string | null, nowMs: number): GpsFreshness {
  if (!updatedAt) return "missing";
  const timestamp = new Date(updatedAt).getTime();
  if (Number.isNaN(timestamp)) return "missing";
  const age = nowMs - timestamp;
  if (age <= GPS_LIVE_MS) return "live";
  if (age <= GPS_DELAYED_MS) return "delayed";
  return "stale";
}

/** A mission remains actionable only while it is `requested` and unassigned. */
export function isAwaitingMission(mission: {
  status: string;
  driver_id: string | null;
}): boolean {
  return mission.status === "requested" && !mission.driver_id;
}

export function isExpiredOffer(mission: {
  status: string;
  driver_id: string | null;
  attempt: { state: string } | null;
}): boolean {
  return isAwaitingMission(mission) && mission.attempt?.state === "expired";
}
