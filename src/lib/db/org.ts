/**
 * Identity and tenancy (§7.3).
 *
 * **The two audited exceptions to the §6.3 rule live here.** `upsertUser` and
 * `getMembershipForUser` are the only exported functions in `src/lib/db/` that
 * do not take `orgId` as their first argument, because they are what *resolves*
 * it: the session hands them a user id, they hand back the organisation every
 * other function in this layer then filters on. `src/lib/db/__tests__/tenancy.
 * test.ts` names them explicitly rather than letting them slip through.
 *
 * A user belongs to exactly one organisation in v1 (§7.3), so the membership
 * lookup returns one row or null and the UI never offers an org switcher.
 */

import type { OrgRole } from "../../../contracts";
import type { Organisation, User } from "@/lib/types";
import { prisma } from "./client";
import type { Db } from "./client";

/* ---------------------------------------------------------------------------
 * Row → view mappers. Kept here because every other module needs them.
 * ------------------------------------------------------------------------- */

interface UserRow {
  id: string;
  email: string;
  displayName: string | null;
  createdAt: Date;
}

interface OrganisationRow {
  id: string;
  name: string;
  companiesHouseNumber: string | null;
  headcount: number | null;
  registeredRegion: string | null;
  sicCodes: string[];
  createdAt: Date;
}

export function toUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    createdAt: row.createdAt,
  };
}

export function toOrganisation(row: OrganisationRow): Organisation {
  return {
    id: row.id,
    name: row.name,
    companiesHouseNumber: row.companiesHouseNumber,
    headcount: row.headcount,
    registeredRegion: row.registeredRegion,
    sicCodes: row.sicCodes,
    createdAt: row.createdAt,
  };
}

/* ---------------------------------------------------------------------------
 * The two exceptions.
 * ------------------------------------------------------------------------- */

/**
 * The `users` mirror row (§7.3). `id` EQUALS the Supabase auth user id and is
 * supplied, never generated. Called by the post-sign-in callback in
 * `src/lib/auth/` and by the seed; nothing else writes to this table.
 *
 * No `orgId`: this runs before an organisation is known. It is an upsert on the
 * primary key, so a repeated sign-in is a no-op rather than a duplicate.
 */
export async function upsertUser(input: {
  id: string;
  email: string;
  displayName: string | null;
}): Promise<void> {
  await prisma.user.upsert({
    where: { id: input.id },
    create: { id: input.id, email: input.email, displayName: input.displayName },
    update: { email: input.email, displayName: input.displayName },
  });
}

/**
 * Resolves a session user to their single organisation. This is where `orgId`
 * comes from; every other read and write in this layer takes the result of this
 * call and never a value from a URL, form field or request body (§6.3).
 *
 * Returns null when the user has no membership — `getOrgContext()` turns that
 * into a message, because a signed-in user with no organisation is a real state
 * and not an exception to swallow.
 */
export async function getMembershipForUser(
  userId: string,
): Promise<{ orgId: string; role: OrgRole; orgName: string } | null> {
  const membership = await prisma.membership.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { orgId: true, role: true, organisation: { select: { name: true } } },
  });
  if (!membership) return null;
  return {
    orgId: membership.orgId,
    role: membership.role,
    orgName: membership.organisation.name,
  };
}

/* ---------------------------------------------------------------------------
 * Identity lookups. Also pre-organisation by nature — a sign-in has only an id
 * or an email to go on — and audited as exceptions by the tenancy test.
 * ------------------------------------------------------------------------- */

export async function getUserById(id: string): Promise<User | null> {
  const row = await prisma.user.findUnique({ where: { id } });
  return row ? toUser(row) : null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const row = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  return row ? toUser(row) : null;
}

/* ---------------------------------------------------------------------------
 * Org-scoped reads. `orgId` first, like everything else.
 * ------------------------------------------------------------------------- */

export async function getOrganisation(orgId: string, db: Db = prisma): Promise<Organisation | null> {
  const row = await db.organisation.findUnique({ where: { id: orgId } });
  return row ? toOrganisation(row) : null;
}

/** The people who can be assigned a bid task (§7.7). */
export async function listOrgMembers(orgId: string): Promise<Array<User & { role: OrgRole }>> {
  const memberships = await prisma.membership.findMany({
    where: { orgId },
    include: { user: true },
  });
  return memberships
    .map((m) => ({ ...toUser(m.user), role: m.role as OrgRole }))
    .sort((a, b) =>
      (a.displayName ?? a.email).localeCompare(b.displayName ?? b.email),
    );
}
