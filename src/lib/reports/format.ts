import { TUNIS_TIME_ZONE } from "@/lib/dashboard/format";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: TUNIS_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
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

const decimalFormatter = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 2,
  numberingSystem: "latn",
});

export function formatReportDate(iso: string | null, fallback: string): string {
  if (!iso) return fallback;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return fallback;
  const parts = dateFormatter.formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")}`;
}

export function formatReportDateTime(iso: string | null, fallback: string): string {
  if (!iso) return fallback;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return fallback;
  const parts = dateTimeFormatter.formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get("minute")}`;
}

/** Numeric values arrive as JSON numbers; strings are accepted defensively. */
export function formatDecimal(value: number | string | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return null;
  return decimalFormatter.format(numeric);
}

export function formatAge(
  age: number | null,
  t: (key: "reports.unit.years", params: { value: number }) => string,
): string {
  if (age === null || !Number.isFinite(age)) return "—";
  return t("reports.unit.years", { value: age });
}

export function hasText(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim() !== "";
}

/** The mission UUID is the only stable identifier the schema exposes. */
export function shortReference(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

export type ParsedMedication = {
  name: string;
  dosage: string | null;
  frequency: string | null;
};

/**
 * `patient_medical_profiles.medications` is a jsonb array saved by the patient
 * app. Accept only array items with a non-empty name; ignore every other shape.
 */
export function parsePatientMedications(value: unknown): ParsedMedication[] {
  let source: unknown = value;
  if (typeof source === "string") {
    try {
      source = JSON.parse(source);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(source)) return [];

  const result: ParsedMedication[] = [];
  for (const item of source.slice(0, 50)) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const name = typeof row.name === "string" ? row.name.trim() : "";
    if (name === "") continue;
    const dosage =
      typeof row.dosage === "string" && row.dosage.trim() !== ""
        ? row.dosage.trim()
        : typeof row.dosage === "number"
          ? String(row.dosage)
          : null;
    const frequency =
      typeof row.frequency === "string" && row.frequency.trim() !== ""
        ? row.frequency.trim()
        : typeof row.frequency === "number"
          ? String(row.frequency)
          : null;
    result.push({ name, dosage, frequency });
  }
  return result;
}
