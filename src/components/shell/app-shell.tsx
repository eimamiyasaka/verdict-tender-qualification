import Link from "next/link";
import { resetDemoAction } from "@/lib/actions/demo";
import { signOutAction } from "@/lib/actions/auth";
import type { OrgContext } from "@/lib/types";
import { SidebarNav } from "./sidebar";

function Wordmark() {
  return (
    <Link href="/" className="rounded-sm font-mono text-[15px] font-medium tracking-[0.08em] text-ink">
      Verdict
    </Link>
  );
}

function OrgFooter({ context }: { context: OrgContext }) {
  return (
    <div className="flex flex-col gap-2 text-[13px]">
      <div className="min-w-0">
        <p className="truncate font-medium text-ink" title={context.organisation.name}>
          {context.organisation.name}
        </p>
        <p className="truncate text-ink/60" title={context.user.email}>
          {context.user.displayName ?? context.user.email}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <form action={signOutAction}>
          <button type="submit" className="rounded-sm text-ink/60 underline-offset-4 hover:text-ink hover:underline">
            Sign out
          </button>
        </form>
        <form action={resetDemoAction}>
          <button
            type="submit"
            title="Placeholder data only: discards changes made this session and reloads the seeded demo."
            className="rounded-sm text-ink/60 underline-offset-4 hover:text-ink hover:underline"
          >
            Reset demo
          </button>
        </form>
      </div>
    </div>
  );
}

/**
 * App shell (§12.1): slim left sidebar, content column max 1100px centred.
 * Under md the sidebar becomes a top bar so the pipeline and assessment
 * screens stay readable at 380px (§12.7).
 */
export function AppShell({ context, children }: { context: OrgContext; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-paper text-ink md:flex">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-sm focus:bg-ink focus:px-3 focus:py-2 focus:text-sm focus:text-paper"
      >
        Skip to content
      </a>

      {/* Sidebar — md and up */}
      <aside className="hidden w-52 shrink-0 border-r border-rule md:flex md:flex-col">
        <div className="sticky top-0 flex h-dvh flex-col justify-between px-5 pt-6 pb-14">
          <div className="flex flex-col gap-8">
            <Wordmark />
            <SidebarNav orientation="vertical" />
          </div>
          <OrgFooter context={context} />
        </div>
      </aside>

      {/* Top bar — below md */}
      <header className="sticky top-0 z-30 border-b border-rule bg-paper md:hidden">
        <div className="flex h-12 items-center justify-between px-4">
          <Wordmark />
          <SidebarNav orientation="horizontal" />
        </div>
      </header>

      <div className="min-w-0 flex-1">
        <main id="main" className="mx-auto w-full max-w-content px-4 py-8 sm:px-6 sm:py-10 lg:px-10">
          {children}
        </main>
        <footer className="mx-auto w-full max-w-content px-4 pb-8 sm:px-6 lg:px-10 md:hidden">
          <OrgFooter context={context} />
        </footer>
      </div>
    </div>
  );
}
