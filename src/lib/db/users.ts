/**
 * Users and memberships (§7.3). A user belongs to exactly one organisation in v1.
 *
 * Prisma seam: replace the store reads with `prisma.user` / `prisma.membership` queries.
 */
import type { Membership, Organisation, OrgRole, User } from "@/lib/types";
import { clone, getStore } from "./_placeholder/store";

/**
 * Creates or refreshes the public `users` mirror row for a Supabase auth user
 * (§7.3). The id is SUPPLIED, never generated: it equals the Supabase auth user
 * id, because Prisma cannot own `auth.users` and every user-referencing foreign
 * key in the app points here instead.
 *
 * Called only by `ensureUser()` in src/lib/auth/ after sign-in. The seed is the
 * one other writer of this table.
 *
 * Prisma seam: `prisma.user.upsert({ where: { id }, create: input, update: {
 * email, displayName } })`. Note that `email` is unique, so an address already
 * held by a row with a different id is a conflict the caller cannot resolve —
 * it means the seeded row and the Supabase account disagree about the id.
 */
export async function upsertUser(input: { id: string; email: string; displayName: string | null }): Promise<void> {
  const store = getStore();
  const existing = store.users.find((u) => u.id === input.id);
  if (existing) {
    existing.email = input.email;
    if (input.displayName !== null) existing.displayName = input.displayName;
    return;
  }
  store.users.push({ id: input.id, email: input.email, displayName: input.displayName, createdAt: new Date() });
}

export async function getUserById(id: string): Promise<User | null> {
  const user = getStore().users.find((u) => u.id === id);
  return user ? clone(user) : null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const needle = email.trim().toLowerCase();
  const user = getStore().users.find((u) => u.email.toLowerCase() === needle);
  return user ? clone(user) : null;
}

/** The single membership for a user, with its organisation. Null when the user has none. */
export async function getMembershipForUser(
  userId: string,
): Promise<{ membership: Membership; organisation: Organisation } | null> {
  const store = getStore();
  const membership = store.memberships.find((m) => m.userId === userId);
  if (!membership) return null;
  const organisation = store.organisations.find((o) => o.id === membership.orgId);
  if (!organisation) return null;
  return { membership: clone(membership), organisation: clone(organisation) };
}

export async function listOrgMembers(orgId: string): Promise<Array<User & { role: OrgRole }>> {
  const store = getStore();
  return store.memberships
    .filter((m) => m.orgId === orgId)
    .map((m) => {
      const user = store.users.find((u) => u.id === m.userId);
      return user ? { ...clone(user), role: m.role } : null;
    })
    .filter((u): u is User & { role: OrgRole } => u !== null)
    .sort((a, b) => (a.displayName ?? a.email).localeCompare(b.displayName ?? b.email));
}
