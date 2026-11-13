"use client";

import { useI18n } from "@/lib/i18n/provider";
import { missionStatusTone } from "@/lib/missions/format";
import { missionStatusLabel } from "@/lib/missions/messages";
import type { MissionStatus } from "@/lib/missions/types";

export function MissionStatusPill({ status }: { status: MissionStatus }) {
  const { t } = useI18n();
  return (
    <span
      className={`inline-flex h-5 shrink-0 items-center rounded-full px-2 text-[10px] font-semibold ring-1 ${missionStatusTone(status)}`}
    >
      {t(missionStatusLabel(status))}
    </span>
  );
}
