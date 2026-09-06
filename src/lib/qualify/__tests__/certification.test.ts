import { describe, expect, it } from 'vitest';
import { DEMO_ASOF, certificationCases, d, emptySnapshot, snapshotOf } from '../../../../fixtures';
import { evaluate } from '../evaluate';
import { expectCase, runCase } from './run-case';

describe('certification', () => {
  for (const testCase of certificationCases) {
    it(`${testCase.name} (${testCase.source})`, () => {
      expectCase(testCase);
    });
  }

  it('names the credential and its certificate number in a passing rationale', () => {
    const outcome = runCase(certificationCases[0]);
    expect(outcome.rationale).toContain('ISO 9001 Quality Management');
    expect(outcome.rationale).toContain('ISO9001/MER/0912');
    expect(outcome.evidence[0].source).toBe('credential');
    expect(outcome.evidence[0].id).toBe('c1');
  });

  it('is a fail, not an unknown, when nothing is held — the profile is a closed world', () => {
    const result = evaluate({
      asOf: DEMO_ASOF,
      submissionDeadline: d('2026-09-14'),
      snapshot: emptySnapshot,
      requirements: [
        {
          id: 'x',
          kind: 'certification',
          obligation: 'mandatory',
          summary: 'ISO 27001 certification',
          constraint: { kind: 'certification', credential_code: 'ISO27001' },
        },
      ],
    });
    expect(result.results[0].verdict).toBe('fail');
    expect(result.recommendation).toBe('no_bid');
  });

  it('cannot decide a credential code it holds no reference data for', () => {
    const result = evaluate({
      asOf: DEMO_ASOF,
      submissionDeadline: d('2026-09-14'),
      snapshot: snapshotOf({}),
      requirements: [
        {
          id: 'x',
          kind: 'certification',
          obligation: 'mandatory',
          summary: 'ISO 22301 certification',
          constraint: { kind: 'certification', credential_code: 'ISO22301' },
        },
      ],
    });
    expect(result.results[0].verdict).toBe('unknown');
    expect(result.results[0].rationale).toContain('ISO22301');
  });
});
