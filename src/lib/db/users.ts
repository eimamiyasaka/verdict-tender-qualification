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

export { getUserById, getUserByEmail, listOrgMembers, getOrganisation } from "./org";

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
