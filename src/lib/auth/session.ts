import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getMembershipForUser, getUserByEmail, getUserById } from "@/lib/db/users";
import type { OrgContext } from "@/lib/types";

/**
 * PLACEHOLDER AUTH.
 *
 * Supabase Auth is the identity provider (§6). Until the server branch wires
 * `@supabase/ssr`, the session is an httpOnly cookie holding the user id of a
 * seeded user. The public surface — `getSession`, `getOrgContext`,
 * `signInWithPassword`, `signOut` — is what the app uses and stays the same
 * when the real provider lands.
 *
 * `ensureUser()` (§7.3) — the one place the public `users` mirror row is
 * upserted after sign-in — is not needed while users come from the seed.
 */

const COOKIE_NAME = "verdict_session";
const ONE_WEEK = 60 * 60 * 24 * 7;

export const DEMO_EMAIL = process.env.DEMO_EMAIL ?? "demo@meridianfacilities.co.uk";
export const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "verdict-demo";

export interface Session {
  userId: string;
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const value = store.get(COOKIE_NAME)?.value;
  if (!value) return null;
  const user = await getUserById(value);
  return user ? { userId: user.id } : null;
}

/**
 * Resolves the session user to their single membership (§7.3). Redirects to
 * /login when there is no session; throws when a signed-in user has no
 * organisation, which the seed never produces.
 */
export async function getOrgContext(): Promise<OrgContext> {
  const session = await getSession();
  if (!session) redirect("/login");
  const user = await getUserById(session.userId);
  const membership = user ? await getMembershipForUser(user.id) : null;
  if (!user || !membership) {
    throw new Error("Your account isn't attached to an organisation yet. Ask an owner to invite you.");
  }
  return {
    orgId: membership.organisation.id,
    userId: user.id,
    organisation: membership.organisation,
    user,
    role: membership.membership.role,
  };
}

export type SignInResult = { ok: true; userId: string } | { ok: false; error: string };

export async function signInWithPassword(email: string, password: string): Promise<SignInResult> {
  const normalised = email.trim().toLowerCase();
  if (normalised === DEMO_EMAIL.toLowerCase() && password === DEMO_PASSWORD) {
    const user = await getUserByEmail(DEMO_EMAIL);
    if (user) {
      await createSession(user.id);
      return { ok: true, userId: user.id };
    }
  }
  return {
    ok: false,
    error: "That email and password weren't recognised. Check them, or use View demo to explore the seeded organisation.",
  };
}

export async function signInDemo(): Promise<SignInResult> {
  return signInWithPassword(DEMO_EMAIL, DEMO_PASSWORD);
}

export async function createSession(userId: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, userId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_WEEK,
  });
}

export async function signOut(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export { COOKIE_NAME as SESSION_COOKIE_NAME };
