import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseEnv } from "./env";

export class SupabaseNotConfiguredError extends Error {
  constructor() {
    super("Supabase environment variables are missing.");
    this.name = "SupabaseNotConfiguredError";
  }
}

/**
 * New client per request. Cookies are read from the incoming request and
 * written back when the caller is a Server Action or Route Handler; refresh
 * happens in `src/proxy.ts` for rendered pages.
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  const env = getSupabaseEnv();
  if (!env) throw new SupabaseNotConfiguredError();

  const cookieStore = await cookies();

  return createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot set cookies. The proxy refreshes the
          // session before rendering, so only actions and routes need writes.
        }
      },
    },
  });
}
