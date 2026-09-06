/**
 * insurance — spec §9.
 *
 * The mirror of `certification.ts`, and the reason the product exists. No policy
 * of that kind recorded is `unknown`, never `fail`: an uninsured company and a
 * company that has not filled in the form look identical from here, and telling a
 * bid manager they have failed a gate they may well pass is how these tools lose
 * trust in the first week.
 */

import {
  compareMoney,
  sameCurrency,
  type EvaluationContext,
  type EvidenceRef,
  type InsuranceConstraint,
  type InsuranceFact,
  type RequirementOutcome,
} from '../../../contracts';
import {
  INSURANCE_LABEL,
  capitalise,
  daysBetween,
  formatDate,
  formatMoney,
  moneyGap,
  normaliseCurrency,
  validityAnchor,
} from './rationale';

export function evaluateInsurance(
  constraint: InsuranceConstraint,
  context: EvaluationContext,
): RequirementOutcome {
  const label = INSURANCE_LABEL[constraint.insurance_kind];
  const policy = context.snapshot.insurances.find(
    (insurance) => insurance.kind === constraint.insurance_kind,
  );
  if (policy === undefined) {
    return {
      verdict: 'unknown',
      rationale: `No ${label} policy recorded. Add one to resolve.`,
      evidence: [],
    };
  }

  const evidence = [insuranceEvidence(policy, label)];
  const cover = formatMoney(policy.coverAmount, policy.currency);
  const anchor = validityAnchor(context);

  if (policy.expiresOn !== null && daysBetween(anchor.at, policy.expiresOn) < 0) {
    return {
      verdict: 'fail',
      rationale:
        `${capitalise(label)} cover ${cover} expired ${formatDate(policy.expiresOn)} — ` +
        `${anchor.noun} is ${formatDate(anchor.at)}.`,
      evidence,
    };
  }

  // Spec §14: never a silent conversion at an invented rate.
  if (!sameCurrency(constraint.currency, policy.currency)) {
    return {
      verdict: 'unknown',
      rationale:
        `The requirement is stated in ${normaliseCurrency(constraint.currency)} but your ` +
        `${label} cover is recorded in ${normaliseCurrency(policy.currency)}. ` +
        'Verdict does not convert currencies at an invented rate.',
      evidence,
    };
  }

  const required = formatMoney(constraint.min_cover, constraint.currency);
  if (compareMoney(policy.coverAmount, constraint.min_cover) < 0) {
    return {
      verdict: 'fail',
      rationale:
        `${capitalise(label)} cover ${cover} — short of ${required} by ` +
        `${formatMoney(moneyGap(constraint.min_cover, policy.coverAmount), constraint.currency)}.`,
      evidence,
    };
  }

  const insurer = policy.insurer === null ? '' : ` (${policy.insurer})`;
  return {
    verdict: 'pass',
    rationale: `${capitalise(label)} cover ${cover}${insurer} — ${required} required.`,
    evidence,
  };
}

function insuranceEvidence(policy: InsuranceFact, label: string): EvidenceRef {
  const detail = [
    policy.insurer,
    policy.expiresOn === null ? null : `valid to ${formatDate(policy.expiresOn)}`,
  ].filter((part): part is string => part !== null);
  return {
    source: 'insurance',
    id: policy.id,
    label: `${capitalise(label)} ${formatMoney(policy.coverAmount, policy.currency)}`,
    detail: detail.length === 0 ? undefined : detail.join(' · '),
  };
}
