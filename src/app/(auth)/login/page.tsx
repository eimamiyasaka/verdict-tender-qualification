import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { safeNextPath } from "@/lib/auth/next-path";

export const metadata: Metadata = { title: "Sign in" };

/**
 * Notices raised by a redirect back to /login. Each says what happened and what
 * to do (§11) — never "Something went wrong", and never a raw Supabase string.
 */
const NOTICES: Record<string, string> = {
  demo: "The demo account isn't set up on this deployment. Sign in with an email and password instead, or set DEMO_EMAIL and DEMO_PASSWORD.",
  link: "That sign-in link has expired or has already been used. Enter your email and password below, or open the demo.",
  account:
    "We couldn't finish setting up your account. Try signing in again — if it keeps happening, ask an owner to check your invitation.",
};

/**
 * Centred card, email and password, and a View demo control at least as
 * prominent as the form (§12.2). Most visitors will use the demo.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = params.next ? safeNextPath(params.next) : "/";
  const notice = params.error ? (NOTICES[params.error] ?? null) : null;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-paper px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-mono text-[15px] font-medium tracking-[0.08em] text-ink">Verdict</p>
          <h1 className="mt-4 text-xl font-semibold tracking-tight text-ink">Sign in</h1>
          <p className="mt-1.5 text-sm text-ink/70">Page-cited requirements. A bid / no-bid call you can check.</p>
        </div>
        <div className="rounded-sm border border-rule bg-paper p-6 sm:p-8">
          <LoginForm next={next === "/" ? null : next} notice={notice} />
        </div>
        <p className="mt-6 text-center text-[12px] text-ink/50">
          Text-based PDFs only. Uploaded packs are read in your browser and not stored.
        </p>
      </div>
    </main>
  );
}
