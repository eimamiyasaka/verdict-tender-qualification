import type * as React from "react";
import { cn } from "@/lib/utils";
import { formatDate, formatDateTime, formatMoney, formatMoneyAbbrev } from "@/lib/format";
import { RECOMMENDATION_WORD, VERDICT_LABEL } from "@/lib/labels";
import type { BidRecommendation, Verdict } from "@/lib/types";

/** Citation text: mono, ~0.85em, ink at 60% (§11). */
export function Cite({ className, ...props }: React.ComponentProps<"span">) {
  return <span className={cn("cite", className)} {...props} />;
}

/** `PSQ.pdf · p.31 · §4.2.1` — the structural anchor from the source document. */
export function SourceRef({
  filename,
  pageNumber,
  clauseReference,
  className,
}: {
  filename: string;
  pageNumber: number;
  clauseReference?: string | null;
  className?: string;
}) {
  return (
    <Cite className={cn("whitespace-nowrap", className)}>
      {filename}
      <span aria-hidden> · </span>
      <span className="sr-only">, page </span>p.{pageNumber}
      {clauseReference ? (
        <>
          <span aria-hidden> · </span>
          <span className="sr-only">, clause </span>
          {clauseReference}
        </>
      ) : null}
    </Cite>
  );
}

export function Money({
  amount,
  currency,
  abbrev = false,
  className,
}: {
  amount: number | null | undefined;
  currency?: string | null;
  abbrev?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("tabular", className)}>
      {abbrev ? formatMoneyAbbrev(amount, currency) : formatMoney(amount, currency)}
    </span>
  );
}

/** Dates are citations too: mono face, tabular figures. */
export function DateMono({
  date,
  withTime = false,
  className,
}: {
  date: Date | string | null | undefined;
  withTime?: boolean;
  className?: string;
}) {
  const d = date ? (typeof date === "string" ? new Date(date) : date) : null;
  return (
    <time dateTime={d ? d.toISOString() : undefined} className={cn("font-mono tabular text-[0.92em]", className)}>
      {withTime ? formatDateTime(d) : formatDate(d)}
    </time>
  );
}

const RECOMMENDATION_TONE: Record<BidRecommendation, string> = {
  no_bid: "text-flag",
  review: "text-pending",
  bid: "text-ink",
};

/**
 * The verdict word (§12.3, §12.4). `NO BID` in --flag, `REVIEW` in --pending,
 * `BID` in --ink. On the ink verdict block it is set in --paper for contrast.
 */
export function VerdictWord({
  recommendation,
  onInk = false,
  className,
}: {
  recommendation: BidRecommendation | null;
  onInk?: boolean;
  className?: string;
}) {
  if (!recommendation) {
    return <span className={cn("verdict-word text-ink/50", className)}>Not assessed</span>;
  }
  return (
    <span className={cn("verdict-word", onInk ? "text-paper" : RECOMMENDATION_TONE[recommendation], className)}>
      {RECOMMENDATION_WORD[recommendation]}
    </span>
  );
}

/**
 * Per-requirement verdict. Only problems are coloured: fail in --flag, unknown
 * in --pending. A pass is ink on paper with no mark at all (§11).
 */
export function VerdictMark({ verdict, className }: { verdict: Verdict; className?: string }) {
  const glyph = verdict === "fail" ? "✕" : verdict === "unknown" ? "?" : null;
  const tone =
    verdict === "fail" ? "text-flag" : verdict === "unknown" ? "text-pending" : verdict === "not_applicable" ? "text-ink/50" : "text-ink";
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap font-mono text-[13px]", tone, className)}>
      {glyph ? (
        <span aria-hidden className="inline-block w-3 text-center font-medium">
          {glyph}
        </span>
      ) : null}
      <span>{verdict === "not_applicable" ? "n/a" : VERDICT_LABEL[verdict]}</span>
    </span>
  );
}

/** BLOCKING · NEEDS AN ANSWER FROM YOU — mono, uppercase, spaced (§12.5). */
export function SectionLabel({
  tone = "ink",
  className,
  ...props
}: React.ComponentProps<"h3"> & { tone?: "ink" | "flag" | "pending" | "muted" }) {
  const toneClass = { ink: "text-ink", flag: "text-flag", pending: "text-pending", muted: "text-ink/60" }[tone];
  return <h3 className={cn("section-label", toneClass, className)} {...props} />;
}

/** Mono chip for tags and small structural facts (Lot 2, 48 pages). */
export function Chip({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border border-rule px-1.5 py-px font-mono text-[11px] leading-5 text-ink/70",
        className,
      )}
      {...props}
    />
  );
}
