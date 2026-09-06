/**
 * The qualification engine — spec §9.
 *
 * `evaluate` implements the `Evaluate` type frozen in `contracts.ts`. It is pure:
 * no network, no model, no database, no `new Date()`. The only clock is the
 * injected `asOf`, which is what makes an assessment reproducible months later
 * and testable in seconds (spec §6.6, §7.6).
 *
 * The whole decision is here. One rule per kind, then three pieces of arithmetic
 * that live in `contracts.ts` and have exactly one definition each.
 */

import {
  constraintMatchesKind,
  desirableCoverage,
  recommend,
  tallyMandatory,
  type Evaluate,
  type EvaluateRequirement,
  type EvaluationContext,
  type RequirementEvaluation,
} from '../../../contracts';
import { evaluateCertification } from './certification';
import { evaluateExperience } from './experience';
import { evaluateFinancial } from './financial';
import { evaluateInsurance } from './insurance';
import { evaluateOther, informational, notApplicable } from './not-applicable';
import { evaluatePolicy } from './policy';

export const evaluateRequirement: EvaluateRequirement = (requirement, context) => {
  // Spec §9: informational carries no obligation, whatever kind it wears.
  if (requirement.obligation === 'informational') return informational();

  // Invariant 2's shapes are enforced by the database and by Zod at the insert
  // boundary; a row that still disagrees with itself is not something to guess at.
  if (!constraintMatchesKind(requirement.kind, requirement.constraint)) {
    return {
      verdict: 'unknown',
      rationale:
        `This requirement is recorded as ${requirement.kind} but carries a ` +
        `${requirement.constraint.kind} constraint, so it cannot be checked. ` +
        'Read the clause and confirm it by hand.',
      evidence: [],
    };
  }

  const constraint = requirement.constraint;
  switch (constraint.kind) {
    case 'certification':
      return evaluateCertification(constraint, context);
    case 'financial':
      return evaluateFinancial(constraint, context);
    case 'insurance':
      return evaluateInsurance(constraint, context);
    case 'experience':
      return evaluateExperience(constraint, context);
    case 'policy':
      return evaluatePolicy(constraint, context);
    case 'other':
      return evaluateOther(constraint);
    // question, date, legal_status and resource never bear on eligibility.
    default:
      return notApplicable(constraint);
  }
};

export const evaluate: Evaluate = (input) => {
  const context: EvaluationContext = {
    asOf: input.asOf,
    submissionDeadline: input.submissionDeadline,
    snapshot: input.snapshot,
  };

  const results: RequirementEvaluation[] = input.requirements.map((requirement) => ({
    requirementId: requirement.id,
    ...evaluateRequirement(requirement, context),
  }));

  const rows = input.requirements.map((requirement, index) => ({
    obligation: requirement.obligation,
    verdict: results[index].verdict,
  }));
  const counts = tallyMandatory(rows);

  return {
    ...counts,
    recommendation: recommend(counts),
    desirableScore: desirableCoverage(rows),
    results,
    deadlineUsed: input.submissionDeadline,
    asOfUsed: input.asOf,
  };
};
