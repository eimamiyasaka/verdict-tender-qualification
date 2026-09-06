import { NextResponse, type NextRequest } from "next/server";
import { createMiddlewareClient } from "@/lib/auth/supabase-middleware";

/**
 * Route guard and session refresh.
 *
 * Two jobs, in this order. First, refresh the Supabase session on every request:
 * access tokens are short-lived, and middleware is the only place that can hand
 * the browser a rotated cookie before a Server Component reads it. Second,
 * decide where an unauthenticated visitor goes.
 *
 * It decides where people are sent, never what they can read. Authorisation is
 * `getOrgContext()` plus the orgId every function in src/lib/db/ takes (§6.3);
 * a forged cookie gets past nothing here, because `getUser()` revalidates the
 * token with the auth server rather than decoding it locally.
 */

/** Everything else needs a session. /auth/* carries the post-sign-in callback. */
const PUBLIC_PATHS = ["/login", "/auth"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function middleware(request: NextRequest) {
  const { supabase, response } = createMiddlewareClient(request);

  // Refreshes the session as a side effect, and revalidates the token.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const signedIn = Boolean(user);

  if (!signedIn && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + request.nextUrl.search)}`;
    return withRefreshedCookies(NextResponse.redirect(url), response());
  }

  if (signedIn && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return withRefreshedCookies(NextResponse.redirect(url), response());
  }

  return response();
}

/**
 * A redirect built here is a different response object from the one Supabase
 * wrote the rotated cookies onto, so they have to be carried across. Without
 * this the session refreshes on every request and the browser keeps none of it,
 * and the visitor is signed out at an arbitrary moment when the old token
 * finally expires.
 */
function withRefreshedCookies(redirect: NextResponse, refreshed: NextResponse): NextResponse {
  for (const cookie of refreshed.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  return redirect;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|packs|favicon.ico|icon.svg|robots.txt).*)"],
};
