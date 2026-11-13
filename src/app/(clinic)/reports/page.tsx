import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { DEFAULT_REPORTS_QUERY, loadReportsPage } from "@/lib/reports/server";
import { ReportsSkeleton } from "./reports-skeleton";
import { ReportsView } from "./reports-view";

export const metadata: Metadata = {
  title: "Medical reports",
};

export default function ReportsPage() {
  return (
    <Suspense fallback={<ReportsSkeleton />}>
      <ReportsContent />
    </Suspense>
  );
}

async function ReportsContent() {
  // Supabase reads the clock while resolving the request, so this subtree must
  // render at request time rather than during the shell prerender.
  await connection();
  const initialPage = await loadReportsPage();

  return (
    <ReportsView initialPage={initialPage} initialQuery={DEFAULT_REPORTS_QUERY} />
  );
}
