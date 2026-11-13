"use client";

import { Ambulance } from "lucide-react";

export function BrandMark({
  tagline,
  className = "",
}: {
  tagline: string;
  className?: string;
}) {
  return (
    <span className={`inline-flex min-w-0 items-center gap-3 ${className}`}>
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand-700 to-brand-900 text-white shadow-soft ring-1 ring-brand-900/10">
        <Ambulance aria-hidden className="size-5" strokeWidth={1.8} />
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block text-base font-semibold tracking-tight text-brand-900">
          AmbuLink <span className="text-accent-600">Clinic</span>
        </span>
        <span className="mt-0.5 block truncate text-[11px] font-medium uppercase tracking-[0.14em] text-ink-soft">
          {tagline}
        </span>
      </span>
    </span>
  );
}
