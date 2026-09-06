/**
 * Formatting helpers. Pure, no React, unit-tested.
 *
 * Money is abbreviated on the pipeline (£2.4m, £780k) and shown in full
 * everywhere else, always with tabular figures (§11).
 */

const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: "£",
  EUR: "€",
  USD: "$",
};

export function currencySymbol(currency: string | null | undefined): string {
  const code = (currency ?? "GBP").toUpperCase();
  return CURRENCY_SYMBOLS[code] ?? `${code} `;
}

/** £2.4m · £780k · £850 */
export function formatMoneyAbbrev(amount: number | null | undefined, currency?: string | null): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return "—";
  const symbol = currencySymbol(currency);
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  if (abs >= 1_000_000) {
    const m = abs / 1_000_000;
    const text = m >= 100 ? m.toFixed(0) : m.toFixed(1).replace(/\.0$/, "");
    return `${sign}${symbol}${text}m`;
  }
  if (abs >= 1_000) {
    return `${sign}${symbol}${Math.round(abs / 1_000)}k`;
  }
  return `${sign}${symbol}${Math.round(abs)}`;
}

/** £4,120,000 */
export function formatMoney(amount: number | null | undefined, currency?: string | null): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return "—";
  const code = (currency ?? "GBP").toUpperCase();
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: code,
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${code} ${Math.round(amount).toLocaleString("en-GB")}`;
  }
}

/** 14 Sep 2026 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(d).replace(/\bSept\b/, "Sep");
}

/** 24 Aug 2026, 14:32 */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(d)
    .replace(/\bSept\b/, "Sep");
}

/** YYYY-MM-DD for <input type="date">. */
export function toDateInputValue(date: Date | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parses YYYY-MM-DD from a date input as a local-midnight Date; empty → null. */
export function fromDateInputValue(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

const DAY_MS = 86_400_000;

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Whole days from `now` to `date`, comparing calendar days, negative when past. */
export function daysUntil(date: Date, now: Date = new Date()): number {
  return Math.round((startOfDay(date).getTime() - startOfDay(now).getTime()) / DAY_MS);
}

export interface DeadlineDescription {
  /** "Closes in 11 days", "Closes today", "Closed 3 days ago" */
  label: string;
  /** Short form for tight spaces: "11 days", "today", "closed" */
  short: string;
  days: number;
  /** Inside 7 days and not yet past (§10.1) */
  urgent: boolean;
  closed: boolean;
}

export function describeDeadline(
  date: Date | null | undefined,
  now: Date = new Date(),
): DeadlineDescription | null {
  if (!date) return null;
  const days = daysUntil(date, now);
  if (days < 0) {
    const ago = Math.abs(days);
    return {
      label: ago === 1 ? "Closed yesterday" : `Closed ${ago} days ago`,
      short: "closed",
      days,
      urgent: false,
      closed: true,
    };
  }
  if (days === 0) return { label: "Closes today", short: "today", days, urgent: true, closed: false };
  if (days === 1) return { label: "Closes tomorrow", short: "1 day", days, urgent: true, closed: false };
  return {
    label: `Closes in ${days} days`,
    short: `${days} days`,
    days,
    urgent: days <= 7,
    closed: false,
  };
}

/** Months between two dates, rounded, for "31 months ago" style copy. */
export function monthsBetween(from: Date, to: Date = new Date()): number {
  const years = to.getFullYear() - from.getFullYear();
  const months = to.getMonth() - from.getMonth();
  const dayAdjust = to.getDate() < from.getDate() ? -1 : 0;
  return years * 12 + months + dayAdjust;
}

export function formatDuration(months: number | null | undefined): string {
  if (!months) return "—";
  return `${months} months`;
}

export function pluralise(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** "FY2025" from a year-ending date. */
export function fiscalYearLabel(yearEnding: Date): string {
  return `FY${yearEnding.getFullYear()}`;
}

/** Percentage with no decimals: 72 → "72%" */
export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${Math.round(value)}%`;
}

/** 20 MB → "20 MB", 1536 → "1.5 KB" */
export function formatBytes(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1).replace(/\.0$/, "")} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1).replace(/\.0$/, "")} KB`;
  return `${bytes} B`;
}

/** Humanise a snake_case token when no label is defined: "modern_slavery" → "Modern slavery". */
export function humanise(token: string): string {
  const spaced = token.replace(/_/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
