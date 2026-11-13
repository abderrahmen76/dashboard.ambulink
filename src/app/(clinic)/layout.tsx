import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";

import { ClinicShell } from "@/components/dashboard/clinic-shell";
import { ClinicShellSkeleton } from "@/components/dashboard/clinic-shell-skeleton";
import { requireHospitalManager } from "@/lib/auth/require-manager";
import { getRequestLocale } from "@/lib/i18n/server";

/**
 * Shared shell for every clinic tab. The App Router keeps a shared layout
 * mounted across sibling navigations, so the manager check, the hospital
 * lookup and the sidebar run once per session entry instead of once per tab.
 * Each tab only fetches its own data.
 */
export default function ClinicLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<ClinicShellSkeleton />}>
      <ClinicChrome>{children}</ClinicChrome>
    </Suspense>
  );
}

async function ClinicChrome({ children }: { children: ReactNode }) {
  // Supabase auth reads the clock while resolving the session, so the frame
  // resolves per request rather than during the shell prerender.
  await connection();
  const manager = await requireHospitalManager();
  const locale = await getRequestLocale();

  return (
    <ClinicShell
      locale={locale}
      hospitalName={manager.hospitalName}
      sessionKey={manager.userId}
    >
      {children}
    </ClinicShell>
  );
}
