import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseEnv } from "@/lib/supabase/env";

/**
 * Refreshes the Supabase session cookie before rendering and performs an
 * optimistic guard on the protected area. It is not an authorization check:
 * `requireHospitalManager()` re-verifies the role, hospital association and
 * entitlement on every render.
 */
export async function proxy(request: NextRequest) {
  const env = getSupabaseEnv();
  if (!env) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        for (const [name, value] of Object.entries(headers)) {
          response.headers.set(name, value);
        }
      },
    },
  });

  let sessionKnown = false;
  let authenticated = false;
  try {
    const { data } = await supabase.auth.getClaims();
    sessionKnown = true;
    authenticated = Boolean(data?.claims);
  } catch {
    // Let the page-level guard decide; never redirect on an unknown state.
    sessionKnown = false;
  }

  const { pathname } = request.nextUrl;

  if (
    sessionKnown &&
    !authenticated &&
    (pathname.startsWith("/dashboard") ||
      pathname.startsWith("/missions") ||
      pathname.startsWith("/reports") ||
      pathname.startsWith("/fleet") ||
      pathname.startsWith("/drivers"))
  ) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "?reason=session";
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
