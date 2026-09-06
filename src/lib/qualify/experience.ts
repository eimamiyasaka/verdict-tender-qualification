/**
 * experience — spec §9.
 *
 * Count the past projects that match the clause's value, recency, sector and
 * public-sector filters, and return an `EvidenceRef` for *every* project in the
 * snapshot with `counted` set on each. A row the user cannot see is a row they
 * will re-check by hand, which is the work the product exists to remove.
 *
 * A project that fails a filter we can check is excluded. A project we cannot
 * check — no contract value recorded, or one recorded in another currency — is
 * neither counted nor excluded: if those projects could still carry the count, the
 * answer is `unknown` rather than `fail`, for the same reason a missing financial
 * year is.
 */

import {
  compareMoney,
  sameCurrency,
  type EvaluationContext,
  type EvidenceRef,
  type ExperienceConstraint,
  type PastProjectFact,
  type RequirementOutcome,
} from '../../../contracts';
import {
  formatDate,
  formatMoney,
  formatMonth,
  humanise,
  listAnd,
  moneyGap,
  normaliseCurrency,
  pluralise,
  subtractMonths,
} from './rationale';

interface Match {
  project: PastProjectFact;
  /** Filters this project provably fails. */
  excluded: string[];
  /** Filters this project cannot be judged against from the snapshot. */
  unclear: string[];
}

export function evaluateExperience(
  constraint: ExperienceConstraint,
  context: EvaluationContext,
): RequirementOutcome {
  const projects = context.snapshot.pastProjects;
  const matches = projects.map((project) => match(project, constraint, context));
  const evidence = matches.map(projectEvidence);

  const counted = matches.filter(isCounted).length;
  const undecidable = matches.filter(isUndecidable);
  const criteria = describeCriteria(constraint);
  const found =
    criteria.length === 0
      ? `${counted} of ${projects.length} recorded ${pluralise(projects.length, 'project')}`
      : `${counted} of ${projects.length} recorded ${pluralise(projects.length, 'project')} match ${listAnd(criteria)}`;
  const tail = `${constraint.min_count} required.`;

  if (counted >= constraint.min_count) {
    return { verdict: 'pass', rationale: `${found} — ${tail}`, evidence };
  }
  if (counted + undecidable.length >= constraint.min_count) {
    const reasons = listAnd(
      Array.from(new Set(undecidable.flatMap((entry) => entry.unclear))),
    );
    return {
      verdict: 'unknown',
      rationale:
        `${found} — ${tail} ${undecidable.length} further ` +
        `${pluralise(undecidable.length, 'project')} cannot be checked: ${reasons}.`,
      evidence,
    };
  }
  return {
    verdict: 'fail',
    rationale: `${found} — ${tail}${largestContract(projects, constraint)}`,
    evidence,
  };
}

/* --- One project against the clause. --- */

function match(
  project: PastProjectFact,
  constraint: ExperienceConstraint,
  context: EvaluationContext,
): Match {
  const excluded: string[] = [];
  const unclear: string[] = [];

  if (constraint.min_value !== undefined) {
    const required = formatMoney(constraint.min_value, constraint.currency);
    if (project.contractValue === null) {
      unclear.push('no contract value recorded');
    } else if (!sameCurrency(constraint.currency, project.currency)) {
      unclear.push(
        `value recorded in ${normaliseCurrency(project.currency)}, requirement in ${normaliseCurrency(constraint.currency)}`,
      );
    } else if (compareMoney(project.contractValue, constraint.min_value) < 0) {
      excluded.push(
        `${formatMoney(project.contractValue, project.currency)} is under ${required}`,
      );
    }
  }

  // `endedOn` null means ongoing, which is as recent as it gets.
  if (constraint.within_last_months !== undefined && project.endedOn !== null) {
    const cutoff = subtractMonths(context.asOf, constraint.within_last_months);
    if (project.endedOn.getTime() < cutoff.getTime()) {
      excluded.push(
        `ended ${formatDate(project.endedOn)}, outside the last ${constraint.within_last_months} months`,
      );
    }
  }

  if (constraint.sector !== undefined) {
    if (project.sector === null) unclear.push('no sector recorded');
    else if (project.sector !== constraint.sector) {
      excluded.push(`${humanise(project.sector)} sector`);
    }
  }

  if (constraint.public_sector_only === true && !project.isPublicSector) {
    excluded.push('not public sector');
  }
  if (constraint.referee_required === true && !project.refereeContactable) {
    excluded.push('no contactable referee');
  }

  return { project, excluded, unclear };
}

function isCounted(entry: Match): boolean {
  return entry.excluded.length === 0 && entry.unclear.length === 0;
}

function isUndecidable(entry: Match): boolean {
  return entry.excluded.length === 0 && entry.unclear.length > 0;
}

/* --- Phrasing. --- */

function describeCriteria(constraint: ExperienceConstraint): string[] {
  const criteria: string[] = [];
  if (constraint.min_value !== undefined) {
    criteria.push(`≥ ${formatMoney(constraint.min_value, constraint.currency)}`);
  }
  if (constraint.within_last_months !== undefined) {
    criteria.push(`within the last ${constraint.within_last_months} months`);
  }
  if (constraint.sector !== undefined) criteria.push(`${humanise(constraint.sector)} sector`);
  if (constraint.public_sector_only === true) criteria.push('public sector');
  if (constraint.referee_required === true) criteria.push('a contactable referee');
  return criteria;
}

/** Where a value gate is what shut the door, name the nearest miss. */
function largestContract(
  projects: readonly PastProjectFact[],
  constraint: ExperienceConstraint,
): string {
  if (constraint.min_value === undefined) return '';
  const comparable = projects.filter(
    (project) =>
      project.contractValue !== null && sameCurrency(constraint.currency, project.currency),
  );
  if (comparable.length === 0) return '';
  const largest = comparable.reduce((best, project) =>
    compareMoney(project.contractValue as number, best.contractValue as number) > 0 ? project : best,
  );
  const value = largest.contractValue as number;
  if (compareMoney(value, constraint.min_value) >= 0) return '';
  return (
    ` Largest recorded contract is ${formatMoney(value, largest.currency)} ` +
    `(${largest.clientName}) — short by ` +
    `${formatMoney(moneyGap(constraint.min_value, value), constraint.currency)}.`
  );
}

function projectEvidence(entry: Match): EvidenceRef {
  const { project } = entry;
  const facts = [
    project.contractValue === null
      ? 'value not recorded'
      : formatMoney(project.contractValue, project.currency),
    project.endedOn === null ? 'ongoing' : `ended ${formatMonth(project.endedOn)}`,
    project.sector === null ? 'sector not recorded' : humanise(project.sector),
    project.isPublicSector ? 'public sector' : 'private sector',
  ];
  const misses = [...entry.excluded, ...entry.unclear];
  return {
    source: 'past_project',
    id: project.id,
    label: `${project.clientName} — ${project.title}`,
    detail: misses.length === 0 ? facts.join(' · ') : `${facts.join(' · ')} — ${misses.join('; ')}`,
    counted: isCounted(entry),
  };
}
