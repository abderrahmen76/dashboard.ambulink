"use client";

import {
  Activity,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ClipboardList,
  Clock3,
  Eye,
  FileText,
  HeartPulse,
  History,
  Loader2,
  MapPin,
  MessageSquareText,
  Pill,
  Siren,
  Syringe,
  UserRound,
  Wind,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { useI18n } from "@/lib/i18n/provider";
import {
  formatAge,
  formatDecimal,
  formatReportDateTime,
  hasText,
  shortReference,
} from "@/lib/reports/format";
import {
  missionStatusKey,
  needLabelKey,
  pseLabelKey,
  reportErrorMessageKey,
  reportTypeKey,
  supportLabelKey,
} from "@/lib/reports/messages";
import type { ConsultReportResult, ReportDetail, SetSeenResult } from "@/lib/reports/types";

import { DocumentPreview } from "./document-preview";
import { PatientProfilePanel } from "./patient-profile-panel";
import { ReportVitalsTable } from "./report-vitals";
import { RevisionTimeline } from "./revision-timeline";

function Section({
  icon: Icon,
  title,
  children,
  tone = "brand",
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
  tone?: "brand" | "emerald" | "amber";
}) {
  const iconTone =
    tone === "emerald"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
      : tone === "amber"
        ? "bg-amber-50 text-amber-700 ring-amber-100"
        : "bg-brand-50 text-brand-700 ring-brand-100";

  return (
    <section className="border-t border-line/60 px-4 py-3">
      <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-800">
        <span className={`grid size-5 place-items-center rounded ring-1 ${iconTone}`}>
          <Icon aria-hidden className="size-3" />
        </span>
        {title}
      </h3>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function CollapsibleSection({
  icon: Icon,
  title,
  children,
  open = false,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
  open?: boolean;
}) {
  return (
    <details open={open} className="group border-t border-line/60">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 [&::-webkit-details-marker]:hidden">
        <span className="grid size-5 place-items-center rounded bg-brand-50 text-brand-700 ring-1 ring-brand-100">
          <Icon aria-hidden className="size-3" />
        </span>
        {title}
        <ChevronDown
          aria-hidden
          className="ms-auto size-4 text-ink-soft transition group-open:rotate-180"
        />
      </summary>
      <div className="px-4 pb-3">{children}</div>
    </details>
  );
}

function Label({ children }: { children: ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-soft/80">
      {children}
    </p>
  );
}

function Empty({ label }: { label: string }) {
  return <p className="text-xs italic text-ink-soft/70">{label}</p>;
}

export function MedicalReportViewer({
  detail,
  selectedRevision,
  onSelectRevision,
  onConsult,
  onMarkUnseen,
  onRefresh,
  onBack,
}: {
  detail: ReportDetail;
  selectedRevision: number;
  onSelectRevision: (revisionNo: number) => void;
  onConsult: () => Promise<ConsultReportResult>;
  onMarkUnseen: () => Promise<SetSeenResult>;
  onRefresh: () => void;
  onBack?: () => void;
}) {
  const { t } = useI18n();
  const [consulting, setConsulting] = useState(false);
  const [markingUnseen, setMarkingUnseen] = useState(false);
  const [consultError, setConsultError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const missing = t("reports.detail.notProvided");
  const report = detail.report;
  const typeKey = reportTypeKey(report.report_type);
  const typeLabel =
    report.report_type === "autre" && hasText(report.report_type_other)
      ? report.report_type_other
      : typeKey
        ? t(typeKey)
        : missing;

  const selectedNeeds = detail.needs.filter((need) => need.is_selected);
  const enabledSupports = detail.respiratory_supports.filter(
    (support) => support.is_enabled,
  );
  const hasLegacySupport =
    report.legacy_supports.vni_required || report.legacy_supports.vc_required;

  const handleConsult = async () => {
    if (consulting) return;
    setConsulting(true);
    setConsultError(null);
    try {
      const result = await onConsult();
      if (!result.ok) setConsultError(t(reportErrorMessageKey(result.code)));
    } finally {
      setConsulting(false);
    }
  };

  const handleMarkUnseen = async () => {
    if (markingUnseen) return;
    setMarkingUnseen(true);
    setConsultError(null);
    try {
      const result = await onMarkUnseen();
      if (!result.ok) setConsultError(t(reportErrorMessageKey(result.code)));
    } finally {
      setMarkingUnseen(false);
    }
  };

  const reviewed = detail.review !== null;
  const busy = consulting || markingUnseen;

  return (
    <article className="overflow-hidden rounded-2xl border border-line/70 bg-white">
      <header className="px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="mb-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 xl:hidden"
              >
                <ChevronLeft aria-hidden className="size-3.5 rtl:rotate-180" />
                {t("reports.detail.back")}
              </button>
            ) : null}

            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-700">
              {detail.hospital.name}
              <span className="mx-1.5 text-line">·</span>
              {t("reports.detail.revision", { value: report.revision_no })}
              {report.is_latest ? (
                <span className="ms-1.5 rounded-full bg-brand-50 px-1.5 py-0.5 text-[9px] font-semibold normal-case tracking-normal text-brand-800 ring-1 ring-brand-100">
                  {t("reports.detail.latest")}
                </span>
              ) : null}
            </p>

            <h2 className="mt-0.5 truncate text-lg font-semibold tracking-tight text-brand-900">
              {hasText(report.patient_full_name) ? report.patient_full_name : missing}
            </h2>

            <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-ink-soft">
              <span className="font-mono text-[10px] text-brand-800">
                {shortReference(report.mission_id)}
              </span>
              <span aria-hidden className="text-line">
                ·
              </span>
              <span className="inline-flex items-center gap-1">
                <UserRound aria-hidden className="size-3" />
                {hasText(report.driver_name) ? report.driver_name : missing}
              </span>
              <span aria-hidden className="text-line">
                ·
              </span>
              <span>
                {t("reports.detail.transmitted")}{" "}
                {formatReportDateTime(report.transmitted_at, missing)}
              </span>
              <span aria-hidden className="text-line">
                ·
              </span>
              <span>
                {report.patient_age === null ? missing : formatAge(report.patient_age, t)}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${
                reviewed
                  ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                  : "bg-accent-50 text-accent-700 ring-accent-200"
              }`}
            >
              {reviewed ? (
                <CheckCircle2 aria-hidden className="size-3.5" />
              ) : (
                <Clock3 aria-hidden className="size-3.5" />
              )}
              {reviewed ? t("reports.filter.seen") : t("reports.filter.unseen")}
            </span>

            {reviewed ? (
              <button
                type="button"
                onClick={() => void handleMarkUnseen()}
                disabled={busy}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-3 text-[11px] font-semibold text-brand-800 transition hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-60"
              >
                {markingUnseen ? (
                  <Loader2 aria-hidden className="size-3.5 animate-spin" />
                ) : (
                  <Clock3 aria-hidden className="size-3.5" />
                )}
                {markingUnseen
                  ? t("reports.detail.markingUnseen")
                  : t("reports.detail.markUnseen")}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleConsult()}
                disabled={busy}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand-800 px-3 text-[11px] font-semibold text-white shadow-soft transition hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-60"
              >
                {consulting ? (
                  <Loader2 aria-hidden className="size-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 aria-hidden className="size-3.5" />
                )}
                {consulting ? t("reports.detail.consulting") : t("reports.detail.consult")}
              </button>
            )}
          </div>
        </div>

        {reviewed && detail.review ? (
          <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-700">
            <CheckCircle2 aria-hidden className="size-3.5" />
            {t("reports.detail.consultedBy", {
              name: detail.review.consulted_by_name ?? "—",
              date: formatReportDateTime(detail.review.consulted_at, missing),
            })}
          </p>
        ) : null}

        {consultError ? (
          <p
            role="alert"
            className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-accent-600"
          >
            <AlertTriangle aria-hidden className="size-3.5" />
            {consultError}
          </p>
        ) : null}
      </header>

      <Section icon={Siren} title={t("reports.detail.section.transport")}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>{t("reports.detail.transportReason")}</Label>
            <p className="mt-1 whitespace-pre-line break-words text-sm leading-relaxed text-ink">
              {hasText(report.transport_reason) ? report.transport_reason : missing}
            </p>
          </div>
          <div>
            <Label>{t("reports.detail.reportType")}</Label>
            <p className="mt-1 text-sm text-ink">{typeLabel}</p>
            {report.report_type === "autre" && hasText(report.report_type_other) ? (
              <p className="mt-0.5 text-[11px] text-ink-soft">
                {t("reports.detail.reportTypeOther")} : {report.report_type_other}
              </p>
            ) : null}
          </div>
        </div>

        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3">
          <div className="flex items-start gap-1.5">
            <MapPin aria-hidden className="mt-0.5 size-3 shrink-0 text-brand-500" />
            <div className="min-w-0">
              <dt>
                <Label>{t("reports.detail.mission.pickup")}</Label>
              </dt>
              <dd className="mt-0.5 break-words text-[11px] text-ink">
                {hasText(detail.mission.pickup_label) ? detail.mission.pickup_label : missing}
              </dd>
            </div>
          </div>
          <div className="flex items-start gap-1.5">
            <MapPin aria-hidden className="mt-0.5 size-3 shrink-0 text-emerald-600" />
            <div className="min-w-0">
              <dt>
                <Label>{t("reports.detail.mission.destination")}</Label>
              </dt>
              <dd className="mt-0.5 break-words text-[11px] text-ink">
                {hasText(detail.mission.destination_label)
                  ? detail.mission.destination_label
                  : missing}
              </dd>
            </div>
          </div>
          <div>
            <dt>
              <Label>{t("reports.detail.mission.status")}</Label>
            </dt>
            <dd className="mt-0.5 text-[11px] text-ink">
              {missionStatusKey(detail.mission.status)
                ? t(missionStatusKey(detail.mission.status)!)
                : detail.mission.status}
            </dd>
          </div>
          <div>
            <dt>
              <Label>{t("reports.detail.mission.created")}</Label>
            </dt>
            <dd className="mt-0.5 text-[11px] tabular-nums text-ink">
              {formatReportDateTime(detail.mission.created_at, missing)}
            </dd>
          </div>
          <div>
            <dt>
              <Label>{t("reports.detail.mission.completed")}</Label>
            </dt>
            <dd className="mt-0.5 text-[11px] tabular-nums text-ink">
              {formatReportDateTime(detail.mission.completed_at, missing)}
            </dd>
          </div>
          <div>
            <dt>
              <Label>{t("reports.detail.finalized")}</Label>
            </dt>
            <dd className="mt-0.5 text-[11px] tabular-nums text-ink">
              {formatReportDateTime(report.finalized_at, missing)}
            </dd>
          </div>
          <div>
            <dt>
              <Label>{t("reports.detail.finalizedBy")}</Label>
            </dt>
            <dd className="mt-0.5 truncate text-[11px] text-ink">
              {hasText(report.finalized_by_name) ? report.finalized_by_name : missing}
            </dd>
          </div>
          <div>
            <dt>
              <Label>{t("reports.detail.created")}</Label>
            </dt>
            <dd className="mt-0.5 text-[11px] tabular-nums text-ink">
              {formatReportDateTime(report.created_at, missing)}
            </dd>
          </div>
        </dl>
      </Section>

      <Section icon={Activity} title={t("reports.detail.section.vitals")}>
        <ReportVitalsTable vitals={report.vitals} />
      </Section>

      <Section icon={Wind} title={t("reports.detail.section.respiratory")}>
        {enabledSupports.length === 0 && !hasLegacySupport ? (
          <Empty label={t("reports.detail.respiratoryEmpty")} />
        ) : (
          <div className="space-y-2">
            {enabledSupports.map((support) => {
              const labelKey = supportLabelKey(support.support_key);
              const label = labelKey ? t(labelKey) : support.support_key;
              const parameters: Array<{ label: string; value: string }> = [];
              if (support.pep !== null) {
                parameters.push({
                  label: t("reports.detail.pep"),
                  value: formatDecimal(support.pep) ?? "—",
                });
              }
              if (support.aide !== null) {
                parameters.push({
                  label: t("reports.detail.aide"),
                  value: formatDecimal(support.aide) ?? "—",
                });
              }
              if (support.respiratory_rate !== null) {
                parameters.push({
                  label: t("reports.detail.respiratoryRate"),
                  value: formatDecimal(support.respiratory_rate) ?? "—",
                });
              }
              if (support.vcc !== null) {
                parameters.push({
                  label: t("reports.detail.vcc"),
                  value: formatDecimal(support.vcc) ?? "—",
                });
              }
              if (support.tidal_volume !== null) {
                parameters.push({
                  label: t("reports.detail.tidalVolume"),
                  value: formatDecimal(support.tidal_volume) ?? "—",
                });
              }
              return (
                <div
                  key={support.support_key}
                  className="rounded-lg border border-line/70 px-3 py-2"
                >
                  <p className="text-xs font-semibold text-brand-900">{label}</p>
                  {parameters.length === 0 ? (
                    <p className="mt-1 text-[11px] italic text-ink-soft/70">
                      {t("reports.detail.notProvided")}
                    </p>
                  ) : (
                    <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                      {parameters.map((parameter) => (
                        <div key={parameter.label} className="flex items-center gap-1.5">
                          <dt className="text-ink-soft">{parameter.label}</dt>
                          <dd className="font-medium tabular-nums text-ink">
                            {parameter.value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              );
            })}

            {hasLegacySupport ? (
              <div className="rounded-lg border border-dashed border-line bg-surface/40 px-3 py-2">
                <Label>{t("reports.detail.legacySupport")}</Label>
                <ul className="mt-1 space-y-1 text-[11px] text-ink">
                  {report.legacy_supports.vni_required ? (
                    <li>
                      {t("reports.support.vni")}
                      {report.legacy_supports.vni_quantity !== null
                        ? ` · ${formatDecimal(report.legacy_supports.vni_quantity) ?? ""} ${report.legacy_supports.vni_unit ?? ""}`
                        : ""}
                    </li>
                  ) : null}
                  {report.legacy_supports.vc_required ? (
                    <li>
                      {t("reports.support.vc")}
                      {report.legacy_supports.vc_quantity !== null
                        ? ` · ${formatDecimal(report.legacy_supports.vc_quantity) ?? ""} ${report.legacy_supports.vc_unit ?? ""}`
                        : ""}
                    </li>
                  ) : null}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </Section>

      <Section icon={Pill} title={t("reports.detail.section.medications")}>
        {detail.medications.length === 0 ? (
          <Empty label={t("reports.detail.medicationsEmpty")} />
        ) : (
          <div className="overflow-hidden rounded-lg border border-line/70">
            <table className="w-full border-collapse text-start">
              <thead className="bg-surface/80 text-[10px] uppercase tracking-[0.1em] text-ink-soft">
                <tr>
                  <th scope="col" className="px-2.5 py-1.5 text-start font-semibold">
                    {t("reports.detail.medicationName")}
                  </th>
                  <th scope="col" className="px-2.5 py-1.5 text-start font-semibold">
                    {t("reports.detail.dosage")}
                  </th>
                  <th scope="col" className="px-2.5 py-1.5 text-start font-semibold">
                    {t("reports.detail.frequency")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {detail.medications.map((medication) => (
                  <tr key={medication.position}>
                    <td className="px-2.5 py-1.5 text-xs font-medium text-ink">
                      {medication.name}
                    </td>
                    <td className="px-2.5 py-1.5 text-xs text-ink-soft">
                      {hasText(medication.dosage) ? medication.dosage : "—"}
                    </td>
                    <td className="px-2.5 py-1.5 text-xs text-ink-soft">
                      {hasText(medication.frequency) ? medication.frequency : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section icon={Syringe} title={t("reports.detail.section.pse")}>
        {detail.pse_medications.length === 0 && !report.legacy_supports.pse_required ? (
          <Empty label={t("reports.detail.pseEmpty")} />
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {detail.pse_medications.map((pse) => {
              const labelKey = pseLabelKey(pse.drug_key);
              return (
                <li
                  key={pse.drug_key}
                  className="rounded-lg border border-line/70 px-3 py-2 text-xs"
                >
                  <p className="font-semibold text-brand-900">
                    {labelKey ? t(labelKey) : pse.drug_key}
                  </p>
                  <p className="mt-1 text-[11px] text-ink-soft">
                    {t("reports.detail.dose")} :{" "}
                    <span className="font-medium text-ink">
                      {pse.dose === null ? "—" : formatDecimal(pse.dose)}
                      {pse.unit ? ` ${pse.unit}` : ""}
                    </span>
                    <span className="mx-2 text-line">·</span>
                    {t("reports.detail.duration")} :{" "}
                    <span className="font-medium text-ink">
                      {pse.duration_minutes === null
                        ? "—"
                        : t("reports.unit.minutes", { value: pse.duration_minutes })}
                    </span>
                  </p>
                </li>
              );
            })}
            {detail.pse_medications.length === 0 && report.legacy_supports.pse_required ? (
              <li className="rounded-lg border border-dashed border-line px-3 py-2 text-xs">
                <p className="font-semibold text-brand-900">
                  {t("reports.detail.legacySupport")}
                </p>
                <p className="mt-1 text-[11px] text-ink-soft">
                  {t("reports.detail.dose")} :{" "}
                  <span className="font-medium text-ink">
                    {formatDecimal(report.legacy_supports.pse_quantity) ?? "—"}
                    {report.legacy_supports.pse_unit
                      ? ` ${report.legacy_supports.pse_unit}`
                      : ""}
                  </span>
                  <span className="mx-2 text-line">·</span>
                  {t("reports.detail.duration")} :{" "}
                  <span className="font-medium text-ink">
                    {report.legacy_supports.pse_duration_minutes === null
                      ? "—"
                      : t("reports.unit.minutes", {
                          value: report.legacy_supports.pse_duration_minutes,
                        })}
                  </span>
                </p>
              </li>
            ) : null}
          </ul>
        )}
      </Section>

      <Section icon={ClipboardList} title={t("reports.detail.section.needs")}>
        {selectedNeeds.length === 0 &&
        detail.custom_needs.length === 0 &&
        !hasText(report.patient_needs) ? (
          <Empty label={t("reports.detail.needsEmpty")} />
        ) : (
          <div className="space-y-2.5">
            {selectedNeeds.length === 0 &&
            detail.custom_needs.length === 0 &&
            hasText(report.patient_needs) ? (
              <p className="whitespace-pre-line break-words text-xs text-ink">
                {report.patient_needs}
              </p>
            ) : null}
            {selectedNeeds.length > 0 ? (
              <ul className="flex flex-wrap gap-1.5">
                {selectedNeeds.map((need) => {
                  const labelKey = needLabelKey(need.need_key);
                  const label = labelKey ? t(labelKey) : need.need_key;
                  const amount =
                    need.quantity === null
                      ? null
                      : `${formatDecimal(need.quantity) ?? ""}${need.unit ? ` ${need.unit}` : ""}`;
                  return (
                    <li
                      key={need.need_key}
                      className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-900"
                    >
                      <CheckCircle2 aria-hidden className="size-3 text-brand-600" />
                      {label}
                      {amount ? <span className="text-brand-700">· {amount}</span> : null}
                    </li>
                  );
                })}
              </ul>
            ) : null}

            {detail.custom_needs.length > 0 ? (
              <div>
                <Label>{t("reports.detail.customNeeds")}</Label>
                <ul className="mt-1 divide-y divide-line/60 rounded-lg border border-line/70">
                  {detail.custom_needs.map((custom) => (
                    <li
                      key={custom.position}
                      className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 text-[11px]"
                    >
                      <span className="text-ink">{custom.label}</span>
                      <span className="tabular-nums text-ink-soft">
                        {custom.value === null
                          ? "—"
                          : `${formatDecimal(custom.value) ?? ""}${custom.unit ? ` ${custom.unit}` : ""}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </Section>

      <Section icon={MessageSquareText} title={t("reports.detail.section.observations")}>
        {hasText(report.observations) ? (
          <p className="whitespace-pre-line break-words text-sm leading-relaxed text-ink">
            {report.observations}
          </p>
        ) : (
          <Empty label={t("reports.detail.observationsEmpty")} />
        )}
      </Section>

      <CollapsibleSection icon={History} title={t("reports.detail.section.history")}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>{t("reports.detail.medicalHistory")}</Label>
            <p className="mt-1 whitespace-pre-line break-words text-xs leading-relaxed text-ink">
              {hasText(report.medical_history) ? report.medical_history : missing}
            </p>
          </div>
          <div>
            <Label>{t("reports.detail.knownPathologies")}</Label>
            <p className="mt-1 whitespace-pre-line break-words text-xs leading-relaxed text-ink">
              {hasText(report.known_pathologies) ? report.known_pathologies : missing}
            </p>
          </div>
        </div>
      </CollapsibleSection>

      <div className="border-t border-line/60 bg-surface/30 px-4 py-3">
        <PatientProfilePanel profile={detail.patient_profile} />
      </div>

      <Section icon={FileText} title={t("reports.detail.section.documents")}>
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line/70 bg-surface/40 p-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-white text-brand-700">
            <FileText aria-hidden className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-brand-900">
              {t("reports.document.title", {
                ref: shortReference(report.mission_id),
                revision: report.revision_no,
              })}
            </p>
            <p className="mt-0.5 text-[11px] leading-snug text-ink-soft">
              {t("reports.document.description")}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 text-[11px] font-semibold text-brand-800 transition hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <Eye aria-hidden className="size-3.5" />
              {t("reports.document.preview")}
            </button>
          </div>
        </div>
      </Section>

      <CollapsibleSection icon={History} title={t("reports.revisions.title")}>
        <RevisionTimeline
          revisions={detail.revisions}
          selectedRevision={selectedRevision}
          onSelect={onSelectRevision}
        />
      </CollapsibleSection>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line/60 px-4 py-2 text-[10px] text-ink-soft/80">
        <span className="inline-flex items-center gap-1">
          <CalendarClock aria-hidden className="size-3" />
          {t("reports.updated", {
            time: formatReportDateTime(detail.server_now, "—"),
          })}
        </span>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <HeartPulse aria-hidden className="size-3" />
          {t("reports.refresh")}
        </button>
      </footer>

      {previewOpen ? (
        <DocumentPreview
          detail={detail}
          revisionNo={selectedRevision}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}
    </article>
  );
}
