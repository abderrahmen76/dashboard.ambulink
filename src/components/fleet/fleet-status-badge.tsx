"use client";

import type { MessageKey } from "@/lib/i18n/dictionaries";
import { useI18n } from "@/lib/i18n/provider";
import type { FleetVehicleState } from "@/lib/fleet/types";

const STYLES: Record<FleetVehicleState, { className: string; dot: string; label: MessageKey }> = {
  available: {
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
    label: "fleet.state.available",
  },
  on_mission: {
    className: "border-amber-200 bg-amber-50 text-amber-700",
    dot: "bg-amber-500",
    label: "fleet.state.onMission",
  },
  maintenance: {
    className: "border-violet-200 bg-violet-50 text-violet-700",
    dot: "bg-violet-500",
    label: "fleet.state.maintenance",
  },
  offline: {
    className: "border-line bg-surface text-ink-soft",
    dot: "bg-slate-400",
    label: "fleet.state.offline",
  },
  unassigned: {
    className: "border-line bg-white text-ink-soft",
    dot: "bg-slate-300",
    label: "fleet.state.unassigned",
  },
};

export function FleetStatusBadge({
  state,
  className = "",
}: {
  state: FleetVehicleState;
  className?: string;
}) {
  const { t } = useI18n();
  const style = STYLES[state];

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold ${style.className} ${className}`}
    >
      <span aria-hidden className={`size-1.5 rounded-full ${style.dot}`} />
      {t(style.label)}
    </span>
  );
}
