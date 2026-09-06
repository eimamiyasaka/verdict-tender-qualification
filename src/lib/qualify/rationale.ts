/**
 * Rendering for the strings the engine produces.
 *
 * Rationales are stored on `assessment_results` and rendered verbatim by the UI
 * (spec §12.5), so every number a bid manager reads is formatted exactly once,
 * here. Money goes through `toMinorUnits` rather than `toFixed` so a binary64
 * artefact can never reach the screen; dates are read in UTC so the same input
 * renders the same string on every machine.
 *
 * Imports `contracts.ts` and nothing else — spec §6.6.
 */

import {
  DEFAULT_CURRENCY,
  toMinorUnits,
  type FinancialMetric,
  type InsuranceType,
  type Money,
} from '../../../contracts';

export const DAY_MS = 24 * 60 * 60 * 1000;

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

/* --- Dates. UTC throughout: `@db.Date` columns are UTC midnight. --- */

/** `14 Sep 2026`. */
export function formatDate(date: Date): string {
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** `Mar 2025` — the coarser form used inside evidence details. */
export function formatMonth(date: Date): string {
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Whole calendar days from `from` to `to`. Negative when `to` is earlier. */
export function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfUtcDay(to).getTime() - startOfUtcDay(from).getTime()) / DAY_MS);
}

/** Whole months from `from` to `to`, not counting a part month. */
export function monthsBetween(from: Date, to: Date): number {
  const months =
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
  return to.getUTCDate() < from.getUTCDate() ? months - 1 : months;
}

export function subtractMonths(date: Date, months: number): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth() - months,
      date.getUTCDate(),
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds(),
    ),
  );
}

/** `FY2025` — the year ending 31 Mar 2025. */
export function fiscalYear(yearEnding: Date): string {
  return `FY${yearEnding.getUTCFullYear()}`;
}

/** `FY2025 (year ending 31 Mar 2025)` — the evidence label. */
export function fiscalYearLabel(yearEnding: Date): string {
  return `${fiscalYear(yearEnding)} (year ending ${formatDate(yearEnding)})`;
}

/* --- Money. --- */

export function normaliseCurrency(code: string | null | undefined): string {
  return (code ?? DEFAULT_CURRENCY).toUpperCase();
}

function currencyPrefix(code: string): string {
  switch (normaliseCurrency(code)) {
    case 'GBP':
      return '£';
    case 'EUR':
      return '€';
    case 'USD':
      return '$';
    default:
      return `${normaliseCurrency(code)} `;
  }
}

/** `£4,120,000`, and `£1,200.50` when there are pence. */
export function formatMoney(amount: Money, currency: string | null | undefined = DEFAULT_CURRENCY): string {
  const minor = toMinorUnits(amount);
  const units = Math.floor(Math.abs(minor) / 100);
  const pence = Math.abs(minor) % 100;
  const grouped = String(units).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const body = pence === 0 ? grouped : `${grouped}.${String(pence).padStart(2, '0')}`;
  return `${minor < 0 ? '-' : ''}${currencyPrefix(currency ?? DEFAULT_CURRENCY)}${body}`;
}

/** The absolute distance between two money values, in major units. */
export function moneyGap(a: Money, b: Money): Money {
  return Math.abs(toMinorUnits(a) - toMinorUnits(b)) / 100;
}

/* --- Labels. --- */

export const METRIC_LABEL: Record<FinancialMetric, string> = {
  annual_turnover: 'turnover',
  net_assets: 'net assets',
  profit_before_tax: 'profit before tax',
  current_ratio: 'current ratio',
  credit_score: 'credit score',
};

export const INSURANCE_LABEL: Record<InsuranceType, string> = {
  employers_liability: 'employers’ liability',
  public_liability: 'public liability',
  professional_indemnity: 'professional indemnity',
  product_liability: 'product liability',
  cyber: 'cyber',
  contract_works: 'contract works',
  motor_fleet: 'motor fleet',
};

const POLICY_LABEL: Record<string, string> = {
  modern_slavery: 'modern slavery statement',
  equality: 'equality and diversity policy',
  environmental: 'environmental policy',
  health_safety: 'health and safety policy',
  data_protection: 'data protection policy',
};

/** `Policy.policyType` is a free-text column, so an unrecognised value still reads. */
export function policyLabel(policyType: string): string {
  return POLICY_LABEL[policyType] ?? `${humanise(policyType)} policy`;
}

/* --- Prose. --- */

export function humanise(value: string): string {
  return value.replace(/_/g, ' ');
}

export function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function pluralise(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}

/** `a`, `a and b`, `a, b and c`. */
export function listAnd(parts: readonly string[]): string {
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/* --- The clock the validity rules measure against. --- */

export interface ValidityAnchor {
  /** The instant a certificate or policy must still be in force at. */
  at: Date;
  /** How the rationale names it. */
  noun: string;
}

/**
 * Spec §9 measures expiry against the submission deadline. `getSubmissionDeadline`
 * can legitimately return null (spec §7.5), and there is then nothing to measure
 * against but the injected clock — never `new Date()`.
 */
export function validityAnchor(context: {
  asOf: Date;
  submissionDeadline: Date | null;
}): ValidityAnchor {
  return context.submissionDeadline === null
    ? { at: context.asOf, noun: 'today' }
    : { at: context.submissionDeadline, noun: 'the submission deadline' };
}
