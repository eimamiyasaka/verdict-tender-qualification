/**
 * The two public Supabase values, read in one place and checked once.
 *
 * Supabase is the identity provider and nothing else (§6): no application row
 * is ever read through a Supabase client. Both values are `NEXT_PUBLIC_` by
 * design — the anon key is a publishable project identifier, not a secret, and
 * the browser client needs it. `DEMO_EMAIL` and `DEMO_PASSWORD` deliberately
 * are not public, and are read only on the server in `signInDemo()`.
 */
export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export function supabaseConfig(): SupabaseConfig {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Supabase isn't configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env — see .env.example.",
    );
  }
  return { url, anonKey };
}
