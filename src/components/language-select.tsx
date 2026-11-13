"use client";

import { ChevronDown, Globe } from "lucide-react";

import { isLocale, locales, type Locale } from "@/lib/i18n/config";
import { useI18n } from "@/lib/i18n/provider";

const labels: Record<Locale, string> = {
  en: "English",
  fr: "Français",
  ar: "العربية",
};

export function LanguageSelect() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div className="relative inline-flex w-[9.75rem] items-center">
      <Globe
        aria-hidden
        className="pointer-events-none absolute start-3 size-4 text-brand-700"
      />
      <select
        aria-label={t("language.label")}
        value={locale}
        onChange={(event) => {
          const next = event.target.value;
          if (isLocale(next)) setLocale(next);
        }}
        className="h-10 w-full cursor-pointer appearance-none rounded-full border border-brand-100 bg-white ps-9 pe-9 text-sm font-medium text-brand-900 shadow-sm transition hover:border-brand-300 focus:border-brand-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
      >
        {locales.map((value) => (
          <option key={value} value={value}>
            {labels[value]}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute end-3 size-4 text-brand-700"
      />
    </div>
  );
}
