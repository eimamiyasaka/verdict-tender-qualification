import { describeDeadline, formatDate, monthsBetween, pluralise } from "@/lib/format";
import type { ProfileGap, UsageCount } from "@/lib/types";
import { cn } from "@/lib/utils";

/** One of the five capability sections plus organisation details (§10.3). */
export function ProfileSection({
  id,
  title,
  description,
  count,
  action,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  count?: number;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="flex scroll-mt-20 flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id={`${id}-heading`} className="flex items-baseline gap-2 text-base font-semibold text-ink">
            {title}
            {count !== undefined ? <span className="tabular font-mono text-[12px] font-normal text-ink/50">{count}</span> : null}
          </h2>
          {description ? <p className="mt-1 max-w-2xl text-[13px] text-ink/70">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

/** "used by N requirements across M tenders" — why filling this in is worth it. */
export function UsageText({ usage, className }: { usage: UsageCount; className?: string }) {
  if (usage.requirements === 0) {
    return <span className={cn("text-[12px] text-ink/45", className)}>not read by any requirement yet</span>;
  }
  return (
    <span className={cn("tabular text-[12px] text-ink/60", className)}>
      used by {pluralise(usage.requirements, "requirement")} across {pluralise(usage.tenders, "tender")}
    </span>
  );
}

/** Expiry flagged at 90 days (--pending) and 30 days (--flag) (§10.3). */
export function ExpiryText({ date, now, nullLabel = "Does not expire" }: { date: Date | null; now: Date; nullLabel?: string }) {
  if (!date) return <span className="text-ink/60">{nullLabel}</span>;
  const d = describeDeadline(date, now);
  if (!d) return null;
  if (d.closed) {
    return (
      <span className="font-medium text-flag">
        Expired <span className="font-mono text-[0.92em]">{formatDate(date)}</span>
      </span>
    );
  }
  const tone = d.days <= 30 ? "font-medium text-flag" : d.days <= 90 ? "text-pending" : "text-ink";
  return (
    <span className={tone}>
      <span className="font-mono text-[0.92em]">{formatDate(date)}</span>
      {d.days <= 90 ? <span className="ml-1.5 text-[12px]">({d.days} days)</span> : null}
    </span>
  );
}

/** Policy review age: over 24 months is flagged (§9). */
export function ReviewedText({ date, now }: { date: Date | null; now: Date }) {
  if (!date) return <span className="text-pending">Review date not recorded</span>;
  const months = monthsBetween(date, now);
  return (
    <span className={months > 24 ? "text-pending" : "text-ink"}>
      <span className="font-mono text-[0.92em]">{formatDate(date)}</span>
      <span className="ml-1.5 text-[12px] text-ink/60">({months} months ago)</span>
    </span>
  );
}

/** What requirements ask for that the profile lacks, with a way to add it. */
export function GapList({ gaps, noun, onAddLabel, render }: { gaps: ProfileGap[]; noun: string; onAddLabel: string; render: (gap: ProfileGap) => React.ReactNode }) {
  if (gaps.length === 0) return null;
  return (
    <div className="rounded-sm border border-dashed border-pending/50 px-4 py-3">
      <p className="text-[13px] text-pending">
        Asked for by requirements in your pipeline but not on your profile — {onAddLabel}:
      </p>
      <ul className="mt-2 flex flex-col gap-1.5">
        {gaps.map((gap) => (
          <li key={gap.key} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
            <span className="text-ink">
              {gap.label} <span className="sr-only">{noun}</span>
            </span>
            <span className="flex items-center gap-3">
              <UsageText usage={gap.usage} />
              {render(gap)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
