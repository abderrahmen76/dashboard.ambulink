"use client";

import type { MessageKey } from "@/lib/i18n/dictionaries";
import { useI18n } from "@/lib/i18n/provider";
import type { DriverOperationalStatus } from "@/lib/drivers/types";

const STYLES: Record<
  DriverOperationalStatus,
  { className: string; dot: string; label: MessageKey }
> = {
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
  offline: {
    className: "border-line bg-surface text-ink-soft",
    dot: "bg-slate-400",
    label: "fleet.state.offline",
  },
};

export function DriverStatusBadge({
  status,
  className = "",
}: {
  status: DriverOperationalStatus;
  className?: string;
}) {
  const { t } = useI18n();
  const style = STYLES[status] ?? STYLES.offline;

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold ${style.className} ${className}`}
    >
      <span aria-hidden className={`size-1.5 rounded-full ${style.dot}`} />
      {t(style.label)}
    </span>
  );
}
