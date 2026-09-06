import { describe, expect, it } from 'vitest';
import { DEMO_ASOF, demoSnapshot, notApplicableCases } from '../../../../fixtures';
import { evaluate } from '../evaluate';
import { expectCase } from './run-case';

describe('the kinds that never bear on eligibility', () => {
  for (const testCase of notApplicableCases) {
    it(`${testCase.name} (${testCase.source})`, () => {
      expectCase(testCase);
    });
  }

  it('leaves a sentence on every row, so nothing reads as skipped', () => {
    for (const testCase of notApplicableCases) {
      const outcome = evaluate({
        asOf: testCase.asOf,
        submissionDeadline: testCase.submissionDeadline,
        snapshot: testCase.snapshot,
        requirements: [testCase.requirement],
      }).results[0];
      expect(outcome.rationale.length).toBeGreaterThan(0);
      expect(outcome.evidence).toEqual([]);
    }
  });

  it('an informational requirement is not_applicable whatever its kind', () => {
    const result = evaluate({
      asOf: DEMO_ASOF,
      submissionDeadline: null,
      snapshot: demoSnapshot,
      requirements: [
        {
          id: 'i1',
          kind: 'certification',
          obligation: 'informational',
          summary: 'Most incumbent suppliers hold ISO 27001',
          constraint: { kind: 'certification', credential_code: 'ISO27001' },
        },
        {
          id: 'i2',
          kind: 'insurance',
          obligation: 'informational',
          summary: 'The Authority holds its own contract works cover',
          constraint: {
            kind: 'insurance',
            insurance_kind: 'contract_works',
            min_cover: 0,
            currency: 'GBP',
          },
        },
      ],
    });
    expect(result.results.map((row) => row.verdict)).toEqual([
      'not_applicable',
      'not_applicable',
    ]);
    expect(result.mandatoryTotal).toBe(0);
  });

  it('an unrecognised credential stored as `other` is unknown, with the raw code named', () => {
    const outcome = evaluate({
      asOf: DEMO_ASOF,
      submissionDeadline: null,
      snapshot: demoSnapshot,
      requirements: [
        {
          id: 'o1',
          kind: 'other',
          obligation: 'mandatory',
          summary: 'ISO 22301 business continuity certification',
          constraint: {
            kind: 'other',
            original_kind: 'certification',
            credential_code: 'ISO22301',
            note: 'Credential code is not in credential_types; stored verbatim.',
          },
        },
      ],
    }).results[0];
    expect(outcome.verdict).toBe('unknown');
    expect(outcome.rationale).toContain('ISO22301');
  });

  it('a plain `other` requirement is not an eligibility gate', () => {
    const outcome = evaluate({
      asOf: DEMO_ASOF,
      submissionDeadline: null,
      snapshot: demoSnapshot,
      requirements: [
        {
          id: 'o2',
          kind: 'other',
          obligation: 'mandatory',
          summary: 'Bidders are encouraged to attend the site visit',
          constraint: { kind: 'other', note: 'Site visit encouragement.' },
        },
      ],
    }).results[0];
    expect(outcome.verdict).toBe('not_applicable');
  });

  it('a row whose constraint disagrees with its kind is unknown, never guessed at', () => {
    const outcome = evaluate({
      asOf: DEMO_ASOF,
      submissionDeadline: null,
      snapshot: demoSnapshot,
      requirements: [
        {
          id: 'bad',
          kind: 'certification',
          obligation: 'mandatory',
          summary: 'Mislabelled row',
          constraint: { kind: 'policy', policy_type: 'health_safety' },
        },
      ],
    }).results[0];
    expect(outcome.verdict).toBe('unknown');
    expect(outcome.rationale).toContain('certification');
    expect(outcome.rationale).toContain('policy');
  });
});
