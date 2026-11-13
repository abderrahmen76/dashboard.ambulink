/**
 * Shapes returned by `hospital_manager_missions_analytics` in
 * `supabase/migrations/202611110006_hospital_manager_missions_analytics.sql`
 * (draft, NOT APPLIED). The RPC derives the hospital from the caller's active
 * manager membership and only returns that hospital's `target_hospital_id`
 * missions, so nothing hospital-scoped is read from the browser.
 */

export const MISSION_STATUSES = [
  "requested",
  "accepted",
  "en_route",
  "arrived",
  "in_progress",
  "completed",
  "cancelled",
] as const;

export type MissionStatus = (typeof MISSION_STATUSES)[number];

export type MissionStatusFilter = "all" | MissionStatus;

export type MissionsSort = "newest" | "oldest";

export type AnalyticsBucket = "day" | "week";

export type RangePreset = "today" | "7d" | "30d" | "year" | "custom";

export type MissionsPageSize = 10 | 25 | 50;

export type MissionsAnalyticsQuery = {
  from: string;
  to: string;
  bucket: AnalyticsBucket;
  status: MissionStatusFilter;
  search: string;
  sort: MissionsSort;
  page: number;
  pageSize: MissionsPageSize;
};

export type MissionKpis = {
  total: number;
  today: number;
  pending: number;
  accepted: number;
  in_progress: number;
  completed: number;
  cancelled: number;
  avg_completion_seconds: number | null;
  completion_rate: number | null;
  cancellation_rate: number | null;
};

export type MissionSeriesPoint = {
  bucket: string;
  total: number;
  completed: number;
  cancelled: number;
};

export type MissionStatusCount = {
  status: MissionStatus;
  count: number;
};

export type DriverPerformance = {
  driver_id: string;
  driver_name: string | null;
  total: number;
  completed: number;
  active: number;
  avg_completion_seconds: number | null;
};

export type MissionRow = {
  id: string;
  status: MissionStatus;
  patient_name: string | null;
  pickup_label: string | null;
  destination_label: string | null;
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
};

export type MissionsAnalytics = {
  server_now: string;
  hospital: { id: string; name: string };
  range: { from: string; to: string; bucket: AnalyticsBucket };
  kpis: MissionKpis;
  previous_total: number | null;
  trend_percent: number | null;
  busiest: { date: string; count: number } | null;
  series: MissionSeriesPoint[];
  statuses: MissionStatusCount[];
  drivers: DriverPerformance[];
  missions: {
    total: number;
    page: number;
    page_size: number;
    items: MissionRow[];
  };
};

export type MissionsErrorCode =
  | "migration_pending"
  | "access_denied"
  | "invalid"
  | "network"
  | "unexpected"
  /** Client-only: a refresh failed but the previous result is still shown. */
  | "stale";

export type MissionsResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: MissionsErrorCode };
