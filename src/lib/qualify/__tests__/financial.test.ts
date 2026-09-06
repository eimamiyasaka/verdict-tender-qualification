import { describe, expect, it } from 'vitest';
import { DEMO_ASOF, d, financialCases, snapshotOf } from '../../../../fixtures';
import { evaluate } from '../evaluate';
import { expectCase, runCase } from './run-case';

describe('financial', () => {
  for (const testCase of financialCases) {
    it(`${testCase.name} (${testCase.source})`, () => {
      expectCase(testCase);
    });
  }

  it('quantifies the shortfall exactly as spec §9 writes it', () => {
    const outcome = runCase(financialCases[1]);
    expect(outcome.rationale).toBe('FY2025 turnover £4,120,000 — short by £880,000.');
  });

  it('labels the years it read, with the year end spelled out', () => {
    const outcome = runCase(financialCases[1]);
    expect(outcome.evidence).toEqual([
      {
        source: 'financial_year',
        id: 'fy2025',
        label: 'FY2025 (year ending 31 Mar 2025)',
        detail: 'Turnover £4,120,000',
      },
    ]);
  });

  it('reads the most recent filed year first, whatever order the rows arrive in', () => {
    const older = {
      id: 'fy2024',
      yearEnding: d('2024-03-31'),
      turnover: 3_870_000,
      netAssets: 705_000,
      profitBeforeTax: null,
      currency: 'GBP',
    };
    const newer = {
      id: 'fy2025',
      yearEnding: d('2025-03-31'),
      turnover: 4_120_000,
      netAssets: 890_000,
      profitBeforeTax: 212_000,
      currency: 'GBP',
    };
    const result = evaluate({
      asOf: DEMO_ASOF,
      submissionDeadline: null,
      snapshot: snapshotOf({ financialYears: [older, newer] }),
      requirements: [
        {
          id: 'x',
          kind: 'financial',
          obligation: 'mandatory',
          summary: 'Annual turnover ≥ £4,000,000',
          constraint: {
            kind: 'financial',
            metric: 'annual_turnover',
            operator: 'gte',
            value: 4_000_000,
            currency: 'GBP',
            years_required: 1,
          },
        },
      ],
    });
    expect(result.results[0].verdict).toBe('pass');
    expect(result.results[0].rationale).toContain('FY2025');
  });

  it('compares in minor units, so a penny either side of the threshold decides it', () => {
    const year = (turnover: number) => ({
      id: 'fy',
      yearEnding: d('2025-03-31'),
      turnover,
      netAssets: null,
      profitBeforeTax: null,
      currency: 'GBP',
    });
    const requirement = {
      id: 'x',
      kind: 'financial' as const,
      obligation: 'mandatory' as const,
      summary: 'Annual turnover ≥ £4,120,000.10',
      constraint: {
        kind: 'financial' as const,
        metric: 'annual_turnover' as const,
        operator: 'gte' as const,
        value: 4_120_000.1,
        currency: 'GBP',
      },
    };
    const run = (turnover: number) =>
      evaluate({
        asOf: DEMO_ASOF,
        submissionDeadline: null,
        snapshot: snapshotOf({ financialYears: [year(turnover)] }),
        requirements: [requirement],
      }).results[0];

    expect(run(4_120_000.1).verdict).toBe('pass');
    expect(run(4_120_000.09).verdict).toBe('fail');
    expect(run(4_120_000.09).rationale).toContain('£4,120,000.09');
  });
});
