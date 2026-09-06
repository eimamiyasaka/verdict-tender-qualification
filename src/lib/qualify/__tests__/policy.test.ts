import { describe, expect, it } from 'vitest';
import { policyCases } from '../../../../fixtures';
import { expectCase, runCase } from './run-case';

describe('policy', () => {
  for (const testCase of policyCases) {
    it(`${testCase.name} (${testCase.source})`, () => {
      expectCase(testCase);
    });
  }

  it('a stale review is a warning on a pass, never a fail', () => {
    const outcome = runCase(policyCases[1]);
    expect(outcome.verdict).toBe('pass');
    expect(outcome.warning).toBe(
      'Modern slavery statement last reviewed 1 Feb 2024, 31 months ago. ' +
        'Refresh it before submission.',
    );
  });

  it('names the clause’s own review window when it states one', () => {
    const outcome = runCase({
      ...policyCases[1],
      requirement: {
        ...policyCases[1].requirement,
        constraint: { kind: 'policy', policy_type: 'modern_slavery', max_age_months: 12 },
      },
    });
    expect(outcome.verdict).toBe('pass');
    expect(outcome.warning).toContain('31 months ago against a 12-month requirement');
  });

  it('does not warn when the clause allows a longer window than the default', () => {
    const outcome = runCase({
      ...policyCases[1],
      requirement: {
        ...policyCases[1].requirement,
        constraint: { kind: 'policy', policy_type: 'modern_slavery', max_age_months: 36 },
      },
    });
    expect(outcome.verdict).toBe('pass');
    expect(outcome.warning ?? null).toBeNull();
  });

  it('an absent policy is a fail, and cites nothing because there is nothing to cite', () => {
    const outcome = runCase(policyCases[3]);
    expect(outcome.verdict).toBe('fail');
    expect(outcome.rationale).toContain('data protection policy');
    expect(outcome.evidence).toEqual([]);
  });
});
