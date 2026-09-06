import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-paper px-4">
      <div className="max-w-sm text-center">
        <p className="font-mono text-[12px] tracking-wide text-ink/50 uppercase">404</p>
        <h1 className="mt-2 text-lg font-semibold text-ink">There&apos;s nothing at this address.</h1>
        <p className="mt-2 text-sm text-ink/70">
          The tender may have been removed, or the link was copied incompletely. The pipeline lists everything you have.
        </p>
        <Link href="/" className="mt-5 inline-block rounded-sm text-sm text-ink underline underline-offset-4">
          Go to the pipeline
        </Link>
      </div>
    </main>
  );
}
