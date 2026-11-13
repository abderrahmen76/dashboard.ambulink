"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import type { Locale } from "@/lib/i18n/config";
import { LocaleProvider, useI18n } from "@/lib/i18n/provider";
import { ensureTabStateScope } from "@/lib/navigation/tab-state";

import { HospitalNameProvider } from "./hospital-name-context";
import { Sidebar } from "./sidebar";

/**
 * Persistent clinic chrome. It is mounted by the `(clinic)` layout, which the
 * App Router keeps across sibling navigations, so the sidebar, its unseen
 * report poll and the locale provider are never remounted by a tab switch.
 * Only the pathname-keyed content wrapper changes.
 */
export function ClinicShell({
  locale,
  hospitalName,
  sessionKey,
  children,
}: {
  locale: Locale;
  hospitalName: string;
  sessionKey: string;
  children: ReactNode;
}) {
  ensureTabStateScope(sessionKey);

  return (
    <LocaleProvider initialLocale={locale}>
      <HospitalNameProvider value={hospitalName}>
        <ClinicFrame hospitalName={hospitalName}>{children}</ClinicFrame>
      </HospitalNameProvider>
    </LocaleProvider>
  );
}

function ClinicFrame({
  hospitalName,
  children,
}: {
  hospitalName: string;
  children: ReactNode;
}) {
  const { dir } = useI18n();
  const pathname = usePathname();

  return (
    <div dir={dir} className="app-shell flex h-dvh overflow-hidden bg-surface">
      <Sidebar hospitalName={hospitalName} />
      {/* Keyed by pathname so each tab plays the same short entrance. */}
      <div key={pathname} className="tab-enter flex min-h-0 min-w-0 flex-1 flex-col">
        {children}
      </div>
    </div>
  );
}
