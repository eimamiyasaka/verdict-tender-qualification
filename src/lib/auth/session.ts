import "server-only";
import { redirect } from "next/navigation";
import { getMembershipForUser, getUserById } from "@/lib/db/users";
import type { OrgContext } from "@/lib/types";
import { createClient } from "./supabase-server";

/**
 * The read side of identity: who is signed in, and which organisation they act
 * for. Supabase answers the first question and nothing else (§6) — the second
 * is a database question, answered through src/lib/db/.
 */

export interface Session {
  /** Equals the Supabase auth user id, and therefore the mirror row id (§7.3). */
  userId: string;
  email: string;
}

/**
 * The signed-in Supabase user, or null.
 *
 * `getUser()` rather than `getSession()`: it revalidates the token with the auth
 * server instead of trusting a cookie the browser sent us. Slower, and the only
 * safe choice on the server.
 */
export async function getSession(): Promise<Session | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.email ? { userId: user.id, email: user.email } : null;
}

/**
 * Resolves the session user to their single membership (§7.3).
 *
 * A user belongs to exactly one organisation in v1 and there is no org switcher.
 * This is the ONLY source of `orgId` in the application: every Server Component
 * and Server Action gets it from here, never from a URL, form field or request
 * body (§6.3).
 *
 * Redirects to /login when there is no session. Throws when a signed-in user has
 * no mirror row or no membership — both are states the product has no screen for,
 * and both are better as a loud error than a silently empty organisation.
 */
export async function getOrgContext(): Promise<OrgContext> {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await getUserById(session.userId);
  if (!user) {
    throw new Error(
      "We couldn't find your Verdict account record. Sign out and sign in again — that recreates it. If it keeps happening, ask an owner to check the invitation.",
    );
  }

  const membership = await getMembershipForUser(user.id);
  if (!membership) {
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
