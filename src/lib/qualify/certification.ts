/**
 * certification — spec §9.
 *
 * The rule that carries the product: a credential we cannot find is a `fail`, not
 * an `unknown`. The profile is a closed world of certifications held, so absence
 * is knowable. Compare with `insurance.ts`, where the same shape of gap means the
 * opposite thing.
 */

import {
  CREDENTIAL_EXPIRY_WARNING_DAYS,
  credentialLabel,
  isKnownCredentialCode,
  type CertificationConstraint,
  type CredentialFact,
  type EvaluationContext,
  type EvidenceRef,
  type RequirementOutcome,
} from '../../../contracts';
import { capitalise, daysBetween, formatDate, pluralise, validityAnchor } from './rationale';

export function evaluateCertification(
  constraint: CertificationConstraint,
  context: EvaluationContext,
): RequirementOutcome {
  const code = constraint.credential_code;

  // Spec §14 row 4: a scheme we hold no reference data for cannot be decided from
  // a profile that can only record the codes we do know.
  if (!isKnownCredentialCode(code)) return unresolvedCredential(code);

  const label = credentialLabel(code);
  const held = context.snapshot.credentials.find((credential) => credential.code === code);
  if (held === undefined) {
    return { verdict: 'fail', rationale: 'Not held. No certificate on your profile.', evidence: [] };
  }

  const evidence = [credentialEvidence(held, label)];

  // Spec §7.4: null means DOES NOT EXPIRE. It never means missing.
  if (held.expiresOn === null) {
    return {
      verdict: 'pass',
      rationale: `${label} held${reference(held)} — does not expire.`,
      evidence,
    };
  }

  const anchor = validityAnchor(context);
  const days = daysBetween(anchor.at, held.expiresOn);
  if (days < 0) {
    return {
      verdict: 'fail',
      rationale:
        `${label} expired ${formatDate(held.expiresOn)} — ` +
        `${anchor.noun} is ${formatDate(anchor.at)}.`,
      evidence,
    };
  }

  const rationale = `${label} held${reference(held)}, valid to ${formatDate(held.expiresOn)}.`;
  if (days > CREDENTIAL_EXPIRY_WARNING_DAYS) return { verdict: 'pass', rationale, evidence };

  const when =
    days === 0
      ? `on ${anchor.noun}`
      : `${days} ${pluralise(days, 'day')} after ${anchor.noun}`;
  return {
    verdict: 'pass',
    rationale,
    evidence,
    warning: `${label} expires ${formatDate(held.expiresOn)}, ${when}. Renew before mobilisation.`,
  };
}

/** Shared with `other.ts`: the same clause, arriving under a different `kind`. */
export function unresolvedCredential(rawCode: string): RequirementOutcome {
  return {
    verdict: 'unknown',
    rationale:
      `Credential code “${rawCode}” is not one Verdict holds reference data for, ` +
      'so it cannot be checked against your profile. Read the clause and confirm it by hand.',
    evidence: [],
  };
}

function reference(credential: CredentialFact): string {
  return credential.reference === null ? '' : ` (${credential.reference})`;
}

function credentialEvidence(credential: CredentialFact, label: string): EvidenceRef {
  const detail = [
    credential.reference,
    credential.expiresOn === null
      ? 'does not expire'
      : `valid to ${formatDate(credential.expiresOn)}`,
  ].filter((part): part is string => part !== null);
  return {
    source: 'credential',
    id: credential.id,
    label,
    detail: capitalise(detail.join(' · ')),
  };
}
