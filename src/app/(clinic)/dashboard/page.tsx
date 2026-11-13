import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { loadDashboardBootstrap } from "@/lib/dashboard/server";
import { DashboardSkeleton } from "./dashboard-skeleton";
import { DashboardView } from "./dashboard-view";

export const metadata: Metadata = {
  title: "Hospital workspace",
};

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}

async function DashboardContent() {
  // The map and queue read the clock while rendering, so this subtree must
  // render at request time rather than during the shell prerender.
  await connection();
  const initialSnapshot = await loadDashboardBootstrap();

  return <DashboardView initialSnapshot={initialSnapshot} />;
}
