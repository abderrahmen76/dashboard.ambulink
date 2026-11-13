import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { loadMissionsAnalytics } from "@/lib/missions/server";
import { MissionsSkeleton } from "./missions-skeleton";
import { MissionsView } from "./missions-view";

export const metadata: Metadata = {
  title: "Missions & Analytics",
};

export default function MissionsPage() {
  return (
    <Suspense fallback={<MissionsSkeleton />}>
      <MissionsContent />
    </Suspense>
  );
}

async function MissionsContent() {
  // Supabase reads the clock while resolving the request, so this subtree must
  // render at request time rather than during the shell prerender.
  await connection();
  const { result, query } = await loadMissionsAnalytics();

  return <MissionsView initialPage={result} initialQuery={query} />;
}
