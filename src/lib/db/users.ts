/**
 * Compatibility surface for the screens and the placeholder session helper.
 *
 * `org.ts` is canonical: it holds the two audited exceptions to §6.3 in the
 * shapes the auth branch was given (`upsertUser`, `getMembershipForUser →
 * { orgId, role, orgName }`). This module exists because `src/lib/auth/session.
 * ts` and `/tenders/[id]` on `main` were written against a richer membership
 * shape while the data layer was still an in-memory store, and neither file is
 * this branch's to edit.
 *
 * Nothing new belongs here. When Supabase Auth lands and `session.ts` is
 * rewritten against `org.ts`, this file goes with it.
 */

import type { Membership, Organisation, OrgRole, User } from "@/lib/types";
import { prisma, type Db } from "./client";
import { toOrganisation, toUser } from "./org";
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
export { upsertUser, getUserById, getUserByEmail, listOrgMembers, getOrganisation } from "./org";

/**
 * The membership plus its organisation, which is what `getOrgContext()` needs
 * to build an `OrgContext` in one call. `org.ts` holds the narrow version.
 */
export async function getMembershipForUser(
  userId: string,
  db: Db = prisma,
): Promise<{ membership: Membership; organisation: Organisation } | null> {
  const row = await db.membership.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    include: { organisation: true },
  });
  if (!row) return null;
  return {
    membership: {
      id: row.id,
      orgId: row.orgId,
      userId: row.userId,
      role: row.role as OrgRole,
      createdAt: row.createdAt,
    },
    organisation: toOrganisation(row.organisation),
  };
}

/** Re-exported for symmetry with the placeholder module this replaces. */
export type { User };
export { toUser };
