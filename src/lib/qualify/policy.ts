/**
 * policy — spec §9.
 *
 * Recorded → `pass`. Recorded but stale → `pass` with a warning, never a `fail`:
 * a policy that exists and is overdue a review is a thing to fix before
 * submission, not a gate that shuts. Absent → `fail`, because the profile is a
 * closed world of policies held, exactly as it is for certifications.
 */

import {
  POLICY_REVIEW_WARNING_MONTHS,
  type EvaluationContext,
  type EvidenceRef,
  type PolicyConstraint,
  type PolicyFact,
  type RequirementOutcome,
} from '../../../contracts';
import { capitalise, formatDate, monthsBetween, policyLabel } from './rationale';

export function evaluatePolicy(
  constraint: PolicyConstraint,
  context: EvaluationContext,
): RequirementOutcome {
  const label = policyLabel(constraint.policy_type);
  const held = context.snapshot.policies.find(
    (policy) => policy.policyType === constraint.policy_type,
  );
  if (held === undefined) {
    return { verdict: 'fail', rationale: `No ${label} on your profile.`, evidence: [] };
  }

  const evidence = [policyEvidence(held, label)];
  if (held.lastReviewed === null) {
    return {
      verdict: 'pass',
      rationale: `${capitalise(label)} held — review date not recorded.`,
      evidence,
    };
  }

  const rationale = `${capitalise(label)} held — last reviewed ${formatDate(held.lastReviewed)}.`;
  const months = monthsBetween(held.lastReviewed, context.asOf);
  const maxAge = constraint.max_age_months ?? POLICY_REVIEW_WARNING_MONTHS;
  if (months <= maxAge) return { verdict: 'pass', rationale, evidence };

  const against =
    constraint.max_age_months === undefined
      ? ''
      : ` against a ${constraint.max_age_months}-month requirement`;
  return {
    verdict: 'pass',
    rationale,
    evidence,
    warning:
      `${capitalise(label)} last reviewed ${formatDate(held.lastReviewed)}, ` +
      `${months} months ago${against}. Refresh it before submission.`,
  };
}

function policyEvidence(policy: PolicyFact, label: string): EvidenceRef {
  return {
    source: 'policy',
    id: policy.id,
    label: policy.title ?? capitalise(label),
    detail:
      policy.lastReviewed === null
        ? 'Review date not recorded'
        : `Last reviewed ${formatDate(policy.lastReviewed)}`,
  };
}
