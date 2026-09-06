import { createBrowserClient } from "@supabase/ssr";
import { supabaseConfig } from "./supabase-env";

/**
 * The browser flavour, for Client Components.
 *
 * Every auth mutation in Verdict is a Server Action — sign-in must be, because
 * `DEMO_PASSWORD` may not reach the client bundle (§12.2) — so nothing renders
 * against this client today. It exists because the cookie format `@supabase/ssr`
 * writes is only readable from the browser through it: any Client Component that
 * needs the signed-in user must use this, never `createClient` from
 * `supabase-server`, and never a bare `createClient` from `supabase-js`.
 *
 * Memoised because `createBrowserClient` is designed to be a singleton per tab.
 */
let client: ReturnType<typeof createBrowserClient> | undefined;

export function createClient() {
  if (!client) {
    const { url, anonKey } = supabaseConfig();
    client = createBrowserClient(url, anonKey);
  }
  return client;
}
