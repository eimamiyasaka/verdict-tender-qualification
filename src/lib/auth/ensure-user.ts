import "server-only";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { upsertUser } from "@/lib/db/users";
import { createClient } from "./supabase-server";

/**
 * Creates or refreshes the public `users` mirror row for the signed-in Supabase
 * user (§7.3).
 *
 * Prisma cannot own Supabase's `auth.users`, so the public schema keeps a mirror
 * whose id EQUALS the Supabase auth user id — supplied on insert, never
 * generated. This is the only place that row is written apart from the seed, and
 * it is called from one place: the post-sign-in callback.
 *
 * There is no Prisma here on purpose. §7.3 puts this function in src/lib/auth/
 * and §6.3 forbids a data call outside src/lib/db/, so it reads the session and
 * hands the write to the data layer, which owns the query.
 *
 * Returns the mirror row's id, or null when nobody is signed in.
 */
export async function ensureUser(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Email is the mirror row's unique key. Supabase can in principle issue a
  // phone-only identity; Verdict has no sign-in path that produces one, and a
  // row without an address would be unreachable, so it gets no mirror.
  if (!user?.email) return null;

  await upsertUser({
    id: user.id,
    email: user.email,
    displayName: displayName(user),
  });

  return user.id;
}

/** Whatever the provider offered as a human name, or null. Never the email. */
function displayName(user: SupabaseUser): string | null {
  const metadata = user.user_metadata ?? {};
  for (const key of ["display_name", "full_name", "name"]) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim() !== "") return value.trim();
  }
  return null;
}
