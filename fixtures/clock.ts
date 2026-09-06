/**
 * The demo clock.
 *
 * Every date in `fixtures/` is absolute and anchored to `DEMO_ASOF`. Nothing is
 * computed from `new Date()` at module load, so a fixture imported into a test
 * produces the same value in June as it does in December.
 *
 * The relative distances are what carry the demo (spec §10.1): the NHS tender
 * closes in 11 days, Camden in 4, Leeds in 19; the CHAS certificate expires 21 days
 * after the NHS deadline; the modern slavery statement was reviewed 31 months ago.
 * `demoOffsetDays()` + `shift()` let the seed slide the whole set forward so those
 * distances still hold on the day a reviewer opens the URL.
 */

/** The instant every fixture date is measured from. */
export const DEMO_ASOF = new Date('2026-09-03T09:00:00.000Z');

export const DAY_MS = 24 * 60 * 60 * 1000;

/** A date with no time component — `@db.Date` columns. */
export function d(iso: string): Date {
  return new Date(iso + 'T00:00:00.000Z');
}

/** An instant — `DateTime` (timestamptz) columns. */
export function t(iso: string): Date {
  return new Date(iso);
}

export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * Whole days between `DEMO_ASOF` and `now`. The seed adds this to every fixture
 * date so the pipeline still reads "Closes in 11 days" whenever it is run.
 * Pass 0 to seed the fixtures exactly as written.
 */
export function demoOffsetDays(now: Date = new Date()): number {
  return Math.round(
    (startOfUtcDay(now).getTime() - startOfUtcDay(DEMO_ASOF).getTime()) / DAY_MS,
  );
}

export function shift(date: Date, days: number): Date;
export function shift(date: null, days: number): null;
export function shift(date: Date | null, days: number): Date | null;
export function shift(date: Date | null, days: number): Date | null {
  if (date === null) return null;
  if (days === 0) return date;
  return new Date(date.getTime() + days * DAY_MS);
}

/** Whole days from `DEMO_ASOF` to `date`, rounded down. Used by the fixture docs. */
export function daysFromAsOf(date: Date): number {
  return Math.floor((date.getTime() - DEMO_ASOF.getTime()) / DAY_MS);
}

/* --- The three submission deadlines, as spec §10.1 shows them. --- */

/** 11 days after `DEMO_ASOF`. */
export const NHS_SUBMISSION_DEADLINE = t('2026-09-14T12:00:00+01:00');
/** 4 days after `DEMO_ASOF`. */
export const CAMDEN_SUBMISSION_DEADLINE = t('2026-09-07T17:00:00+01:00');
/** 19 days after `DEMO_ASOF`. */
export const LEEDS_SUBMISSION_DEADLINE = t('2026-09-22T12:00:00+01:00');
