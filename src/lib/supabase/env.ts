export type SupabaseEnv = {
  url: string;
  key: string;
};

let missingConfigReported = false;

/** Names only: a missing value must never be logged or rendered. */
function reportMissingConfig(missing: string[]): void {
  if (missingConfigReported || typeof window !== "undefined") return;
  missingConfigReported = true;
  console.error(
    `[ambulink-clinic] Supabase configuration is incomplete. Missing: ${missing.join(
      ", ",
    )}. NEXT_PUBLIC_* values are inlined at build time, so set them in the deployment environment and redeploy.`,
  );
}

/**
 * Browser-safe configuration only: the project URL and the publishable/anon key.
 * A service-role or secret key must never be read here.
 */
export function getSupabaseEnv(): SupabaseEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )?.trim();
  if (!url || !key) {
    const missing: string[] = [];
    if (!url) missing.push("NEXT_PUBLIC_SUPABASE_URL");
    if (!key) {
      missing.push(
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)",
      );
    }
    reportMissingConfig(missing);
    return null;
  }
  return { url, key };
}
