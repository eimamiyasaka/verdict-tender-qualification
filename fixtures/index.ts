/**
 * Fixture barrel, plus the integrity check that keeps the fixtures honest.
 *
 * `fixtureProblems()` recomputes every tender's headline counts from its own
 * requirement rows using the frozen `tallyMandatory` and `desirableCoverage`, and
 * reports anything that disagrees with the assessment as written. A fixture that
 * claims "21 pass · 2 fail · 3 unknown" and contains something else is worse than
 * no fixture at all, because three sessions will build against the claim.
 *
 * Whichever session sets up Vitest should add one line to the suite:
 * `expect(fixtureProblems()).toEqual([])`. As committed it returns an empty array.
 */

import { desirableCoverage, tallyMandatory } from '../contracts';
import type { RequirementFixture, TenderFixture } from './types';

export * from './clock';
export * from './types';
export * from './organisation';
export * from './profile';
export * from './library';
export * from './events';
export * from './extraction';
export * from './evaluation';

export { nhsTender, nhsRequirementsByKey, nhsContractWindow } from './tenders/nhs';
export { camdenTender, camdenRequirementsByKey } from './tenders/camden';
export { leedsTender, leedsRequirementsByKey } from './tenders/leeds';

import { nhsTender } from './tenders/nhs';
import { camdenTender } from './tenders/camden';
import { leedsTender } from './tenders/leeds';

/** Pipeline order: submission deadline ascending (spec §10.1). */
export const demoTenders: TenderFixture[] = [camdenTender, nhsTender, leedsTender];

export const demoTendersByKey: Record<string, TenderFixture> = {
  nhs: nhsTender,
  camden: camdenTender,
  leeds: leedsTender,
};

export function allRequirements(): RequirementFixture[] {
  return demoTenders.flatMap((tender) => tender.requirements);
}

/** The assessment the pipeline and detail screens read — the highest version. */
export function currentAssessment(tender: TenderFixture) {
  return tender.assessments[tender.assessments.length - 1];
}

/* ---------------------------------------------------------------------------
 * Integrity
 * ------------------------------------------------------------------------- */

export interface FixtureProblem {
  tender: string;
  field: string;
  expected: unknown;
  actual: unknown;
}

export function fixtureProblems(): FixtureProblem[] {
  const problems: FixtureProblem[] = [];

  for (const tender of demoTenders) {
    const rows = tender.requirements.map((r) => ({
      obligation: r.obligation,
      verdict: r.expected.verdict,
    }));
    const counts = tallyMandatory(rows);
    const coverage = desirableCoverage(rows);
    const assessment = currentAssessment(tender);

    const checks: [string, unknown, unknown][] = [
      ['mandatoryTotal', assessment.mandatoryTotal, counts.mandatoryTotal],
      ['mandatoryPassed', assessment.mandatoryPassed, counts.mandatoryPassed],
      ['mandatoryFailed', assessment.mandatoryFailed, counts.mandatoryFailed],
      ['mandatoryUnknown', assessment.mandatoryUnknown, counts.mandatoryUnknown],
      ['desirableScore', assessment.desirableScore, coverage],
    ];

    for (const [field, expected, actual] of checks) {
      if (expected !== actual) problems.push({ tender: tender.key, field, expected, actual });
    }

    // Invariant 1: no citation, no requirement.
    const documentKeys = new Set(tender.documents.map((doc) => doc.key));
    for (const requirement of tender.requirements) {
      if (!documentKeys.has(requirement.document)) {
        problems.push({
          tender: tender.key,
          field: 'requirement.document:' + requirement.key,
          expected: [...documentKeys].join('|'),
          actual: requirement.document,
        });
      }
      if (requirement.pageNumber <= 0) {
        problems.push({
          tender: tender.key,
          field: 'requirement.pageNumber:' + requirement.key,
          expected: '> 0',
          actual: requirement.pageNumber,
        });
      }
      if (
        requirement.quotedClause.length < 1 ||
        requirement.quotedClause.length > 1200
      ) {
        problems.push({
          tender: tender.key,
          field: 'requirement.quotedClause:' + requirement.key,
          expected: '1..1200 characters',
          actual: requirement.quotedClause.length,
        });
      }
      // The constraint body must agree with the row's kind.
      if (requirement.constraint.kind !== requirement.kind) {
        problems.push({
          tender: tender.key,
          field: 'requirement.constraint.kind:' + requirement.key,
          expected: requirement.kind,
          actual: requirement.constraint.kind,
        });
      }
    }

    // Keys are unique within a tender, and every reference resolves.
    const requirementKeys = new Set(tender.requirements.map((r) => r.key));
    if (requirementKeys.size !== tender.requirements.length) {
      problems.push({
        tender: tender.key,
        field: 'requirement.key',
        expected: tender.requirements.length,
        actual: requirementKeys.size,
      });
    }
    for (const task of tender.tasks) {
      if (task.requirement && !requirementKeys.has(task.requirement)) {
        problems.push({
          tender: tender.key,
          field: 'task.requirement:' + task.key,
          expected: 'a requirement key',
          actual: task.requirement,
        });
      }
    }
    for (const response of tender.responses) {
      if (!requirementKeys.has(response.requirement)) {
        problems.push({
          tender: tender.key,
          field: 'response.requirement',
          expected: 'a requirement key',
          actual: response.requirement,
        });
      }
    }

    // Assessment versions are 1-based and contiguous.
    tender.assessments.forEach((assessmentRow, index) => {
      if (assessmentRow.version !== index + 1) {
        problems.push({
          tender: tender.key,
          field: 'assessment.version',
          expected: index + 1,
          actual: assessmentRow.version,
        });
      }
    });
  }

  return problems;
}
