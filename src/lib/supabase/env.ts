export type SupabaseEnv = {
  url: string;
  key: string;
};

/**
 * Browser-safe configuration only: the project URL and the publishable/anon key.
 * A service-role or secret key must never be read here.
 */
export function getSupabaseEnv(): SupabaseEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) return null;
  return { url, key };
}
