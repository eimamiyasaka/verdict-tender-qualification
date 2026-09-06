import { NextResponse, type NextRequest } from "next/server";

/**
 * Route guard. Anything that is not /login or a static asset needs a session
 * cookie; a signed-in visitor to /login goes to the pipeline. The cookie is
 * verified against the user table in `getOrgContext()`, so this only decides
 * where to send people, never what they can read.
 */
const SESSION_COOKIE = "verdict_session";
const PUBLIC_PATHS = ["/login"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!hasSession && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  if (hasSession && isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|packs|favicon.ico|icon.svg|robots.txt).*)"],
};
