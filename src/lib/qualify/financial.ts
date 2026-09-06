/**
 * financial — spec §9.
 *
 * Compare the metric across the last N filed years, most recent first. A year that
 * was never filed, or filed with a null metric, is `unknown` naming that year — not
 * a `fail`. "You have not told us your 2025 turnover" and "your turnover is £4.1m
 * against a £5m threshold" are different sentences to a bid manager.
 */

import {
  METRICS_NOT_IN_SNAPSHOT,
  compareMoney,
  sameCurrency,
  satisfiesThreshold,
  type ComparisonOperator,
  type EvaluationContext,
  type EvidenceRef,
  type FinancialConstraint,
  type FinancialMetric,
  type FinancialYearFact,
  type Money,
  type RequirementOutcome,
} from '../../../contracts';
import {
  METRIC_LABEL,
  capitalise,
  fiscalYear,
  fiscalYearLabel,
  formatMoney,
  listAnd,
  moneyGap,
  normaliseCurrency,
  pluralise,
} from './rationale';

interface Reading {
  year: FinancialYearFact;
  value: Money;
  satisfied: boolean;
}

export function evaluateFinancial(
  constraint: FinancialConstraint,
  context: EvaluationContext,
): RequirementOutcome {
  const metric = METRIC_LABEL[constraint.metric];

  // `FinancialYear` has no column for these, so `unknown` is the permanent and
  // correct answer — not a gap to be quietly filled later.
  if (METRICS_NOT_IN_SNAPSHOT.includes(constraint.metric)) {
    return {
      verdict: 'unknown',
      rationale:
        `The company profile does not hold a ${metric} — Verdict records turnover, ` +
        'net assets and profit before tax only.',
      evidence: [],
    };
  }

  const required = constraint.years_required ?? 1;
  const filed = [...context.snapshot.financialYears].sort(
    (a, b) => b.yearEnding.getTime() - a.yearEnding.getTime(),
  );
  if (filed.length < required) return missingYears(filed, required, constraint.metric, metric);

  const window = filed.slice(0, required);
  const evidence = window.map((year) => yearEvidence(year, constraint.metric, metric));
  const readings: Reading[] = [];
  for (const year of window) {
    const value = metricValue(year, constraint.metric);
    if (value === null) {
      return {
        verdict: 'unknown',
        rationale:
          `${fiscalYear(year.yearEnding)} ${metric} is not recorded. The year is filed ` +
          'but the figure was never entered, so this cannot be decided.',
        evidence,
      };
    }
    if (!sameCurrency(constraint.currency, year.currency)) {
      return {
        verdict: 'unknown',
        rationale:
          `The requirement is stated in ${normaliseCurrency(constraint.currency)} but ` +
          `${fiscalYear(year.yearEnding)} is recorded in ${normaliseCurrency(year.currency)}. ` +
          'Verdict does not convert currencies at an invented rate.',
        evidence,
      };
    }
    readings.push({ year, value, satisfied: meets(value, constraint) });
  }

  switch (constraint.basis ?? 'each_year') {
    case 'average':
      return onAverage(readings, constraint, metric, evidence);
    case 'any_year':
      return inAnyYear(readings, constraint, metric, evidence);
    case 'each_year':
      return inEachYear(readings, constraint, metric, evidence);
  }
}

/* --- The three bases. --- */

function inEachYear(
  readings: Reading[],
  constraint: FinancialConstraint,
  metric: string,
  evidence: EvidenceRef[],
): RequirementOutcome {
  const short = readings.find((reading) => !reading.satisfied);
  if (short !== undefined) {
    return {
      verdict: 'fail',
      rationale: `${statement(short, constraint, metric)} — ${gap(short.value, constraint)}.`,
      evidence,
    };
  }
  if (readings.length === 1) {
    return {
      verdict: 'pass',
      rationale: `${statement(readings[0], constraint, metric)}, ${threshold(constraint)} required.`,
      evidence,
    };
  }
  const figures = readings.map(
    (reading) => `${fiscalYear(reading.year.yearEnding)} ${money(reading.value, constraint)}`,
  );
  return {
    verdict: 'pass',
    rationale:
      `${capitalise(metric)} ${listAnd(figures)} — every one of the last ` +
      `${readings.length} filed years is ${threshold(constraint)}.`,
    evidence,
  };
}

function inAnyYear(
  readings: Reading[],
  constraint: FinancialConstraint,
  metric: string,
  evidence: EvidenceRef[],
): RequirementOutcome {
  const hit = readings.find((reading) => reading.satisfied);
  if (hit !== undefined) {
    return {
      verdict: 'pass',
      rationale:
        `${statement(hit, constraint, metric)}, ${threshold(constraint)} required in at ` +
        `least one of the last ${readings.length} filed ${pluralise(readings.length, 'year')}.`,
      evidence,
    };
  }
  const closest = readings.reduce((best, reading) =>
    moneyGap(reading.value, constraint.value) < moneyGap(best.value, constraint.value)
      ? reading
      : best,
  );
  const years = listAnd(readings.map((reading) => fiscalYear(reading.year.yearEnding)));
  return {
    verdict: 'fail',
    rationale:
      `No year in ${years} is ${threshold(constraint)} — closest is ` +
      `${statement(closest, constraint, metric)}, ${gap(closest.value, constraint)}.`,
    evidence,
  };
}

function onAverage(
  readings: Reading[],
  constraint: FinancialConstraint,
  metric: string,
  evidence: EvidenceRef[],
): RequirementOutcome {
  const mean = readings.reduce((total, reading) => total + reading.value, 0) / readings.length;
  const years = listAnd(readings.map((reading) => fiscalYear(reading.year.yearEnding)));
  const lead = `Average ${metric} across ${years} ${money(mean, constraint)}`;
  return meets(mean, constraint)
    ? { verdict: 'pass', rationale: `${lead}, ${threshold(constraint)} required.`, evidence }
    : { verdict: 'fail', rationale: `${lead} — ${gap(mean, constraint)}.`, evidence };
}

/* --- The years that are not there. --- */

function missingYears(
  filed: FinancialYearFact[],
  required: number,
  metric: FinancialMetric,
  metricLabel: string,
): RequirementOutcome {
  const evidence = filed.map((year) => yearEvidence(year, metric, metricLabel));
  if (filed.length === 0) {
    return {
      verdict: 'unknown',
      rationale: `No financial years are on file — ${required} ${pluralise(required, 'year')} required.`,
      evidence,
    };
  }
  const oldest = filed[filed.length - 1].yearEnding.getUTCFullYear();
  const absent = Array.from({ length: required - filed.length }, (_, index) => `FY${oldest - 1 - index}`);
  return {
    verdict: 'unknown',
    rationale:
      `${listAnd(absent)} accounts are not on file — ${required} years required, ` +
      `${filed.length} filed. We cannot see what was never entered.`,
    evidence,
  };
}

/* --- Arithmetic and phrasing. --- */

function metricValue(year: FinancialYearFact, metric: FinancialMetric): Money | null {
  switch (metric) {
    case 'annual_turnover':
      return year.turnover;
    case 'net_assets':
      return year.netAssets;
    case 'profit_before_tax':
      return year.profitBeforeTax;
    default:
      return null;
  }
}

/** Never `>=` on two money values: `compareMoney` rounds to minor units first. */
function meets(value: Money, constraint: FinancialConstraint): boolean {
  return satisfiesThreshold(compareMoney(value, constraint.value), constraint.operator, 0);
}

function money(value: Money, constraint: FinancialConstraint): string {
  return formatMoney(value, constraint.currency);
}

function statement(reading: Reading, constraint: FinancialConstraint, metric: string): string {
  return `${fiscalYear(reading.year.yearEnding)} ${metric} ${money(reading.value, constraint)}`;
}

function threshold(constraint: FinancialConstraint): string {
  const value = money(constraint.value, constraint);
  const phrases: Record<ComparisonOperator, string> = {
    gte: `at least ${value}`,
    gt: `above ${value}`,
    lte: `at most ${value}`,
    lt: `below ${value}`,
    eq: `exactly ${value}`,
  };
  return phrases[constraint.operator];
}

function gap(value: Money, constraint: FinancialConstraint): string {
  const distance = money(moneyGap(value, constraint.value), constraint);
  switch (constraint.operator) {
    case 'lte':
    case 'lt':
      return `over by ${distance}`;
    case 'eq':
      return `out by ${distance}`;
    default:
      return `short by ${distance}`;
  }
}

function yearEvidence(
  year: FinancialYearFact,
  metric: FinancialMetric,
  metricLabel: string,
): EvidenceRef {
  const value = metricValue(year, metric);
  return {
    source: 'financial_year',
    id: year.id,
    label: fiscalYearLabel(year.yearEnding),
    detail:
      value === null
        ? `${capitalise(metricLabel)} not recorded`
        : `${capitalise(metricLabel)} ${formatMoney(value, year.currency)}`,
  };
}
