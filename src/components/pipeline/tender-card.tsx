import Link from "next/link";
import { DeadlineText } from "@/components/common/deadline";
import { Money, VerdictWord } from "@/components/common/typography";
import { formatDuration, pluralise } from "@/lib/format";
import { TENDER_STATUS_LABEL } from "@/lib/labels";
import type { PipelineRow } from "@/lib/types";

/**
 * One bordered card per tender (§12.3). Verdict word first, vertically
 * centred against two lines: title + problem statement, then metadata +
 * deadline. Hover changes the border to --ink and nothing else.
 */
export function summaryLine(row: PipelineRow): string {
  const a = row.latestAssessment;
  if (!a) {
    switch (row.tender.status) {
      case "draft":
        return "No documents yet";
      case "extracting":
        return "Extracting requirements";
      case "extraction_failed":
        return "Extraction failed";
      case "extracted":
        return "Ready to assess";
      default:
        return TENDER_STATUS_LABEL[row.tender.status];
    }
  }
  if (a.recommendation === "no_bid") return pluralise(a.mandatoryFailed, "mandatory failure");
  if (a.recommendation === "review") return pluralise(a.mandatoryUnknown, "unknown");
  return "all gates clear";
}

export function TenderCard({ row, now }: { row: PipelineRow; now: Date }) {
  const { tender, latestAssessment } = row;
  const summary = summaryLine(row);
  const problem = latestAssessment?.recommendation === "no_bid" || latestAssessment?.recommendation === "review";
  const isBidding = tender.status === "bidding";

  return (
    <li>
      <Link
        href={`/tenders/${tender.id}`}
        className="group grid grid-cols-1 gap-x-6 gap-y-3 rounded-sm border border-rule bg-paper px-4 py-4 transition-colors hover:border-ink sm:grid-cols-[7.5rem_1fr] sm:px-5 sm:py-5"
        aria-label={`${tender.title}: ${latestAssessment ? latestAssessment.recommendation.replace("_", " ") : "not assessed"}, ${summary}`}
      >
        <div className="flex items-center sm:min-h-12">
          <VerdictWord recommendation={latestAssessment?.recommendation ?? null} className="text-[13px] sm:text-sm" />
        </div>

        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="min-w-0 text-[15px] font-medium text-ink sm:text-base">{tender.title}</h2>
            <span className={problem ? (latestAssessment?.recommendation === "no_bid" ? "text-flag" : "text-pending") : "text-ink/70"}>
              <span className="text-sm">{summary}</span>
            </span>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm text-ink/70">
            <p className="flex flex-wrap items-baseline gap-x-2">
              <Money amount={tender.contractValue} currency={tender.currency} abbrev />
              {tender.lotReference ? (
                <>
                  <span aria-hidden className="font-mono text-ink/40">·</span>
                  <span>{tender.lotReference}</span>
                </>
              ) : tender.durationMonths ? (
                <>
                  <span aria-hidden className="font-mono text-ink/40">·</span>
                  <span>{formatDuration(tender.durationMonths)}</span>
                </>
              ) : null}
              <span aria-hidden className="font-mono text-ink/40">·</span>
              <span>{pluralise(row.requirementCount, "requirement")}</span>
              {isBidding ? (
                <>
                  <span aria-hidden className="font-mono text-ink/40">·</span>
                  <span className="font-mono text-[12px] tracking-wide uppercase">bidding</span>
                </>
              ) : null}
            </p>
            <DeadlineText date={row.submissionDeadline} now={now} className="text-sm" />
          </div>
        </div>
      </Link>
    </li>
  );
}

export function TenderCardSkeleton() {
  return (
    <li className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-sm border border-rule px-4 py-4 sm:grid-cols-[7.5rem_1fr] sm:px-5 sm:py-5">
      <div className="flex items-center sm:min-h-12">
        <div className="h-3.5 w-16 rounded-sm bg-rule/60" />
      </div>
      <div className="flex flex-col gap-3">
        <div className="flex justify-between gap-4">
          <div className="h-4 w-2/3 rounded-sm bg-rule/60" />
          <div className="h-4 w-28 rounded-sm bg-rule/60" />
        </div>
        <div className="flex justify-between gap-4">
          <div className="h-3.5 w-1/2 rounded-sm bg-rule/60" />
          <div className="h-3.5 w-24 rounded-sm bg-rule/60" />
        </div>
      </div>
    </li>
  );
}
