"use server";

import { FunctionsFetchError, FunctionsHttpError } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  CreateHospitalDriverErrorCode,
  CreateHospitalDriverResult,
} from "@/lib/drivers/types";
import { toE164 } from "@/lib/phone";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CreateHospitalDriverInput = {
  fullName: string;
  /** The eight national digits, already masked in the form. */
  phoneDigits: string;
  password: string;
  passwordConfirmation: string;
  phoneOwnershipVerified: boolean;
};

async function functionErrorCode(error: unknown): Promise<string | null> {
  if (!(error instanceof FunctionsHttpError)) return null;
  const response = error.context as Response | undefined;
  if (!response || typeof response.json !== "function") return null;
  try {
    const body = (await response.json()) as { error_code?: unknown };
    return typeof body?.error_code === "string" ? body.error_code : null;
  } catch {
    return null;
  }
}

function mapFunctionErrorCode(code: string | null): CreateHospitalDriverErrorCode {
  switch (code) {
    case "phone_already_registered":
    case "hospital_account_already_exists":
      return "phone_already_registered";
    case "phone_provider_not_enabled":
      return "phone_provider_disabled";
    case "invalid_member_name":
      return "validation_name";
    case "invalid_member_phone":
      return "validation_phone";
    case "invalid_member_password":
      return "validation_passwordLength";
    case "phone_not_verified":
      return "validation_phoneOwnership";
    case "not_authorized":
    case "account_type_not_allowed":
    case "hospital_not_authorized":
      return "not_authorized";
    case "hospital_not_found":
      return "hospital_not_found";
    case "unauthenticated":
      return "session_expired";
    case "server_configuration_error":
      return "service_unavailable";
    case "auth_user_creation_failed":
    case "hospital_lookup_failed":
    case "phone_lookup_failed":
    case "hospital_account_rejected":
    case "hospital_account_provisioning_failed":
      return "provisioning_failed";
    default:
      return "unexpected";
  }
}

/**
 * Creates one hospital driver through the existing `provision-hospital-user`
 * Edge Function. The function derives the hospital from the caller's own active
 * manager membership, so no hospital id is sent from here.
 */
export async function createHospitalDriver(
  input: CreateHospitalDriverInput,
): Promise<CreateHospitalDriverResult> {
  const fullName = input.fullName.trim();
  const password = input.password.trim();

  if (!fullName || fullName.length > 120) {
    return { ok: false, code: "validation_name" };
  }
  if (!/^\d{8}$/.test(input.phoneDigits)) {
    return { ok: false, code: "validation_phone" };
  }
  if (password.length < 6) {
    return { ok: false, code: "validation_passwordLength" };
  }
  if (password !== input.passwordConfirmation.trim()) {
    return { ok: false, code: "validation_passwordMismatch" };
  }
  if (!input.phoneOwnershipVerified) {
    return { ok: false, code: "validation_phoneOwnership" };
  }

  let supabase: SupabaseClient;
  try {
    supabase = await createSupabaseServerClient();
  } catch {
    return { ok: false, code: "service_unavailable" };
  }

  const { data, error } = await supabase.functions.invoke("provision-hospital-user", {
    body: {
      full_name: fullName,
      phone: toE164(input.phoneDigits),
      password,
      account_type: "driver",
      phone_verified: true,
    },
  });

  if (error) {
    if (error instanceof FunctionsFetchError) {
      return { ok: false, code: "network" };
    }
    const code = mapFunctionErrorCode(await functionErrorCode(error));
    return { ok: false, code };
  }

  const userId =
    data && typeof data === "object"
      ? (data as { user_id?: unknown }).user_id
      : null;
  const succeeded =
    data && typeof data === "object" && (data as { ok?: unknown }).ok === true;
  if (!succeeded || typeof userId !== "string") {
    return { ok: false, code: "unexpected" };
  }
  return { ok: true, userId };
}
