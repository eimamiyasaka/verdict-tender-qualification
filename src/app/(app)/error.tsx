"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Errors say what happened and what to do (§12.7). Never "Something went wrong". */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg py-16">
      <p className="font-mono text-[12px] tracking-wide text-flag uppercase">This page could not be loaded</p>
      <h1 className="mt-2 text-lg font-semibold text-ink">{error.message || "The data for this page did not come back."}</h1>
      <p className="mt-2 text-sm text-ink/70">
        Nothing you entered has been lost. Try loading the page again; if it fails twice, sign out and back in.
      </p>
      {error.digest ? <p className="mt-3 font-mono text-[12px] text-ink/50">ref {error.digest}</p> : null}
      <div className="mt-6 flex gap-2">
        <Button onClick={() => reset()}>Try again</Button>
        <Button variant="outline" asChild>
          <Link href="/">Go to the pipeline</Link>
        </Button>
      </div>
    </div>
  );
}
