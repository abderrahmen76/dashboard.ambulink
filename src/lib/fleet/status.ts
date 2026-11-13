import type { FleetAmbulance, FleetFilter, FleetVehicleState } from "./types";

/**
 * Stored `ambulances.status` never represents a mission: hospital mission
 * acceptance does not write it. The operational state is derived here so the
 * registry, filters and KPIs all use the same rule.
 */
export function vehicleState(ambulance: FleetAmbulance): FleetVehicleState {
  if (ambulance.status === "maintenance") return "maintenance";
  if (ambulance.active_mission) return "on_mission";
  if (!ambulance.driver_id) return "unassigned";
  return ambulance.driver_availability === true ? "available" : "offline";
}

export function matchesFilter(ambulance: FleetAmbulance, filter: FleetFilter): boolean {
  if (filter === "all") return true;
  if (filter === "assigned") return ambulance.driver_id !== null;
  return vehicleState(ambulance) === filter;
}

export function matchesSearch(ambulance: FleetAmbulance, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [
    ambulance.label,
    ambulance.plate_number,
    ambulance.driver_name,
  ];
  return haystack.some((value) => value?.toLowerCase().includes(needle));
}

export type FleetKpis = {
  total: number;
  available: number;
  onMission: number;
  maintenance: number;
  utilizationPercent: number | null;
};

export function computeKpis(ambulances: FleetAmbulance[]): FleetKpis {
  let available = 0;
  let onMission = 0;
  let maintenance = 0;
  for (const ambulance of ambulances) {
    const state = vehicleState(ambulance);
    if (state === "available") available += 1;
    else if (state === "on_mission") onMission += 1;
    else if (state === "maintenance") maintenance += 1;
  }
  const total = ambulances.length;
  return {
    total,
    available,
    onMission,
    maintenance,
    utilizationPercent: total === 0 ? null : Math.round((100 * onMission) / total),
  };
}
