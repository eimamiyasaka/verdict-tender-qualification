import { describeDeadline, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * "Closes in 11 days" — under 7 days it is --flag regardless of verdict
 * (§10.1). Past deadlines read "Closed 3 days ago".
 */
export function DeadlineText({
  date,
  now,
  showDate = false,
  className,
}: {
  date: Date | null;
  now?: Date;
  showDate?: boolean;
  className?: string;
}) {
  const d = describeDeadline(date, now);
  if (!d) return <span className={cn("text-ink/50", className)}>No deadline set</span>;
  return (
    <span className={cn("tabular whitespace-nowrap", d.urgent ? "font-medium text-flag" : d.closed ? "text-ink/60" : "text-ink", className)}>
      {d.label}
      {showDate && date ? <span className="font-mono text-[0.9em] text-ink/60"> · {formatDate(date)}</span> : null}
    </span>
  );
}
