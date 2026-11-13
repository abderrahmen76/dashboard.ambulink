"use client";

import type { ReactNode } from "react";

import { useI18n } from "@/lib/i18n/provider";
import { BrandMark } from "./brand-mark";
import { LanguageSelect } from "./language-select";

export function ClinicHeader({ actions }: { actions?: ReactNode }) {
  const { t } = useI18n();

  return (
    <header className="sticky top-0 z-30 border-b border-line/80 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <BrandMark tagline={t("brand.tagline")} />
        <div className="flex items-center gap-2 sm:gap-3">
          <LanguageSelect />
          {actions}
        </div>
      </div>
    </header>
  );
}
