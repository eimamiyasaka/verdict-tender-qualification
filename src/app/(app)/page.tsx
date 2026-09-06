import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/common/layout";
import { TenderCard } from "@/components/pipeline/tender-card";
import { Button } from "@/components/ui/button";
import { getOrgContext } from "@/lib/auth/session";
import { listPipeline } from "@/lib/db/tenders";
import { daysUntil, pluralise } from "@/lib/format";

const OPEN_STATUSES = new Set(["draft", "extracting", "extraction_failed", "extracted", "assessed", "bidding"]);

/**
 * Pipeline (§10.1, §12.3). Sorted by submission deadline ascending, one
 * query with the latest assessment included. Verdict is the leading visual
 * element on every row. The header strip is three counts as plain text.
 */
export default async function PipelinePage() {
  const { orgId } = await getOrgContext();
  const rows = await listPipeline(orgId);
  const now = new Date();

  const open = rows.filter((r) => OPEN_STATUSES.has(r.tender.status));
  const closingSoon = open.filter((r) => {
    if (!r.submissionDeadline) return false;
    const days = daysUntil(r.submissionDeadline, now);
    return days >= 0 && days <= 7;
  });
  const needReview = open.filter((r) => r.latestAssessment?.recommendation === "review");

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Pipeline"
        actions={
          <Button asChild>
            <Link href="/tenders/new">+ Add tender</Link>
          </Button>
        }
      />

      {rows.length > 0 ? (
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm text-ink/80">
          <span className="tabular">{pluralise(open.length, "open tender")}</span>
          <span aria-hidden className="font-mono text-ink/40">·</span>
          <span className={closingSoon.length > 0 ? "tabular text-flag" : "tabular"}>
            {closingSoon.length} closing this week
          </span>
          <span aria-hidden className="font-mono text-ink/40">·</span>
          <span className={needReview.length > 0 ? "tabular text-pending" : "tabular"}>
            {needReview.length} {needReview.length === 1 ? "needs" : "need"} review
          </span>
        </p>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState
          title="No tenders yet."
          body="Upload a pack to get your first verdict. Verdict reads the PSQ and ITT, cites every requirement to a page, and tells you whether you can bid."
          action={
            <Button asChild>
              <Link href="/tenders/new">Add your first tender</Link>
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3" aria-label="Tenders by submission deadline">
          {rows.map((row) => (
            <TenderCard key={row.tender.id} row={row} now={now} />
          ))}
        </ul>
      )}
    </div>
  );
}
