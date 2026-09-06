/**
 * The one place a `RequirementCase` from `fixtures/evaluation.ts` is turned into
 * assertions. Every per-kind suite drives its cases through the real entry point,
 * `evaluate()`, rather than the rule module underneath it — the informational
 * cases live in the per-kind fixture arrays and are decided before the per-kind
 * switch, so testing the rules in isolation would quietly skip them.
 */

import { expect } from 'vitest';
import type { RequirementCase } from '../../../../fixtures';
import { toEvaluationInput } from '../../../../fixtures';
import type { RequirementEvaluation } from '../../../../contracts';
import { evaluate } from '../evaluate';

export function runCase(testCase: RequirementCase): RequirementEvaluation {
  const result = evaluate(toEvaluationInput(testCase));
  expect(result.results).toHaveLength(1);
  expect(result.results[0].requirementId).toBe(testCase.requirement.id);
  return result.results[0];
}

export function expectCase(testCase: RequirementCase): void {
  const outcome = runCase(testCase);
  const { expected } = testCase;

  expect(outcome.verdict, testCase.name).toBe(expected.verdict);

  // Every row renders its rationale verbatim (spec §12.5), so no row may be blank.
  expect(outcome.rationale.trim().length).toBeGreaterThan(0);

  for (const fragment of expected.rationaleIncludes ?? []) {
    expect(outcome.rationale).toContain(fragment);
  }

  if (expected.warningIncludes !== undefined) {
    expect(outcome.warning, `${testCase.name} — expected a warning`).toBeTruthy();
    for (const fragment of expected.warningIncludes) {
      expect(outcome.warning).toContain(fragment);
    }
  }

  if (expected.evidenceCount !== undefined) {
    expect(outcome.evidence).toHaveLength(expected.evidenceCount);
  }

  if (expected.countedEvidence !== undefined) {
    expect(outcome.evidence.filter((ref) => ref.counted === true)).toHaveLength(
      expected.countedEvidence,
    );
  }
}
