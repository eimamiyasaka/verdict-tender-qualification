import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfig } from "./supabase-env";

/**
 * The middleware flavour.
 *
 * Middleware runs before every protected request and is where the session is
 * refreshed (§6). A refresh rotates the auth cookies, and those cookies have to
 * be written onto BOTH sides: the request, so the rest of this pass sees the new
 * session, and the response, so the browser keeps it. `@supabase/ssr` hands them
 * over in `setAll`, which can fire at any point during `getUser()`, so the
 * response is rebuilt there and read back afterwards through `response()`.
 *
 * When middleware answers with a redirect instead, the caller must copy these
 * cookies across — see `src/middleware.ts`. Dropping them makes every request
 * refresh a session the browser then throws away, and the user is signed out at
 * a random moment when the old token finally expires.
 */
export function createMiddlewareClient(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const { url, anonKey } = supabaseConfig();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        supabaseResponse = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          supabaseResponse.cookies.set(name, value, options);
        }
      },
    },
  });

  return { supabase, response: () => supabaseResponse };
}
