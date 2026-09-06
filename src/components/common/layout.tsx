import type * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Cards: 1px --rule border, 2px radius, no shadow (§11). */
export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("rounded-sm border border-rule bg-paper", className)} {...props} />;
}

/** A row inside a card; hairline between rows. */
export function CardRow({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("border-b border-rule last:border-b-0", className)} {...props} />;
}

export function Hairline({ className, ...props }: React.ComponentProps<"hr">) {
  return <hr className={cn("border-0 border-t border-rule", className)} {...props} />;
}

export function PageHeader({
  title,
  eyebrow,
  description,
  actions,
  className,
}: {
  title: React.ReactNode;
  eyebrow?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow ? <div className="mb-2">{eyebrow}</div> : null}
        <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-ink sm:text-2xl">{title}</h1>
        {description ? <p className="mt-1.5 max-w-2xl text-sm text-ink/70">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/** Empty states are invitations (§11): what to do next, in one sentence, with a way to do it. */
export function EmptyState({
  title,
  body,
  action,
  className,
}: {
  title: string;
  body?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-sm border border-dashed border-rule px-6 py-10 text-center", className)}>
      <p className="text-sm font-medium text-ink">{title}</p>
      {body ? <p className="mx-auto mt-1 max-w-md text-sm text-ink/70">{body}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-sm text-sm text-ink/70 hover:text-ink"
    >
      <span aria-hidden>←</span>
      {children}
    </Link>
  );
}

/** A definition-style key/value pair for metadata lines and drawers. */
export function Meta({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <dt className="text-[11px] font-medium tracking-wide text-ink/55 uppercase">{label}</dt>
      <dd className="text-sm text-ink">{children}</dd>
    </div>
  );
}

/** Content column: max 1100px, centred (§12.1). */
export function ContentColumn({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("mx-auto w-full max-w-content px-4 sm:px-6 lg:px-8", className)} {...props} />;
}
