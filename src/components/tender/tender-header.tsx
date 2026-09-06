import Link from "next/link";
import { BackLink } from "@/components/common/layout";
import { Cite, DateMono, Money } from "@/components/common/typography";
import { describeDeadline, formatDuration } from "@/lib/format";
import { TENDER_STATUS_LABEL } from "@/lib/labels";
import type { TenderDetail } from "@/lib/types";
import { cn } from "@/lib/utils";
import { StatusControls } from "./status-controls";

export type TenderTab = "assessment" | "requirements" | "workspace" | "documents";

const TABS: Array<{ key: TenderTab; label: string }> = [
  { key: "assessment", label: "Assessment" },
  { key: "requirements", label: "Requirements" },
  { key: "workspace", label: "Workspace" },
  { key: "documents", label: "Documents" },
];

export function parseTab(value: string | undefined): TenderTab {
  return TABS.some((t) => t.key === value) ? (value as TenderTab) : "assessment";
}

/**
 * Header (§10.2): back link, title, metadata line with value, duration,
 * submission and clarification deadlines in the mono face. Four tabs via
 * ?tab=. A tender past its deadline carries a Closed marker (§14).
 */
export function TenderHeader({ detail, tab, now }: { detail: TenderDetail; tab: TenderTab; now: Date }) {
  const { tender } = detail;
  const deadline = describeDeadline(detail.submissionDeadline, now);
  const clarification = describeDeadline(detail.clarificationDeadline, now);
  const closed = deadline?.closed ?? false;

  return (
    <header className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <BackLink href="/">Pipeline</BackLink>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-[22px] leading-tight font-semibold tracking-[-0.01em] text-ink sm:text-2xl">{tender.title}</h1>
            {tender.buyerName || tender.noticeReference ? (
              <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2 text-sm text-ink/70">
                {tender.buyerName ? <span>{tender.buyerName}</span> : null}
                {tender.noticeReference ? (
                  <>
                    {tender.buyerName ? <span aria-hidden className="font-mono text-ink/40">·</span> : null}
                    {tender.sourceUrl ? (
                      <a href={tender.sourceUrl} target="_blank" rel="noopener noreferrer" className="rounded-sm hover:underline">
                        <Cite>{tender.noticeReference}</Cite>
                      </a>
                    ) : (
                      <Cite>{tender.noticeReference}</Cite>
                    )}
                  </>
                ) : null}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {closed ? (
              <span className="inline-flex h-8 items-center rounded-sm border border-rule px-2.5 font-mono text-[12px] tracking-wide text-ink/70 uppercase">
                Closed
              </span>
            ) : null}
            <span className="inline-flex h-8 items-center rounded-sm border border-rule px-2.5 font-mono text-[12px] tracking-wide text-ink/70 uppercase">
              {TENDER_STATUS_LABEL[tender.status]}
            </span>
            <StatusControls
              tenderId={tender.id}
              status={tender.status}
              closed={closed}
              hasAssessment={Boolean(detail.latestAssessment)}
              recommendation={detail.latestAssessment?.recommendation ?? null}
            />
          </div>
        </div>
      </div>

      <dl className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm text-ink/80 [&>div:last-child>span]:hidden">
        <MetaItem label="Contract value">
          <Money amount={tender.contractValue} currency={tender.currency} abbrev />
        </MetaItem>
        {tender.durationMonths ? (
          <MetaItem label="Duration">{formatDuration(tender.durationMonths)}</MetaItem>
        ) : null}
        {tender.lotReference ? <MetaItem label="Lot">{tender.lotReference}</MetaItem> : null}
        <MetaItem label="Submission deadline">
          {detail.submissionDeadline ? (
            <span className={cn(deadline?.urgent && "text-flag", deadline?.closed && "text-ink/60")}>
              {deadline?.closed ? "Closed" : "Closes"} <DateMono date={detail.submissionDeadline} />
              {deadline && !deadline.closed ? <span className="text-ink/60"> ({deadline.short})</span> : null}
            </span>
          ) : (
            <span className="text-ink/50">No deadline recorded</span>
          )}
        </MetaItem>
        {detail.clarificationDeadline ? (
          <MetaItem label="Clarification deadline">
            <span className={cn(clarification?.closed && "text-ink/60")}>
              Clarifications {clarification?.closed ? "closed" : "by"} <DateMono date={detail.clarificationDeadline} />
            </span>
          </MetaItem>
        ) : null}
      </dl>

      <nav aria-label="Tender sections" className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1 border-b border-rule">
        <ul className="-mb-px flex max-w-full gap-1 overflow-x-auto sm:gap-2">
          {TABS.map((t) => {
            const active = t.key === tab;
            return (
              <li key={t.key}>
                <Link
                  href={`/tenders/${tender.id}?tab=${t.key}`}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex h-10 items-center border-b-2 px-2 text-sm whitespace-nowrap transition-colors sm:px-3",
                    active ? "border-ink font-medium text-ink" : "border-transparent text-ink/60 hover:text-ink",
                  )}
                >
                  {t.label}
                </Link>
              </li>
            );
          })}
        </ul>
        <Link href={`/tenders/${tender.id}/audit`} className="mb-2 ml-auto shrink-0 rounded-sm font-mono text-[12px] text-ink/60 hover:text-ink hover:underline">
          Activity log
        </Link>
      </nav>
    </header>
  );
}

function MetaItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="sr-only">{label}</dt>
      <dd className="tabular">{children}</dd>
      <span aria-hidden className="font-mono text-ink/40">
        ·
      </span>
    </div>
  );
}
