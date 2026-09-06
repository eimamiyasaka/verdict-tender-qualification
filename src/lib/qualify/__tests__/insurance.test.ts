import { describe, expect, it } from 'vitest';
import {
  DEMO_ASOF,
  demoSnapshot,
  demoSnapshotWithEmployersLiability,
  insuranceCases,
} from '../../../../fixtures';
import type { EvaluableRequirement } from '../../../../contracts';
import { evaluate } from '../evaluate';
import { expectCase, runCase } from './run-case';

const EMPLOYERS_LIABILITY: EvaluableRequirement = {
  id: 'nhs-employers-liability',
  kind: 'insurance',
  obligation: 'mandatory',
  summary: 'Employers’ liability cover ≥ £10,000,000',
  constraint: {
    kind: 'insurance',
    insurance_kind: 'employers_liability',
    min_cover: 10_000_000,
    currency: 'GBP',
  },
};

describe('insurance', () => {
  for (const testCase of insuranceCases) {
    it(`${testCase.name} (${testCase.source})`, () => {
      expectCase(testCase);
    });
  }

  it('quantifies a shortfall in both directions of the comparison', () => {
    const outcome = runCase(insuranceCases[2]);
    expect(outcome.rationale).toBe(
      'Professional indemnity cover £5,000,000 — short of £10,000,000 by £5,000,000.',
    );
  });

  it('is the mirror of certification: the same gap means the opposite thing', () => {
    const missingPolicy = evaluate({
      asOf: DEMO_ASOF,
      submissionDeadline: null,
      snapshot: demoSnapshot,
      requirements: [EMPLOYERS_LIABILITY],
    }).results[0];
    const missingCredential = evaluate({
      asOf: DEMO_ASOF,
      submissionDeadline: null,
      snapshot: demoSnapshot,
      requirements: [
        {
          id: 'nhs-iso27001',
          kind: 'certification',
          obligation: 'mandatory',
          summary: 'ISO 27001 certification',
          constraint: { kind: 'certification', credential_code: 'ISO27001' },
        },
      ],
    }).results[0];

    expect(missingPolicy.verdict).toBe('unknown');
    expect(missingCredential.verdict).toBe('fail');
  });

  it('resolves to a pass once the policy is on the profile', () => {
    const outcome = evaluate({
      asOf: DEMO_ASOF,
      submissionDeadline: null,
      snapshot: demoSnapshotWithEmployersLiability,
      requirements: [EMPLOYERS_LIABILITY],
    }).results[0];

    expect(outcome.verdict).toBe('pass');
    expect(outcome.rationale).toContain('£10,000,000');
    expect(outcome.evidence).toHaveLength(1);
    expect(outcome.evidence[0].source).toBe('insurance');
  });
});
