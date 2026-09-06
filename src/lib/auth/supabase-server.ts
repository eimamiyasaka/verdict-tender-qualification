import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseConfig } from "./supabase-env";

/**
 * The server flavour: Server Components, Server Actions and Route Handlers.
 * Session state lives in cookies, so a fresh client is built per request —
 * never cache or hoist this to module scope.
 *
 * Identity only (§6). This client authenticates; it never reads application
 * data. Every such read goes through `src/lib/db/`.
 */
export async function createClient() {
  const store = await cookies();
  const { url, anonKey } = supabaseConfig();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            store.set(name, value, options);
          }
        } catch {
          // Server Components get a read-only cookie store. Writing a refreshed
          // session from one throws, and that is fine: the middleware refreshes
          // on every request, so the cookie is already current by the time a
          // Server Component runs.
        }
      },
    },
  });
}
