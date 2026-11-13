"use client";

import { AlertTriangle, ChevronDown, HeartPulse, Phone } from "lucide-react";
import type { ReactNode } from "react";

import { useI18n } from "@/lib/i18n/provider";
import {
  formatDecimal,
  formatReportDate,
  hasText,
  parsePatientMedications,
} from "@/lib/reports/format";
import type { PatientMedicalProfile } from "@/lib/reports/types";

function Group({
  title,
  children,
  open = false,
}: {
  title: string;
  children: ReactNode;
  open?: boolean;
}) {
  return (
    <details className="group rounded-xl border border-emerald-200 bg-white/60" open={open}>
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown
          aria-hidden
          className="ms-auto size-3.5 text-emerald-700/70 transition group-open:rotate-180"
        />
      </summary>
      <div className="px-3 pb-3">{children}</div>
    </details>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700/70">
        {label}
      </dt>
      <dd className="mt-0.5 break-words text-xs text-ink">
        {value ?? <span className="text-ink-soft/70">—</span>}
      </dd>
    </div>
  );
}

function Block({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700/70">
        {label}
      </p>
      <p className="mt-1 whitespace-pre-line break-words text-xs leading-relaxed text-ink">
        {hasText(value) ? value : <span className="text-ink-soft/70">—</span>}
      </p>
    </div>
  );
}

export function PatientProfilePanel({
  profile,
}: {
  profile: PatientMedicalProfile | null;
}) {
  const { t } = useI18n();

  return (
    <section className="rounded-xl border border-emerald-200 bg-emerald-50/60">
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-emerald-200/80 px-3 py-2.5">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200">
            <HeartPulse aria-hidden className="size-4" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-emerald-900">
              {t("reports.patient.title")}
            </h3>
            <p className="mt-0.5 text-[11px] font-medium text-emerald-800/80">
              {t("reports.patient.source")}
            </p>
          </div>
        </div>
      </header>

      {!profile ? (
        <p className="px-3 py-4 text-xs text-emerald-900/80">
          {t("reports.patient.empty")}
        </p>
      ) : (
        <div className="space-y-3 px-3 py-3">
          <section>
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-800">
              {t("reports.patient.general")}
            </h4>
            <dl className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Row
                label={t("reports.patient.dateOfBirth")}
                value={
                  hasText(profile.date_of_birth)
                    ? formatReportDate(profile.date_of_birth, "—")
                    : null
                }
              />
              <Row
                label={t("reports.patient.height")}
                value={
                  formatDecimal(profile.height_cm)
                    ? `${formatDecimal(profile.height_cm)} cm`
                    : null
                }
              />
              <Row
                label={t("reports.patient.weight")}
                value={
                  formatDecimal(profile.weight_kg)
                    ? `${formatDecimal(profile.weight_kg)} kg`
                    : null
                }
              />
              <Row
                label={t("reports.patient.bloodGroup")}
                value={
                  hasText(profile.blood_group)
                    ? `${profile.blood_group} · ${
                        profile.blood_group_verified
                          ? t("reports.patient.bloodGroupVerified")
                          : t("reports.patient.bloodGroupDeclared")
                      }`
                    : null
                }
              />
            </dl>
          </section>

          <section className="rounded-xl border border-amber-200/80 bg-amber-50/70 p-3">
            <h4 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-800">
              <AlertTriangle aria-hidden className="size-3.5" />
              {t("reports.patient.allergies")}
            </h4>
            <p className="mt-1 text-xs font-medium text-amber-900">
              {profile.allergy_status === "none_known"
                ? t("reports.patient.allergy.none_known")
                : profile.allergy_status === "unknown"
                  ? t("reports.patient.allergy.unknown")
                  : t("reports.patient.allergy.unspecified")}
            </p>
            <dl className="mt-2 grid gap-2 sm:grid-cols-2">
              <Row
                label={t("reports.patient.medicationAllergies")}
                value={profile.medication_allergies}
              />
              <Row
                label={t("reports.patient.otherAllergies")}
                value={profile.other_allergies}
              />
            </dl>
          </section>

          <Group title={t("reports.patient.history")} open>
            <div className="grid gap-2 sm:grid-cols-3">
              <Block
                label={t("reports.patient.chronicConditions")}
                value={profile.chronic_conditions}
              />
              <Block
                label={t("reports.patient.medicalHistory")}
                value={profile.medical_history}
              />
              <Block
                label={t("reports.patient.otherHealthInfo")}
                value={profile.other_health_info}
              />
            </div>
          </Group>

          <Group title={t("reports.patient.medications")}>
            {(() => {
              const medications = parsePatientMedications(profile.medications);
              if (medications.length === 0) {
                return (
                  <p className="text-xs text-emerald-900/70">
                    {t("reports.patient.medicationsEmpty")}
                  </p>
                );
              }
              return (
                <ul className="divide-y divide-emerald-200/70 rounded-lg border border-emerald-200 bg-white/70">
                  {medications.map((medication, index) => (
                    <li
                      key={`${medication.name}-${index}`}
                      className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 text-xs"
                    >
                      <span className="font-medium text-ink">{medication.name}</span>
                      <span className="text-ink-soft">
                        {[medication.dosage, medication.frequency]
                          .filter((part): part is string => hasText(part))
                          .join(" · ") || "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              );
            })()}
          </Group>

          <Group title={t("reports.patient.mobility")}>
            <div className="grid gap-2 sm:grid-cols-3">
              <Block
                label={t("reports.patient.mobilityLimitations")}
                value={profile.mobility_limitations}
              />
              <Block
                label={t("reports.patient.mobilityAssistance")}
                value={profile.mobility_assistance}
              />
              <Block
                label={t("reports.patient.transportNotes")}
                value={profile.transport_notes}
              />
            </div>
          </Group>

          <section className="rounded-xl border border-emerald-200 bg-white/70 p-3">
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-800">
              {t("reports.patient.emergency")}
            </h4>
            {hasText(profile.emergency_contact_name) ||
            hasText(profile.emergency_contact_phone) ? (
              <dl className="mt-2 grid gap-2 sm:grid-cols-3">
                <Row
                  label={t("reports.patient.contactName")}
                  value={profile.emergency_contact_name}
                />
                <Row
                  label={t("reports.patient.relationship")}
                  value={profile.emergency_contact_relationship}
                />
                <div className="min-w-0">
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700/70">
                    {t("reports.patient.phone")}
                  </dt>
                  <dd className="mt-0.5 text-xs text-ink">
                    {hasText(profile.emergency_contact_phone) ? (
                      <a
                        href={`tel:${profile.emergency_contact_phone.replace(/[^+0-9]/g, "")}`}
                        className="inline-flex items-center gap-1 font-medium text-brand-700 underline-offset-2 hover:underline"
                      >
                        <Phone aria-hidden className="size-3" />
                        {profile.emergency_contact_phone}
                      </a>
                    ) : (
                      <span className="text-ink-soft/70">—</span>
                    )}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="mt-1 text-xs text-emerald-900/70">
                {t("reports.patient.noContact")}
              </p>
            )}
          </section>

          <p className="text-[10px] text-emerald-800/60">
            {t("reports.patient.updatedAt", {
              date: formatReportDate(profile.updated_at, "—"),
            })}
          </p>
        </div>
      )}
    </section>
  );
}
