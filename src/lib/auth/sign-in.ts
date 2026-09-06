import "server-only";
import { createClient } from "./supabase-server";

/**
 * Password sign-in against Supabase Auth. Both entry points are called only from
 * Server Actions, which is what keeps `DEMO_PASSWORD` out of the client bundle
 * (§12.2).
 *
 * On success the Supabase client has written the session cookies; the caller
 * redirects through /auth/callback, which creates the mirror row (§7.3).
 */

export type SignInResult = { ok: true; userId: string } | { ok: false; error: string };

/**
 * One message for every failure — wrong password, unknown address, unconfirmed
 * account, rate limit. Saying which would tell an attacker whether an email is
 * registered, and the raw Supabase string ("Invalid login credentials") is not
 * how this interface speaks (§11).
 */
const SIGN_IN_FAILED =
  "That email and password don't match an account. Check them and try again, or use View demo to look around without one.";

const DEMO_NOT_CONFIGURED = "The demo account isn't configured on this deployment.";

export async function signInWithPassword(email: string, password: string): Promise<SignInResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  if (error || !data.user) return { ok: false, error: SIGN_IN_FAILED };
  return { ok: true, userId: data.user.id };
}

/**
 * The View demo button (§12.2). Credentials come from server-side env and are
 * read here, in a module marked `server-only`, so they cannot be inlined into a
 * client bundle. They match the seeded demo user in fixtures/organisation.ts.
 */
export async function signInDemo(): Promise<SignInResult> {
  const email = process.env.DEMO_EMAIL;
  const password = process.env.DEMO_PASSWORD;
  if (!email || !password) return { ok: false, error: DEMO_NOT_CONFIGURED };
  return signInWithPassword(email, password);
}
