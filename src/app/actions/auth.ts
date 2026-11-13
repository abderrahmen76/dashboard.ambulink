"use server";

import { FunctionsHttpError } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import type { LoginState, ResetState } from "@/lib/auth/action-types";
import { verifyHospitalManager } from "@/lib/auth/hospital-manager";
import {
  normalizeTunisianPhoneDigits,
  toCanonicalPhone,
  toE164,
} from "@/lib/phone";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function authErrorCode(error: unknown): string {
  const code =
    typeof (error as { code?: unknown })?.code === "string"
      ? String((error as { code: string }).code)
      : "";
  const status =
    typeof (error as { status?: unknown })?.status === "number"
      ? (error as { status: number }).status
      : undefined;
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  switch (code) {
    case "invalid_credentials":
    case "user_not_found":
    case "session_not_found":
    case "refresh_token_not_found":
      return "invalid_credentials";
    case "phone_not_confirmed":
      return "account_not_confirmed";
    case "phone_provider_disabled":
      return "provider_disabled";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
    case "too_many_requests":
      return "rate_limited";
    case "user_banned":
      return "account_disabled";
    case "weak_password":
      return "invalid_credentials";
  }

  if (message.includes("invalid login credentials")) return "invalid_credentials";
  if (message.includes("phone not confirmed")) return "account_not_confirmed";
  if (message.includes("phone signups not allowed")) return "provider_disabled";
  if (message.includes("banned")) return "account_disabled";
  if (status === 0 || (status !== undefined && status >= 500)) return "network";
  if (message.includes("fetch") || message.includes("network")) return "network";
  return "unexpected";
}

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

export async function signInHospitalManager(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const digits = normalizeTunisianPhoneDigits(String(formData.get("phone") ?? ""));
  const password = String(formData.get("password") ?? "");

  if (!digits) return { status: "error", code: "validation_phone" };
  if (password.length === 0) return { status: "error", code: "validation_password" };

  let supabase: SupabaseClient;
  try {
    supabase = await createSupabaseServerClient();
  } catch {
    return { status: "error", code: "service_unavailable" };
  }

  let userId: string;
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      phone: toE164(digits),
      password,
    });
    if (error || !data.user) {
      return { status: "error", code: authErrorCode(error) };
    }
    userId = data.user.id;
  } catch (error) {
    return { status: "error", code: authErrorCode(error) };
  }

  let verification;
  try {
    verification = await verifyHospitalManager(supabase, userId);
  } catch {
    // The credentials were accepted but access cannot be verified right now.
    // Keep the session so the user can retry, and fail closed.
    return { status: "error", code: "network" };
  }

  if (!verification.ok) {
    if (verification.code === "network") {
      return { status: "error", code: "network" };
    }
    try {
      await supabase.auth.signOut();
    } catch {
      // The cookies are still cleared by the next proxy refresh attempt.
    }
    return { status: "error", code: verification.code };
  }

  redirect("/dashboard");
}

export async function signOutHospitalManager(): Promise<void> {
  try {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  } catch {
    // Redirect anyway: the protected pages re-verify and refuse the session.
  }
  redirect("/login?signedOut=1");
}

export async function requestHospitalManagerPasswordReset(
  _previous: ResetState,
  formData: FormData,
): Promise<ResetState> {
  const digits = normalizeTunisianPhoneDigits(String(formData.get("phone") ?? ""));
  const password = String(formData.get("newPassword") ?? "").trim();
  const confirmation = String(formData.get("confirmPassword") ?? "").trim();
  const explanation = String(formData.get("explanation") ?? "").trim();

  if (!digits) return { status: "error", code: "validation_phone" };
  if (password.length === 0) return { status: "error", code: "validation_password" };
  if (password.length < 6 || password.length > 72) {
    return { status: "error", code: "validation_passwordLength" };
  }
  if (password !== confirmation) {
    return { status: "error", code: "validation_passwordMismatch" };
  }
  if (explanation.length > 1000) {
    return { status: "error", code: "validation_explanation" };
  }

  let supabase: SupabaseClient;
  try {
    supabase = await createSupabaseServerClient();
  } catch {
    return { status: "error", code: "service_unavailable" };
  }

  const { data, error } = await supabase.functions.invoke("password-reset-request", {
    body: {
      phone: toCanonicalPhone(digits),
      account_type: "hospital_manager",
      new_password: password,
      explanation: explanation || null,
    },
  });

  if (error) {
    const code = await functionErrorCode(error);
    if (code === "invalid_password") {
      return { status: "error", code: "validation_passwordLength" };
    }
    if (code === "invalid_explanation") {
      return { status: "error", code: "validation_explanation" };
    }
    if (code === "invalid_request") {
      return { status: "error", code: "reset_invalid" };
    }
    return { status: "error", code: "reset_unavailable" };
  }

  if (data && typeof data === "object" && (data as { ok?: unknown }).ok === true) {
    return { status: "sent" };
  }

  return { status: "error", code: "reset_unavailable" };
}
