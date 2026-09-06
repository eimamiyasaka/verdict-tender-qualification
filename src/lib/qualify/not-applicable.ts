/**
 * The kinds that never bear on eligibility — spec §9.
 *
 * They still get a stored rationale, because the matrix shows every row and
 * "not_applicable" with no sentence beside it reads as something the engine
 * skipped rather than something it decided.
 *
 * The one exception is `other` carrying `original_kind: 'certification'`: spec §14
 * row 4 stores a credential code we hold no reference data for here rather than
 * dropping it, and it evaluates to `unknown` with the raw code named.
 */

import type {
  OtherConstraint,
  RequirementConstraint,
  RequirementOutcome,
} from '../../../contracts';
import { unresolvedCredential } from './certification';

const RATIONALES: Record<string, string> = {
  question: 'Not an eligibility gate — answered in the bid workspace.',
  date: 'A key date, not an eligibility gate — shown in the tender header.',
  legal_status: 'Self-declared at submission. Not evaluated against the profile.',
  resource: 'Not evaluated against the profile in this version.',
  other: 'Not an eligibility gate. Recorded in the matrix with its citation.',
};

export function notApplicable(constraint: RequirementConstraint): RequirementOutcome {
  return {
    verdict: 'not_applicable',
    rationale: RATIONALES[constraint.kind] ?? RATIONALES.other,
    evidence: [],
  };
}

/** Spec §9: informational carries no obligation, whatever the kind alongside it. */
export function informational(): RequirementOutcome {
  return {
    verdict: 'not_applicable',
    rationale: 'Informational — the clause states a fact and imposes no obligation.',
    evidence: [],
  };
}

export function evaluateOther(constraint: OtherConstraint): RequirementOutcome {
  if (constraint.original_kind !== 'certification') return notApplicable(constraint);
  // `OtherConstraintSchema` is a passthrough, so the raw code is present but untyped.
  const rawCode = (constraint as Record<string, unknown>).credential_code;
  return typeof rawCode === 'string'
    ? unresolvedCredential(rawCode)
    : {
        verdict: 'unknown',
        rationale:
          'The clause names a certification Verdict holds no reference data for. ' +
          'Read the clause and confirm it by hand.',
        evidence: [],
      };
}
