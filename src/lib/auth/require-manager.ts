import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseServerClient, SupabaseNotConfiguredError } from "@/lib/supabase/server";
import {
  verifyHospitalManager,
  type HospitalManagerSession,
} from "./hospital-manager";

/**
 * Page-level guard for the protected manager area. The proxy only performs an
 * optimistic cookie check; this is the authoritative check and it runs on every
 * render, so a manager may reload protected pages and a rejected session is
 * never rendered.
 */
export async function requireHospitalManager(): Promise<HospitalManagerSession> {
  let supabase: SupabaseClient;
  try {
    supabase = await createSupabaseServerClient();
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) {
      redirect("/login?reason=unexpected");
    }
    throw error;
  }

  let userId: string | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id ?? null;
  } catch {
    redirect("/login?reason=network");
  }

  if (!userId) redirect("/login?reason=session");

  const result = await verifyHospitalManager(supabase, userId);
  if (!result.ok) redirect(`/login?reason=${result.code}`);

  return result.manager;
}

/** Used by the login page to send an already-verified manager to the workspace. */
export async function getHospitalManagerOrNull(): Promise<HospitalManagerSession | null> {
  let supabase;
  try {
    supabase = await createSupabaseServerClient();
  } catch {
    return null;
  }

  try {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return null;
    const result = await verifyHospitalManager(supabase, data.user.id);
    return result.ok ? result.manager : null;
  } catch {
    return null;
  }
}
