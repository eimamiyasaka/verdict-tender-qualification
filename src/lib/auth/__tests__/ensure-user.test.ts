import { describe, expect, it } from "vitest";
import { getStore } from "@/lib/db/_placeholder/store";
import { getUserById, upsertUser } from "@/lib/db/users";

/**
 * The mirror-row contract `ensureUser()` depends on (§7.3).
 *
 * `ensureUser()` itself reads the Supabase session, so it cannot run without a
 * network round trip; what is worth pinning down is the part that must not
 * drift — the row is keyed by the SUPPLIED Supabase auth user id, and repeat
 * sign-ins update that one row rather than accumulating rows.
 */

/** A Supabase auth uuid the seed knows nothing about — a first-time sign-in. */
const AUTH_ID = "0b9f4c31-77ad-4a2e-8c15-3d6e1f9a4402";
const EMAIL = "new.starter@meridianfacilities.co.uk";

describe("the users mirror row", () => {
  it("is created exactly once per user, however often they sign in", async () => {
    const before = getStore().users.length;

    await upsertUser({ id: AUTH_ID, email: EMAIL, displayName: null });
    expect(getStore().users).toHaveLength(before + 1);

    await upsertUser({ id: AUTH_ID, email: EMAIL, displayName: "New Starter" });
    await upsertUser({ id: AUTH_ID, email: EMAIL, displayName: "New Starter" });

    expect(getStore().users).toHaveLength(before + 1);
    expect(getStore().users.filter((u) => u.id === AUTH_ID)).toHaveLength(1);
    expect((await getUserById(AUTH_ID))?.displayName).toBe("New Starter");
  });

  it("takes the id it is given rather than generating one", async () => {
    await upsertUser({ id: AUTH_ID, email: EMAIL, displayName: null });
    expect((await getUserById(AUTH_ID))?.id).toBe(AUTH_ID);
  });
});
