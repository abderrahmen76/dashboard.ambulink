import type { SupabaseClient } from "@supabase/supabase-js";

export type ManagerAccessErrorCode =
  | "unauthorized_role"
  | "missing_hospital"
  | "membership_inactive"
  | "access_disabled"
  | "profile_missing"
  | "network";

export type HospitalManagerSession = {
  userId: string;
  fullName: string | null;
  phone: string | null;
  hospitalId: string;
  hospitalName: string;
};

export type ManagerVerification =
  | { ok: true; manager: HospitalManagerSession }
  | { ok: false; code: ManagerAccessErrorCode };

type ProfileRow = {
  id: string;
  role: string | null;
  full_name: string | null;
  phone: string | null;
};

type MembershipRow = {
  hospital_id: string;
  membership_role: string;
  is_active: boolean;
};

type HospitalRow = {
  id: string;
  name: string;
  is_active: boolean;
};

/**
 * Authoritative access check for the Clinic. It runs on the server with the
 * signed-in user's session, so every read is also constrained by RLS:
 *   - `profiles.role` must be `hospital_manager`;
 *   - the caller's `hospital_memberships` row must be an active manager row;
 *   - `is_active_hospital_manager(hospital_id)` re-checks the association and
 *     the hospital's active/management state on the database;
 *   - `current_hospital_management_enabled()` is the documented entitlement
 *     gate for the Clinic.
 * A client-side role value is never trusted on its own.
 */
export async function verifyHospitalManager(
  supabase: SupabaseClient,
  userId: string,
): Promise<ManagerVerification> {
  const profileResult = await supabase
    .from("profiles")
    .select("id, role, full_name, phone")
    .eq("id", userId)
    .maybeSingle<ProfileRow>();

  if (profileResult.error) return { ok: false, code: "network" };
  const profile = profileResult.data;
  if (!profile || profile.id !== userId) {
    return { ok: false, code: "profile_missing" };
  }
  if (profile.role !== "hospital_manager") {
    return { ok: false, code: "unauthorized_role" };
  }

  const membershipResult = await supabase
    .from("hospital_memberships")
    .select("hospital_id, membership_role, is_active")
    .eq("user_id", userId)
    .eq("membership_role", "hospital_manager")
    .maybeSingle<MembershipRow>();

  if (membershipResult.error) return { ok: false, code: "network" };
  const membership = membershipResult.data;
  if (!membership?.hospital_id) return { ok: false, code: "missing_hospital" };
  if (membership.is_active !== true) {
    return { ok: false, code: "membership_inactive" };
  }

  const entitlement = await supabase.rpc("current_hospital_management_enabled");
  if (entitlement.error) {
    return {
      ok: false,
      code: entitlement.error.code === "42501" ? "access_disabled" : "network",
    };
  }
  if (entitlement.data !== true) return { ok: false, code: "access_disabled" };

  const association = await supabase.rpc("is_active_hospital_manager", {
    target_hospital_id: membership.hospital_id,
  });
  if (association.error) {
    return {
      ok: false,
      code: association.error.code === "42501" ? "access_disabled" : "network",
    };
  }
  if (association.data !== true) return { ok: false, code: "access_disabled" };

  const hospitalResult = await supabase
    .from("hospitals")
    .select("id, name, is_active")
    .eq("id", membership.hospital_id)
    .maybeSingle<HospitalRow>();

  if (hospitalResult.error) return { ok: false, code: "network" };
  const hospital = hospitalResult.data;
  if (!hospital || hospital.is_active !== true) {
    return { ok: false, code: "access_disabled" };
  }

  return {
    ok: true,
    manager: {
      userId,
      fullName: profile.full_name?.trim() || null,
      phone: profile.phone?.trim() || null,
      hospitalId: hospital.id,
      hospitalName: hospital.name,
    },
  };
}
