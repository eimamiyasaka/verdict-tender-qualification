import "server-only";
import { createClient } from "./supabase-server";

/**
 * Ends the Supabase session and clears the auth cookies. Called by
 * `signOutAction`, which redirects to /login afterwards; middleware then keeps
 * the visitor there.
 */
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
