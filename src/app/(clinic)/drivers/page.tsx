import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { DEFAULT_DRIVERS_QUERY, loadDriversPage } from "@/lib/drivers/server";
import { DriversSkeleton } from "./drivers-skeleton";
import { DriversView } from "./drivers-view";

export const metadata: Metadata = {
  title: "Hospital drivers",
};

export default function DriversPage() {
  return (
    <Suspense fallback={<DriversSkeleton />}>
      <DriversContent />
    </Suspense>
  );
}

async function DriversContent() {
  // Supabase reads the clock while resolving the request, so this subtree must
  // render at request time rather than during the shell prerender.
  await connection();
  const initialPage = await loadDriversPage();

  return (
    <DriversView initialPage={initialPage} initialQuery={DEFAULT_DRIVERS_QUERY} />
  );
}
