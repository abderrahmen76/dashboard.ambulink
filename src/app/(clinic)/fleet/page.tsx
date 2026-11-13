import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { loadFleetSnapshot } from "@/lib/fleet/server";
import { FleetSkeleton } from "./fleet-skeleton";
import { FleetView } from "./fleet-view";

export const metadata: Metadata = {
  title: "Hospital fleet",
};

export default function FleetPage() {
  return (
    <Suspense fallback={<FleetSkeleton />}>
      <FleetContent />
    </Suspense>
  );
}

async function FleetContent() {
  // Supabase reads the clock while resolving the request, so this subtree must
  // render at request time rather than during the shell prerender.
  await connection();
  const initialSnapshot = await loadFleetSnapshot();

  return <FleetView initialSnapshot={initialSnapshot} />;
}
