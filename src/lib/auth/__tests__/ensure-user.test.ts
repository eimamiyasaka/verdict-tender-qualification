import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/client";
import { getUserById, upsertUser } from "@/lib/db/users";

/**
 * The mirror-row contract `ensureUser()` depends on (§7.3).
 *
 * `ensureUser()` itself reads the Supabase session, so it cannot run without a
 * network round trip; what is worth pinning down is the part that must not
 * drift — the row is keyed by the SUPPLIED Supabase auth user id, and repeat
 * sign-ins update that one row rather than accumulating rows.
 *
 * `upsertUser`/`getUserById` are Prisma calls (see `src/lib/db/org.ts`), so this
 * needs a real database with the schema applied — opt in explicitly:
 *
 *     VERDICT_TEST_DB=1 DATABASE_URL=postgresql://…/verdict_test npm test
 */

/** A Supabase auth uuid the seed knows nothing about — a first-time sign-in. */
const AUTH_ID = "0b9f4c31-77ad-4a2e-8c15-3d6e1f9a4402";
const EMAIL = "new.starter@meridianfacilities.co.uk";

const hasDatabase = Boolean(process.env.DATABASE_URL) && process.env.VERDICT_TEST_DB === "1";

describe.runIf(hasDatabase)("the users mirror row", () => {
  beforeEach(() => prisma.user.deleteMany({ where: { id: AUTH_ID } }));
  afterAll(() => prisma.user.deleteMany({ where: { id: AUTH_ID } }));

  it("is created exactly once per user, however often they sign in", async () => {
    await upsertUser({ id: AUTH_ID, email: EMAIL, displayName: null });
    await upsertUser({ id: AUTH_ID, email: EMAIL, displayName: "New Starter" });
    await upsertUser({ id: AUTH_ID, email: EMAIL, displayName: "New Starter" });

    expect(await prisma.user.count({ where: { id: AUTH_ID } })).toBe(1);
    expect((await getUserById(AUTH_ID))?.displayName).toBe("New Starter");
  });

  it("takes the id it is given rather than generating one", async () => {
    await upsertUser({ id: AUTH_ID, email: EMAIL, displayName: null });
    expect((await getUserById(AUTH_ID))?.id).toBe(AUTH_ID);
  });
});
