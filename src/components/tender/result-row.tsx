"use client";

import Link from "next/link";
import { SourceLink, ViewSourceButton } from "@/components/tender/citation-drawer";
import { VerdictMark } from "@/components/common/typography";
import type { AssessmentResult, RequirementKind, RequirementWithSources } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Where on the profile a given requirement kind is resolved. */
export function profileAnchor(kind: RequirementKind): string {
  switch (kind) {
    case "certification":
      return "/profile#credentials";
    case "financial":
      return "/profile#financial-years";
    case "insurance":
      return "/profile#insurance";
    case "experience":
      return "/profile#past-projects";
    case "policy":
      return "/profile#policies";
    default:
      return "/profile";
  }
}

/**
 * One result (§12.5). Line 1: requirement summary. Line 2: the stored
 * rationale, verbatim — never rewritten, truncated or re-derived. Line 3:
 * document, page and clause in mono, with [view]. Unknowns add
 * "Add to profile". Passing rows carry no colour and no mark.
 */
export function ResultRow({
  requirement,
  result,
  showMark = true,
  className,
}: {
  requirement: RequirementWithSources;
  result: AssessmentResult;
  showMark?: boolean;
  className?: string;
}) {
  const verdict = result.verdict;
  const tone = verdict === "fail" ? "text-flag" : verdict === "unknown" ? "text-pending" : "text-ink";
  const glyph = verdict === "fail" ? "✕" : verdict === "unknown" ? "?" : null;

  return (
    <li className={cn("grid grid-cols-[1.25rem_1fr] gap-x-2 px-4 py-4 sm:px-5", className)}>
      <div aria-hidden className={cn("pt-px text-center font-mono text-[15px] font-medium leading-6", tone)}>
        {showMark ? glyph : null}
      </div>
      <div className="min-w-0">
        <p className="text-[15px] leading-6 font-medium text-ink">
          <span className="sr-only">{verdict === "fail" ? "Fail: " : verdict === "unknown" ? "Unknown: " : ""}</span>
          {requirement.summary}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-ink/80">{result.rationale}</p>
        {result.warning ? <p className="mt-1 text-sm leading-relaxed text-pending">{result.warning}</p> : null}
        {result.overrideNote ? (
          <p className="mt-1 text-sm leading-relaxed text-ink/70">
            <span className="font-mono text-[12px] tracking-wide uppercase">Overridden</span> — {result.overrideNote}
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <SourceLink requirement={requirement} />
          <ViewSourceButton requirement={requirement} />
          {requirement.citations.length > 0 ? (
            <span className="font-mono text-[12px] text-ink/50">
              +{requirement.citations.length} {requirement.citations.length === 1 ? "citation" : "citations"}
            </span>
          ) : null}
          {verdict === "unknown" ? (
            <Link
              href={profileAnchor(requirement.kind)}
              className="rounded-sm font-mono text-[12px] text-pending underline-offset-4 hover:underline"
            >
              [add to profile]
            </Link>
          ) : null}
          {verdict === "fail" && (requirement.kind === "certification" || requirement.kind === "policy") ? (
            <Link
              href={profileAnchor(requirement.kind)}
              className="rounded-sm font-mono text-[12px] text-ink/60 underline-offset-4 hover:text-ink hover:underline"
            >
              [profile]
            </Link>
          ) : null}
        </div>
        {result.evidence.length > 0 && requirement.kind === "experience" ? (
          <details className="mt-2 group">
            <summary className="cursor-pointer list-none rounded-sm font-mono text-[12px] text-ink/60 hover:text-ink">
              <span aria-hidden className="inline-block w-3 transition-transform group-open:rotate-90">▸</span> Which projects counted
            </summary>
            <ul className="mt-2 flex flex-col gap-1 border-l border-rule pl-3 text-[13px]">
              {result.evidence.map((e) => (
                <li key={e.id} className={cn("flex flex-col", e.matched ? "text-ink" : "text-ink/55")}>
                  <span>
                    <span className="mr-1.5 inline-block w-3 text-center font-mono" aria-hidden>
                      {e.matched ? "✓" : "–"}
                    </span>
                    <span className="sr-only">{e.matched ? "Counted: " : "Did not count: "}</span>
                    {e.label}
                  </span>
                  {e.note ? <span className="pl-[1.35rem] text-[12px]">{e.note}</span> : null}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </li>
  );
}

/** Compact row for collapsed groups: verdict mark + summary + source. */
export function CompactResultRow({ requirement, result }: { requirement: RequirementWithSources; result: AssessmentResult }) {
  return (
    <li className="grid grid-cols-1 gap-x-4 gap-y-1 px-4 py-3 sm:grid-cols-[6.5rem_1fr_auto] sm:items-baseline sm:px-5">
      <VerdictMark verdict={result.verdict} />
      <div className="min-w-0">
        <p className="text-sm text-ink">{requirement.summary}</p>
        <p className="mt-0.5 text-[13px] text-ink/70">{result.rationale}</p>
        {result.warning ? <p className="mt-0.5 text-[13px] text-pending">{result.warning}</p> : null}
      </div>
      <div className="flex items-center gap-2 sm:justify-end">
        <SourceLink requirement={requirement} />
        <ViewSourceButton requirement={requirement} />
      </div>
    </li>
  );
}
