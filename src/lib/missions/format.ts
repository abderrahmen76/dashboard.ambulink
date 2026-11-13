import { TUNIS_TIME_ZONE } from "@/lib/dashboard/format";
import type { MessageKey, TranslateParams } from "@/lib/i18n/dictionaries";

import type { AnalyticsBucket, MissionStatus, RangePreset } from "./types";

/** Tunisia has no DST; `+01:00` keeps range boundaries stable year-round. */
const TUNIS_OFFSET = "+01:00";
const DAY_MS = 86_400_000;

const tunisDateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: TUNIS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  numberingSystem: "latn",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: TUNIS_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  numberingSystem: "latn",
});

const percentageFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
  numberingSystem: "latn",
});

const pad = (value: number) => String(value).padStart(2, "0");

function tunisYmd(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const parts = dateTimeParts(tunisDateFormatter, date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function dateTimeParts(formatter: Intl.DateTimeFormat, date: Date) {
  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  };
}

function addDays(ymd: string, days: number): string {
  const [year, month, day] = ymd.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day) + days * DAY_MS);
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}

function startOfTunisDay(ymd: string): string {
  return new Date(`${ymd}T00:00:00${TUNIS_OFFSET}`).toISOString();
}

function endOfTunisDay(ymd: string): string {
  return new Date(`${ymd}T23:59:59.999${TUNIS_OFFSET}`).toISOString();
}

export type RangeBounds = { from: string; to: string };

/**
 * Preset ranges are calendar-based in Africa/Tunis and anchored to the RPC's
 * `server_now`, so the server render and the hydrated client compute the same
 * bounds and never refetch a different window on mount.
 */
export function rangeBounds(
  preset: Exclude<RangePreset, "custom">,
  serverNowIso: string,
): RangeBounds {
  const today = tunisYmd(serverNowIso);
  switch (preset) {
    case "today":
      return { from: startOfTunisDay(today), to: serverNowIso };
    case "7d":
      return { from: startOfTunisDay(addDays(today, -6)), to: serverNowIso };
    case "30d":
      return { from: startOfTunisDay(addDays(today, -29)), to: serverNowIso };
    case "year":
      return { from: startOfTunisDay(`${today.slice(0, 4)}-01-01`), to: serverNowIso };
  }
}

export function customRangeBounds(fromYmd: string, toYmd: string): RangeBounds {
  const [start, end] = fromYmd <= toYmd ? [fromYmd, toYmd] : [toYmd, fromYmd];
  return { from: startOfTunisDay(start), to: endOfTunisDay(end) };
}

/** More than two months of daily bars is unreadable; switch to weekly. */
export function bucketFor(fromIso: string, toIso: string): AnalyticsBucket {
  const span = new Date(toIso).getTime() - new Date(fromIso).getTime();
  if (!Number.isFinite(span)) return "day";
  return span > 62 * DAY_MS ? "week" : "day";
}

/** `YYYY-MM-DD` in Africa/Tunis, for `<input type="date">` values. */
export function tunisYmdOf(iso: string): string {
  return tunisYmd(iso);
}

export function shiftDay(ymd: string, days: number): string {
  return addDays(ymd, days);
}

/** Monday of the week containing `ymd`; matches `date_trunc('week', …)` in SQL. */
export function weekStartOf(ymd: string): string {
  const [year, month, day] = ymd.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return addDays(ymd, -((weekday + 6) % 7));
}

export function formatMissionDateTime(iso: string | null, fallback: string): string {
  if (!iso) return fallback;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return fallback;
  const parts = dateTimeParts(dateTimeFormatter, date);
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`;
}

/** `YYYY-MM-DD` as returned by the RPC, rendered as a Tunis calendar date. */
export function formatDay(
  ymd: string | null,
  options: { withYear?: boolean } = {},
): string | null {
  if (!ymd) return null;
  const date = new Date(`${ymd}T12:00:00${TUNIS_OFFSET}`);
  if (Number.isNaN(date.getTime())) return null;
  const parts = dateTimeParts(dateTimeFormatter, date);
  return options.withYear
    ? `${parts.day}/${parts.month}/${parts.year}`
    : `${parts.day}/${parts.month}`;
}

export function formatDurationSeconds(
  seconds: number | null | undefined,
  t: (key: MessageKey, params?: TranslateParams) => string,
): string | null {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return null;
  const total = Math.max(0, Math.round(seconds));
  if (total < 3600) {
    return t("ma.duration.minutes", { value: Math.max(1, Math.round(total / 60)) });
  }
  return t("ma.duration.hours", {
    hours: Math.floor(total / 3600),
    minutes: Math.round((total % 3600) / 60),
  });
}

export function formatPercent(value: number | null | undefined): string | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return percentageFormatter.format(value);
}

export function shortReference(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

export function isMissionStatus(value: string | null): value is MissionStatus {
  return (
    value !== null &&
    [
      "requested",
      "accepted",
      "en_route",
      "arrived",
      "in_progress",
      "completed",
      "cancelled",
    ].includes(value)
  );
}

/** Shared pill colours: emerald = completed, accent = cancelled, blue = active. */
export function missionStatusTone(status: MissionStatus): string {
  if (status === "completed") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (status === "cancelled") return "bg-accent-50 text-accent-700 ring-accent-200";
  if (status === "requested" || status === "accepted") {
    return "bg-surface text-ink-soft ring-line";
  }
  return "bg-brand-50 text-brand-800 ring-brand-200";
}
