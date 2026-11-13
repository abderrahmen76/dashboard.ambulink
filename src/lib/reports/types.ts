/**
 * Shapes returned by the `hospital_manager_*` medical-report RPCs in
 * `supabase/migrations/202611110001_hospital_manager_medical_reports.sql`
 * (draft, NOT APPLIED). The RPC derives the hospital from the caller's active
 * manager membership; no hospital id is ever taken from the browser.
 */

export type ReportReviewStatus = "pending" | "reviewed";
export type ReportReviewFilter = "all" | ReportReviewStatus;

/** The six values admitted by `medical_reports_report_type_check`. */
export type ReportType =
  | "urgence"
  | "transfert"
  | "retour_domicile"
  | "consultation"
  | "hospitalisation"
  | "autre";

export type ReportTypeFilter = "all" | ReportType;
export type ReportSort = "newest" | "oldest";
export type ReportPageSize = 20 | 50 | 100;

export type ReportKpis = {
  total: number;
  pending: number;
  reviewed: number;
  recent: number;
};

export type ReportListItem = {
  report_id: string;
  mission_id: string;
  revision_no: number;
  patient_full_name: string | null;
  patient_age: number | null;
  transport_reason: string | null;
  report_type: string | null;
  report_type_other: string | null;
  driver_id: string;
  driver_name: string | null;
  finalized_at: string | null;
  transmitted_at: string | null;
  review_status: ReportReviewStatus;
  reviewed_at: string | null;
};

export type ReportDriverOption = {
  id: string;
  name: string | null;
};

export type ReportsPage = {
  server_now: string;
  hospital: { id: string; name: string };
  kpis: ReportKpis;
  total_count: number;
  page_size: number;
  offset: number;
  items: ReportListItem[];
  drivers: ReportDriverOption[];
};

export type ReportVitals = {
  fc_before: number | null;
  fc_after: number | null;
  spo2_before: number | null;
  spo2_after: number | null;
  sys_before: number | null;
  sys_after: number | null;
  dia_before: number | null;
  dia_after: number | null;
  rr_before: number | null;
  rr_after: number | null;
  temp_before: number | null;
  temp_after: number | null;
  glucose_before: number | null;
  glucose_after: number | null;
  pain_before: number | null;
  pain_after: number | null;
};

/** Legacy scalar support columns, kept for reports finalized before 0006. */
export type ReportLegacySupports = {
  vni_required: boolean;
  vni_quantity: number | null;
  vni_unit: string | null;
  vni_duration_minutes: number | null;
  vc_required: boolean;
  vc_quantity: number | null;
  vc_unit: string | null;
  vc_duration_minutes: number | null;
  pse_required: boolean;
  pse_quantity: number | null;
  pse_unit: string | null;
  pse_duration_minutes: number | null;
};

export type ReportNeed = {
  need_key: string;
  is_selected: boolean;
  quantity: number | null;
  unit: string | null;
};

export type ReportCustomNeed = {
  position: number;
  label: string;
  value: number | null;
  unit: string | null;
};

export type ReportMedication = {
  position: number;
  name: string;
  dosage: string | null;
  frequency: string | null;
};

export type ReportRespiratorySupport = {
  support_key: string;
  is_enabled: boolean;
  pep: number | null;
  aide: number | null;
  respiratory_rate: number | null;
  vcc: number | null;
  tidal_volume: number | null;
};

export type ReportPseMedication = {
  drug_key: string;
  dose: number | null;
  unit: string | null;
  duration_minutes: number | null;
};

export type PatientMedicalProfile = {
  date_of_birth: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  blood_group: string | null;
  blood_group_verified: boolean;
  allergy_status: "none_known" | "unknown" | null;
  medication_allergies: string | null;
  other_allergies: string | null;
  chronic_conditions: string | null;
  medical_history: string | null;
  other_health_info: string | null;
  /** jsonb array; the shape is validated when displayed, never trusted. */
  medications: unknown;
  mobility_limitations: string | null;
  mobility_assistance: string | null;
  transport_notes: string | null;
  emergency_contact_name: string | null;
  emergency_contact_relationship: string | null;
  emergency_contact_phone: string | null;
  updated_at: string | null;
};

export type ReportRevision = {
  revision_no: number;
  finalized_at: string | null;
  finalized_by_name: string | null;
  transmitted_at: string | null;
  reviewed_at: string | null;
};

export type ReportMission = {
  id: string;
  status: string;
  pickup_label: string | null;
  destination_label: string | null;
  created_at: string | null;
  accepted_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
};

export type ReportReview = {
  consulted_at: string;
  consulted_by_name: string | null;
};

export type ReportDetail = {
  server_now: string;
  hospital: { id: string; name: string };
  report: {
    id: string;
    mission_id: string;
    driver_id: string;
    driver_name: string | null;
    patient_full_name: string | null;
    patient_age: number | null;
    transport_reason: string | null;
    report_type: string | null;
    report_type_other: string | null;
    medical_history: string | null;
    known_pathologies: string | null;
    patient_needs: string | null;
    custom_needs: string | null;
    observations: string | null;
    /** Verified by the RPC: this revision has a transmission to the caller's hospital. */
    status: "transmitted";
    revision_no: number;
    is_latest: boolean;
    created_at: string | null;
    finalized_at: string | null;
    finalized_by_name: string | null;
    transmitted_at: string | null;
    vitals: ReportVitals;
    legacy_supports: ReportLegacySupports;
  };
  mission: ReportMission;
  needs: ReportNeed[];
  custom_needs: ReportCustomNeed[];
  medications: ReportMedication[];
  respiratory_supports: ReportRespiratorySupport[];
  pse_medications: ReportPseMedication[];
  patient_profile: PatientMedicalProfile | null;
  revisions: ReportRevision[];
  review: ReportReview | null;
};

export type ReportErrorCode =
  | "migration_pending"
  | "access_denied"
  | "not_found"
  | "network"
  | "unexpected";

export type ReportResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: ReportErrorCode };

export type ConsultReportResult =
  | { ok: true; data: ReportReview }
  | { ok: false; code: ReportErrorCode };

/** One inbox entry as returned by `hospital_manager_medical_reports_unseen`. */
export type UnseenReportItem = {
  report_id: string;
  revision_no: number;
  patient_full_name: string | null;
  report_type: string | null;
  report_type_other: string | null;
  transmitted_at: string | null;
};

export type UnseenReports = {
  server_now: string;
  hospital_id: string;
  unseen_count: number;
  items: UnseenReportItem[];
};

export type UnseenReportsResult =
  | { ok: true; data: UnseenReports }
  | { ok: false; code: ReportErrorCode };

export type SetSeenResult =
  | { ok: true; data: { seen: boolean; reviewed_at: string | null } }
  | { ok: false; code: ReportErrorCode };
