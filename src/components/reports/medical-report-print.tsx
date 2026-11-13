"use client";

import { useI18n } from "@/lib/i18n/provider";
import {
  formatAge,
  formatDecimal,
  formatReportDate,
  formatReportDateTime,
  hasText,
  parsePatientMedications,
} from "@/lib/reports/format";
import {
  missionStatusKey,
  needLabelKey,
  pseLabelKey,
  reportTypeKey,
  supportLabelKey,
} from "@/lib/reports/messages";
import type { ReportDetail } from "@/lib/reports/types";

const SECTION = "mt-4 break-inside-avoid";
const H = "border-b border-neutral-300 pb-1 text-[11px] font-bold uppercase tracking-wider text-neutral-700";
const CELL = "border-b border-neutral-200 px-1.5 py-1 text-[10px] text-neutral-800";
const MUTED = "text-neutral-500";

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0">
      <p className="text-[8px] font-semibold uppercase tracking-wider text-neutral-500">
        {label}
      </p>
      <p className="break-words text-[10px] text-neutral-900">{value ?? "—"}</p>
    </div>
  );
}

export function MedicalReportPrint({
  detail,
  selectedRevision,
}: {
  detail: ReportDetail;
  selectedRevision: number;
}) {
  const { t } = useI18n();
  const missing = t("reports.detail.notProvided");
  const report = detail.report;
  const profile = detail.patient_profile;
  const typeKey = reportTypeKey(report.report_type);
  const typeLabel =
    report.report_type === "autre" && hasText(report.report_type_other)
      ? report.report_type_other
      : typeKey
        ? t(typeKey)
        : missing;

  const selectedNeeds = detail.needs.filter((need) => need.is_selected);
  const supports = detail.respiratory_supports.filter((support) => support.is_enabled);
  const medications = profile ? parsePatientMedications(profile.medications) : [];
  const legacy = report.legacy_supports;

  const vitals: Array<{ label: string; unit: string; before: number | null; after: number | null }> = [
    { label: t("reports.detail.vitals.fc"), unit: "bpm", before: report.vitals.fc_before, after: report.vitals.fc_after },
    { label: t("reports.detail.vitals.spo2"), unit: "%", before: report.vitals.spo2_before, after: report.vitals.spo2_after },
    { label: t("reports.detail.vitals.sys"), unit: "mmHg", before: report.vitals.sys_before, after: report.vitals.sys_after },
    { label: t("reports.detail.vitals.dia"), unit: "mmHg", before: report.vitals.dia_before, after: report.vitals.dia_after },
    { label: t("reports.detail.vitals.rr"), unit: "/min", before: report.vitals.rr_before, after: report.vitals.rr_after },
    { label: t("reports.detail.vitals.temp"), unit: "°C", before: report.vitals.temp_before, after: report.vitals.temp_after },
    { label: t("reports.detail.vitals.glucose"), unit: "g/L", before: report.vitals.glucose_before, after: report.vitals.glucose_after },
    { label: t("reports.detail.vitals.pain"), unit: "", before: report.vitals.pain_before, after: report.vitals.pain_after },
  ];

  const value = (raw: number | null, unit: string) => {
    const formatted = formatDecimal(raw);
    if (formatted === null) return "—";
    return unit ? `${formatted} ${unit}` : formatted;
  };

  return (
    <div className="mx-auto w-full max-w-[182mm] bg-white text-neutral-900">
      <header className="flex items-start justify-between gap-6 border-b-2 border-neutral-800 pb-3">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-widest text-neutral-500">
            AmbuLink Clinic
          </p>
          <h1 className="mt-1 text-lg font-bold">{t("reports.print.title")}</h1>
          <p className="text-[10px] text-neutral-600">{detail.hospital.name}</p>
        </div>
        <div className="text-end text-[9px] text-neutral-600">
          <p className="font-semibold text-neutral-800">
            {t("reports.print.revision", { value: selectedRevision })}
          </p>
          <p>{t("reports.print.generated", { date: formatReportDateTime(detail.server_now, "—") })}</p>
          <p className="mt-1 max-w-52 text-[8px]">{t("reports.print.confidential")}</p>
        </div>
      </header>

      <section className={SECTION}>
        <h2 className={H}>{t("reports.detail.patient")}</h2>
        <div className="mt-2 grid grid-cols-4 gap-3">
          <Field
            label={t("reports.detail.patient")}
            value={hasText(report.patient_full_name) ? report.patient_full_name : missing}
          />
          <Field
            label={t("reports.detail.age")}
            value={report.patient_age === null ? missing : formatAge(report.patient_age, t)}
          />
          <Field label={t("reports.detail.missionRef")} value={report.mission_id} />
          <Field
            label={t("reports.revisions.transmittedAt")}
            value={formatReportDateTime(report.transmitted_at, missing)}
          />
          <Field label={t("reports.detail.driver")} value={report.driver_name ?? missing} />
          <Field
            label={t("reports.detail.mission.pickup")}
            value={detail.mission.pickup_label ?? missing}
          />
          <Field
            label={t("reports.detail.mission.destination")}
            value={detail.mission.destination_label ?? missing}
          />
          <Field
            label={t("reports.detail.mission.status")}
            value={
              missionStatusKey(detail.mission.status)
                ? t(missionStatusKey(detail.mission.status)!)
                : detail.mission.status
            }
          />
        </div>
      </section>

      <section className={SECTION}>
        <h2 className={H}>{t("reports.detail.section.transport")}</h2>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <Field
            label={t("reports.detail.transportReason")}
            value={report.transport_reason ?? missing}
          />
          <Field label={t("reports.detail.reportType")} value={typeLabel} />
        </div>
      </section>

      <section className={SECTION}>
        <h2 className={H}>{t("reports.detail.section.vitals")}</h2>
        <table className="mt-2 w-full border-collapse">
          <thead>
            <tr>
              <th className={`${CELL} text-start font-semibold`}>{t("reports.detail.section.vitals")}</th>
              <th className={`${CELL} text-start font-semibold`}>{t("reports.detail.vitals.before")}</th>
              <th className={`${CELL} text-start font-semibold`}>{t("reports.detail.vitals.after")}</th>
            </tr>
          </thead>
          <tbody>
            {vitals.map((vital) => (
              <tr key={vital.label}>
                <td className={`${CELL} ${MUTED}`}>{vital.label}</td>
                <td className={`${CELL} tabular-nums`}>{value(vital.before, vital.unit)}</td>
                <td className={`${CELL} tabular-nums`}>{value(vital.after, vital.unit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className={SECTION}>
        <h2 className={H}>{t("reports.detail.section.history")}</h2>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <Field
            label={t("reports.detail.medicalHistory")}
            value={report.medical_history ?? missing}
          />
          <Field
            label={t("reports.detail.knownPathologies")}
            value={report.known_pathologies ?? missing}
          />
        </div>
      </section>

      <section className={SECTION}>
        <h2 className={H}>{t("reports.detail.section.needs")}</h2>
        {selectedNeeds.length === 0 && detail.custom_needs.length === 0 && !hasText(report.patient_needs) ? (
          <p className={`mt-1 text-[10px] italic ${MUTED}`}>{t("reports.detail.needsEmpty")}</p>
        ) : selectedNeeds.length === 0 && detail.custom_needs.length === 0 ? (
          <p className="mt-1 whitespace-pre-line text-[10px]">{report.patient_needs}</p>
        ) : (
          <>
            <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[10px]">
              {selectedNeeds.map((need) => {
                const labelKey = needLabelKey(need.need_key);
                return (
                  <li key={need.need_key}>
                    {labelKey ? t(labelKey) : need.need_key}
                    {need.quantity !== null
                      ? ` — ${formatDecimal(need.quantity) ?? ""}${need.unit ? ` ${need.unit}` : ""}`
                      : ""}
                  </li>
                );
              })}
            </ul>
            {detail.custom_needs.length > 0 ? (
              <ul className="mt-1 text-[10px]">
                {detail.custom_needs.map((custom) => (
                  <li key={custom.position}>
                    {custom.label}
                    {custom.value !== null
                      ? ` — ${formatDecimal(custom.value) ?? ""}${custom.unit ? ` ${custom.unit}` : ""}`
                      : ""}
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        )}
      </section>

      <section className={SECTION}>
        <h2 className={H}>{t("reports.detail.section.respiratory")}</h2>
        {supports.length === 0 && !legacy.vni_required && !legacy.vc_required ? (
          <p className={`mt-1 text-[10px] italic ${MUTED}`}>
            {t("reports.detail.respiratoryEmpty")}
          </p>
        ) : (
          <ul className="mt-1 space-y-1 text-[10px]">
            {supports.map((support) => {
              const labelKey = supportLabelKey(support.support_key);
              const parameters = [
                support.pep !== null ? `${t("reports.detail.pep")} ${formatDecimal(support.pep)}` : null,
                support.aide !== null ? `${t("reports.detail.aide")} ${formatDecimal(support.aide)}` : null,
                support.respiratory_rate !== null
                  ? `${t("reports.detail.respiratoryRate")} ${formatDecimal(support.respiratory_rate)}`
                  : null,
                support.vcc !== null ? `${t("reports.detail.vcc")} ${formatDecimal(support.vcc)}` : null,
                support.tidal_volume !== null
                  ? `${t("reports.detail.tidalVolume")} ${formatDecimal(support.tidal_volume)}`
                  : null,
              ].filter((part): part is string => part !== null);
              return (
                <li key={support.support_key}>
                  <span className="font-semibold">
                    {labelKey ? t(labelKey) : support.support_key}
                  </span>
                  {parameters.length > 0 ? ` — ${parameters.join(" · ")}` : ""}
                </li>
              );
            })}
            {legacy.vni_required ? (
              <li>
                {t("reports.support.vni")} — {formatDecimal(legacy.vni_quantity) ?? "—"}{" "}
                {legacy.vni_unit ?? ""}
              </li>
            ) : null}
            {legacy.vc_required ? (
              <li>
                {t("reports.support.vc")} — {formatDecimal(legacy.vc_quantity) ?? "—"}{" "}
                {legacy.vc_unit ?? ""}
              </li>
            ) : null}
          </ul>
        )}
      </section>

      <section className={SECTION}>
        <h2 className={H}>{t("reports.detail.section.medications")}</h2>
        {detail.medications.length === 0 ? (
          <p className={`mt-1 text-[10px] italic ${MUTED}`}>
            {t("reports.detail.medicationsEmpty")}
          </p>
        ) : (
          <table className="mt-1 w-full border-collapse">
            <tbody>
              {detail.medications.map((medication) => (
                <tr key={medication.position}>
                  <td className={`${CELL} font-medium`}>{medication.name}</td>
                  <td className={`${CELL} ${MUTED}`}>{medication.dosage ?? "—"}</td>
                  <td className={`${CELL} ${MUTED}`}>{medication.frequency ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <h3 className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-neutral-600">
          {t("reports.detail.section.pse")}
        </h3>
        {detail.pse_medications.length === 0 && !legacy.pse_required ? (
          <p className={`mt-1 text-[10px] italic ${MUTED}`}>{t("reports.detail.pseEmpty")}</p>
        ) : (
          <ul className="mt-1 text-[10px]">
            {detail.pse_medications.map((pse) => {
              const labelKey = pseLabelKey(pse.drug_key);
              return (
                <li key={pse.drug_key}>
                  <span className="font-semibold">
                    {labelKey ? t(labelKey) : pse.drug_key}
                  </span>
                  {" — "}
                  {t("reports.detail.dose")} {pse.dose === null ? "—" : formatDecimal(pse.dose)}
                  {pse.unit ? ` ${pse.unit}` : ""}
                  {" · "}
                  {t("reports.detail.duration")}{" "}
                  {pse.duration_minutes === null
                    ? "—"
                    : t("reports.unit.minutes", { value: pse.duration_minutes })}
                </li>
              );
            })}
            {detail.pse_medications.length === 0 && legacy.pse_required ? (
              <li>
                <span className="font-semibold">{t("reports.detail.legacySupport")}</span>
                {" — "}
                {t("reports.detail.dose")} {formatDecimal(legacy.pse_quantity) ?? "—"}
                {legacy.pse_unit ? ` ${legacy.pse_unit}` : ""}
                {" · "}
                {t("reports.detail.duration")}{" "}
                {legacy.pse_duration_minutes === null
                  ? "—"
                  : t("reports.unit.minutes", { value: legacy.pse_duration_minutes })}
              </li>
            ) : null}
          </ul>
        )}
      </section>

      <section className={SECTION}>
        <h2 className={H}>{t("reports.detail.section.observations")}</h2>
        <p className="mt-1 whitespace-pre-line text-[10px] leading-relaxed">
          {hasText(report.observations) ? report.observations : missing}
        </p>
      </section>

      <section className="mt-5 break-before-auto border-2 border-neutral-400 p-3">
        <h2 className="text-[10px] font-bold uppercase tracking-wider text-neutral-700">
          {t("reports.print.patientProfile")}
        </h2>
        {!profile ? (
          <p className={`mt-1 text-[10px] italic ${MUTED}`}>{t("reports.patient.empty")}</p>
        ) : (
          <>
            <div className="mt-2 grid grid-cols-4 gap-3">
              <Field
                label={t("reports.patient.dateOfBirth")}
                value={formatReportDate(profile.date_of_birth, missing)}
              />
              <Field
                label={t("reports.patient.height")}
                value={formatDecimal(profile.height_cm) ? `${formatDecimal(profile.height_cm)} cm` : missing}
              />
              <Field
                label={t("reports.patient.weight")}
                value={formatDecimal(profile.weight_kg) ? `${formatDecimal(profile.weight_kg)} kg` : missing}
              />
              <Field
                label={t("reports.patient.bloodGroup")}
                value={
                  hasText(profile.blood_group)
                    ? `${profile.blood_group} · ${
                        profile.blood_group_verified
                          ? t("reports.patient.bloodGroupVerified")
                          : t("reports.patient.bloodGroupDeclared")
                      }`
                    : missing
                }
              />
            </div>

            <div className="mt-2 grid grid-cols-2 gap-3">
              <Field
                label={t("reports.patient.allergyStatus")}
                value={
                  profile.allergy_status === "none_known"
                    ? t("reports.patient.allergy.none_known")
                    : profile.allergy_status === "unknown"
                      ? t("reports.patient.allergy.unknown")
                      : t("reports.patient.allergy.unspecified")
                }
              />
              <Field
                label={t("reports.patient.medicationAllergies")}
                value={profile.medication_allergies}
              />
              <Field
                label={t("reports.patient.otherAllergies")}
                value={profile.other_allergies}
              />
              <Field
                label={t("reports.patient.chronicConditions")}
                value={profile.chronic_conditions}
              />
              <Field
                label={t("reports.patient.medicalHistory")}
                value={profile.medical_history}
              />
              <Field
                label={t("reports.patient.otherHealthInfo")}
                value={profile.other_health_info}
              />
              <Field
                label={t("reports.patient.mobilityLimitations")}
                value={profile.mobility_limitations}
              />
              <Field
                label={t("reports.patient.mobilityAssistance")}
                value={profile.mobility_assistance}
              />
              <Field
                label={t("reports.patient.transportNotes")}
                value={profile.transport_notes}
              />
            </div>

            <div className="mt-2">
              <p className="text-[8px] font-semibold uppercase tracking-wider text-neutral-500">
                {t("reports.patient.medications")}
              </p>
              {medications.length === 0 ? (
                <p className={`text-[10px] italic ${MUTED}`}>
                  {t("reports.patient.medicationsEmpty")}
                </p>
              ) : (
                <ul className="text-[10px]">
                  {medications.map((medication, index) => (
                    <li key={`${medication.name}-${index}`}>
                      {medication.name}
                      {[medication.dosage, medication.frequency]
                        .filter((part): part is string => hasText(part))
                        .map((part) => ` · ${part}`)
                        .join("")}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-2 grid grid-cols-3 gap-3">
              <Field
                label={t("reports.patient.contactName")}
                value={profile.emergency_contact_name}
              />
              <Field
                label={t("reports.patient.relationship")}
                value={profile.emergency_contact_relationship}
              />
              <Field
                label={t("reports.patient.phone")}
                value={profile.emergency_contact_phone}
              />
            </div>
          </>
        )}
      </section>

      <section className={SECTION}>
        <h2 className={H}>{t("reports.revisions.title")}</h2>
        <p className="mt-1 text-[10px]">
          {t("reports.print.revision", { value: selectedRevision })} ·{" "}
          {t("reports.detail.finalized")} {formatReportDateTime(report.finalized_at, "—")}
          {hasText(report.finalized_by_name) ? ` · ${report.finalized_by_name}` : ""} ·{" "}
          {t("reports.detail.transmitted")} {formatReportDateTime(report.transmitted_at, "—")}
        </p>
        <ul className="mt-1 space-y-0.5 text-[9px] text-neutral-600">
          {detail.revisions.map((revision) => (
            <li key={revision.revision_no}>
              {t("reports.revisions.revision", { value: revision.revision_no })} ·{" "}
              {t("reports.revisions.finalizedAt")} {formatReportDateTime(revision.finalized_at, "—")} ·{" "}
              {t("reports.revisions.transmittedAt")}{" "}
              {formatReportDateTime(revision.transmitted_at, "—")}
              {revision.reviewed_at
                ? ` · ${t("reports.revisions.reviewedAt")} ${formatReportDateTime(revision.reviewed_at, "—")}`
                : ""}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
