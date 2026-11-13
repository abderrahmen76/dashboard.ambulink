/**
 * Shapes returned by the `hospital_manager_*` RPCs in
 * `supabase/migrations/202611100015_hospital_manager_dispatch_center.sql`
 * (draft, NOT APPLIED). Nothing here reads tables directly: the RPC derives the
 * hospital from the caller's membership and returns only that hospital's rows.
 */

export type MissionStatus =
  | "requested"
  | "accepted"
  | "en_route"
  | "arrived"
  | "in_progress"
  | "completed"
  | "cancelled";

export type DispatchAttemptState = "offering" | "accepted" | "expired";

export type AmbulanceStatus = "available" | "on_mission" | "maintenance";

export type GpsFreshness = "live" | "delayed" | "stale" | "missing";

export type DashboardAttempt = {
  id: string;
  state: DispatchAttemptState;
  attempt_number: number;
  deadline_at: string;
  offered_count: number;
  accepted_driver_id: string | null;
};

export type DashboardMission = {
  id: string;
  status: MissionStatus;
  dispatch_mode: string | null;
  manager_entry: boolean;
  patient_name: string | null;
  patient_phone: string | null;
  pickup_label: string | null;
  pickup_lat: number | null;
  pickup_lng: number | null;
  destination_label: string | null;
  destination_lat: number | null;
  destination_lng: number | null;
  symptoms: string | null;
  notes: string | null;
  created_at: string;
  accepted_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  driver_id: string | null;
  driver_name: string | null;
  ambulance_id: string | null;
  ambulance_label: string | null;
  attempt: DashboardAttempt | null;
};

export type DashboardDriver = {
  id: string;
  full_name: string | null;
  availability: boolean | null;
  current_lat: number | null;
  current_lng: number | null;
  location_updated_at: string | null;
  ambulance_id: string | null;
  ambulance_label: string | null;
  active_mission_id: string | null;
};

export type DashboardAmbulance = {
  id: string;
  label: string | null;
  plate_number: string | null;
  status: AmbulanceStatus | null;
  driver_id: string | null;
  driver_name: string | null;
};

export type DashboardKpis = {
  active_missions: number;
  available_ambulances: number;
  busy_ambulances: number;
  avg_response_seconds: number | null;
  completed_today: number;
  fleet_total: number;
  fleet_utilization_percent: number | null;
};

export type DashboardHospital = {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  patient_dispatch_enabled: boolean;
};

export type DashboardSnapshot = {
  server_now: string;
  hospital: DashboardHospital;
  kpis: DashboardKpis;
  missions: DashboardMission[];
  drivers: DashboardDriver[];
  ambulances: DashboardAmbulance[];
};

/** Snapshot without the queue; refreshed on its own by Realtime (202611110012). */
export type DashboardOverview = Omit<DashboardSnapshot, "missions">;

/**
 * One keyset page of the mission queue (202611110012). `active_items` is the
 * complete nonterminal list for the hospital, independent of the page, so the
 * map keeps showing older active missions that are not loaded yet.
 */
export type MissionsPage = {
  server_now: string;
  total_count: number;
  has_more: boolean;
  items: DashboardMission[];
  active_items: DashboardMission[];
};

/**
 * First render payload. `paged: false` means the paging RPCs are not applied
 * yet and `page.items` is the legacy full snapshot list.
 */
export type DashboardBootstrap = {
  paged: boolean;
  overview: DashboardOverview;
  page: MissionsPage;
};

export type MissionDispatchResult = {
  mission_id: string;
  attempt_id: string;
  offered: number;
  snapshot: DashboardSnapshot;
};

/** `hospital_manager_cancel_mission` (202611130001, draft). */
export type MissionCancelResult = {
  mission_id: string;
  status: "cancelled";
  cancelled_at: string;
  snapshot: DashboardSnapshot;
};

/**
 * Assigned driver contact for one mission, resolved from `profiles` by the
 * mission's `driver_id` (202611130004, draft). It is deliberately not part of
 * the mission payload: phones are fetched only for the selected mission.
 */
export type DriverContact = {
  mission_id: string;
  driver_id: string | null;
  driver_name: string | null;
  driver_phone: string | null;
};

/** One ambulance company linked to the caller's hospital (202611110009). */
export type CompanyOption = {
  id: string;
  name: string;
  slug: string | null;
  /** Company position when the owner recorded one; never invented client-side. */
  lat?: number | null;
  lng?: number | null;
  eligible_driver_count: number;
};

export type CompanyOptions = {
  server_now: string;
  companies: CompanyOption[];
};

export type CompanyRecipient = {
  id: string;
  full_name: string | null;
  availability: boolean | null;
  ambulance_label: string | null;
  location_updated_at: string | null;
};

export type CompanyRecipients = {
  server_now: string;
  company: {
    id: string;
    name: string;
    slug: string | null;
    lat?: number | null;
    lng?: number | null;
  };
  eligible_count: number;
  eligible: CompanyRecipient[];
};

/** A company mission's origin, merged into the dispatch snapshot client-side. */
export type CompanyOrigin = {
  mission_id: string;
  company_id: string;
  company_name: string;
};

export type CompanyMissionDispatchResult = MissionDispatchResult & {
  company: {
    id: string;
    name: string;
    slug: string | null;
    lat?: number | null;
    lng?: number | null;
  };
};

/** UI filter for the queue; `awaiting`/`expired` are dispatch phases of `requested`. */
export type QueueFilter =
  | "all"
  | "awaiting"
  | "expired"
  | Exclude<MissionStatus, "requested">;
