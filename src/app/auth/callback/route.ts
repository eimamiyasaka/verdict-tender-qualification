import { NextResponse, type NextRequest } from "next/server";
import { ensureUser } from "@/lib/auth/ensure-user";
import { safeNextPath } from "@/lib/auth/next-path";
import { createClient } from "@/lib/auth/supabase-server";

/**
 * The post-sign-in callback (§7.3).
 *
 * Every way into the application lands here first, and it does one thing the
 * sign-in itself cannot: it creates the public `users` mirror row. That is why
 * `ensureUser()` is called from exactly one place — put it in `getOrgContext()`
 * instead and every page render becomes a write.
 *
 * Two ways in:
 *   - `?code=` — the PKCE exchange behind an email confirmation or any provider
 *     redirect. The code becomes a session here.
 *   - no code — the password Server Actions, which have already signed the user
 *     in and set the cookies; this route just makes the mirror row and forwards.
 *
 * Public in middleware, because the visitor arriving with a `code` is by
 * definition not signed in yet.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"));
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(`${origin}/login?error=link`);
  }

  let userId: string | null;
  try {
    userId = await ensureUser();
  } catch (error) {
    // The mirror row could not be written. The user is authenticated but has no
    // application record, so there is nothing to show them; say what to do
    // rather than rendering an empty organisation.
    console.error("ensureUser failed during the sign-in callback", error);
    return NextResponse.redirect(`${origin}/login?error=account`);
  }

  if (!userId) return NextResponse.redirect(`${origin}/login?error=link`);

  return NextResponse.redirect(`${origin}${next}`);
}
