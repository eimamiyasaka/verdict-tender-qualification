"use client";

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-paper px-4">
      <div className="max-w-md">
        <p className="font-mono text-[12px] tracking-wide text-flag uppercase">Verdict could not start this page</p>
        <h1 className="mt-2 text-lg font-semibold text-ink">{error.message || "The application hit an error before it could render."}</h1>
        <p className="mt-2 text-sm text-ink/70">Reload to try again. If it keeps happening, the server log has the detail.</p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-5 inline-flex h-9 items-center rounded-sm border border-ink bg-ink px-3.5 text-sm font-medium text-paper hover:bg-ink/85"
        >
          Reload
        </button>
      </div>
    </main>
  );
}
