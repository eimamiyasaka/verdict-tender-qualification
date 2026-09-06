/**
 * Users and memberships (§7.3). A user belongs to exactly one organisation in v1.
 *
 * Prisma seam: replace the store reads with `prisma.user` / `prisma.membership` queries.
 */
import type { Membership, Organisation, OrgRole, User } from "@/lib/types";
import { clone, getStore } from "./_placeholder/store";

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
