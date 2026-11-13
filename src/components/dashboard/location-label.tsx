"use client";

import { Loader2 } from "lucide-react";

import { formatCoordinateLabel, type GeoPoint } from "@/lib/geo/types";
import { useResolvedLabel } from "@/lib/geo/use-geo";
import { useI18n } from "@/lib/i18n/provider";

/**
 * Readable place name: the stored label when it is a real place, otherwise a
 * reverse-geocoded name for display only, and finally a coordinate fallback.
 */
export function LocationLabel({
  label,
  point,
}: {
  label: string | null;
  point: GeoPoint | null;
}) {
  const { t } = useI18n();
  const { value, loading } = useResolvedLabel({ label, point });

  if (value) return <>{value}</>;
  if (!point) return <span className="text-ink-soft">{t("dc.details.coordinatesMissing")}</span>;
  if (loading) {
    return (
      <span className="inline-flex items-center gap-1.5 text-ink-soft">
        <Loader2 aria-hidden className="size-3 animate-spin" />
        {t("dc.details.resolving")}
      </span>
    );
  }
  return <span className="tabular-nums">{formatCoordinateLabel(point)}</span>;
}
