/**
 * The acceptance suite: every golden case in `fixtures/evaluation.ts`, the three
 * whole-tender runs, and step 5 of the 90-second reviewer path — the assertion
 * that proves the engine is arithmetic and not a language model being agreeable.
 */

import { describe, expect, it } from 'vitest';
import {
  DEMO_ASOF,
  allRequirementCases,
  demoSnapshot,
  demoTendersByKey,
  desirableCoverageCases,
  fixtureProblems,
  recommendationCases,
  recommendationCasesHold,
  tenderEvaluationCases,
} from '../../../../fixtures';
import {
  desirableCoverage,
  recommend,
  type CapabilitySnapshot,
  type EvaluableRequirement,
  type EvaluationInput,
} from '../../../../contracts';
import { evaluate } from '../evaluate';
import { expectCase } from './run-case';

function tenderInput(
  key: 'nhs' | 'camden' | 'leeds',
  snapshot: CapabilitySnapshot,
): EvaluationInput {
  const tender = demoTendersByKey[key];
  const deadlines = tender.keyDates
    .filter((keyDate) => keyDate.kind === 'submission_deadline')
    .map((keyDate) => keyDate.occursAt.getTime());
  const requirements: EvaluableRequirement[] = tender.requirements.map((requirement) => ({
    id: requirement.key,
    kind: requirement.kind,
    obligation: requirement.obligation,
    summary: requirement.summary,
    constraint: requirement.constraint,
  }));
  return {
    asOf: DEMO_ASOF,
    // Spec §7.5: the earliest `submission_deadline` KeyDate, and nothing else.
    submissionDeadline: deadlines.length === 0 ? null : new Date(Math.min(...deadlines)),
    snapshot,
    requirements,
  };
}

describe('the fixtures themselves', () => {
  it('agree with the frozen arithmetic', () => {
    expect(fixtureProblems()).toEqual([]);
    expect(recommendationCasesHold).toBe(true);
  });
});

describe('every golden requirement case', () => {
  for (const testCase of allRequirementCases) {
    it(`${testCase.requirement.kind}: ${testCase.name}`, () => {
      expectCase(testCase);
    });
  }

  it('covers all four verdicts', () => {
    const verdicts = new Set(allRequirementCases.map((testCase) => testCase.expected.verdict));
    expect(verdicts).toEqual(new Set(['pass', 'fail', 'unknown', 'not_applicable']));
  });
});

describe('recommend', () => {
  for (const testCase of recommendationCases) {
    it(`${JSON.stringify(testCase.counts)} → ${testCase.expected}`, () => {
      expect(recommend(testCase.counts)).toBe(testCase.expected);
    });
  }

  it('is the recommendation `evaluate` returns, not a second copy of the rule', () => {
    for (const testCase of tenderEvaluationCases) {
      const result = evaluate(tenderInput(testCase.tender, testCase.snapshot));
      expect(result.recommendation).toBe(recommend(result));
    }
  });
});

describe('desirableCoverage', () => {
  for (const testCase of desirableCoverageCases) {
    it(testCase.name, () => {
      expect(desirableCoverage(testCase.rows)).toBe(testCase.expected);
    });
  }
});

describe('the three whole-tender runs', () => {
  for (const testCase of tenderEvaluationCases) {
    describe(testCase.name, () => {
      const input = tenderInput(testCase.tender, testCase.snapshot);
      const result = evaluate(input);
      const byId = new Map(result.results.map((row) => [row.requirementId, row]));

      it('returns one row per requirement, each with a rationale', () => {
        expect(result.results).toHaveLength(input.requirements.length);
        for (const row of result.results) {
          expect(row.rationale.trim().length).toBeGreaterThan(0);
        }
      });

      // The per-row `expected.verdict` in `fixtures/tenders/*.ts` is written against
      // `demoSnapshot`. The fourth case runs the same tender against the profile the
      // reviewer edits at step 4, and is asserted by its counts and by the §13 test.
      if (testCase.snapshot === demoSnapshot) {
        for (const requirement of demoTendersByKey[testCase.tender].requirements) {
          it(`${requirement.key} → ${requirement.expected.verdict}`, () => {
            expect(byId.get(requirement.key)?.verdict).toBe(requirement.expected.verdict);
          });
        }
      }

      it('matches the assessment counts the fixtures publish', () => {
        expect({
          recommendation: result.recommendation,
          mandatoryTotal: result.mandatoryTotal,
          mandatoryPassed: result.mandatoryPassed,
          mandatoryFailed: result.mandatoryFailed,
          mandatoryUnknown: result.mandatoryUnknown,
          desirableScore: result.desirableScore,
        }).toEqual(testCase.expected);
      });

      it('records the clock and the deadline it used', () => {
        expect(result.asOfUsed).toBe(DEMO_ASOF);
        expect(result.deadlineUsed).toEqual(input.submissionDeadline);
      });

      it('keeps total === passed + failed + unknown', () => {
        expect(result.mandatoryTotal).toBe(
          result.mandatoryPassed + result.mandatoryFailed + result.mandatoryUnknown,
        );
      });
    });
  }

  it('spec §13 step 5: adding employers’ liability resolves the unknown and the NHS verdict stays no_bid', () => {
    const before = evaluate(tenderInput('nhs', tenderEvaluationCases[0].snapshot));
    const after = evaluate(tenderInput('nhs', tenderEvaluationCases[3].snapshot));

    const key = 'nhs-employers-liability';
    const rowBefore = before.results.find((row) => row.requirementId === key);
    const rowAfter = after.results.find((row) => row.requirementId === key);

    expect(rowBefore?.verdict).toBe('unknown');
    expect(rowAfter?.verdict).toBe('pass');

    expect(before.mandatoryUnknown).toBe(3);
    expect(after.mandatoryUnknown).toBe(2);
    expect(after.mandatoryPassed).toBe(before.mandatoryPassed + 1);

    // The two blocking failures are untouched, so the call does not move.
    expect(before.recommendation).toBe('no_bid');
    expect(after.recommendation).toBe('no_bid');
    expect(after.mandatoryFailed).toBe(2);
  });
});

describe('purity', () => {
  it('is a pure function of its input: the same input twice gives the same answer', () => {
    const input = tenderInput('nhs', tenderEvaluationCases[0].snapshot);
    expect(evaluate(input)).toEqual(evaluate(input));
  });

  it('does not mutate the snapshot it was handed', () => {
    const input = tenderInput('leeds', tenderEvaluationCases[2].snapshot);
    const before = JSON.stringify(input);
    evaluate(input);
    expect(JSON.stringify(input)).toBe(before);
  });

  it('reads no clock but `asOf`: shifting it forward past every expiry changes the answer', () => {
    const input = tenderInput('leeds', tenderEvaluationCases[2].snapshot);
    const later = evaluate({
      ...input,
      asOf: new Date('2028-01-01T00:00:00.000Z'),
      submissionDeadline: new Date('2028-01-08T12:00:00.000Z'),
    });
    expect(later.recommendation).toBe('no_bid');
  });
});
