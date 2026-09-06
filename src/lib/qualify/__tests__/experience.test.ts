import { describe, expect, it } from 'vitest';
import { DEMO_ASOF, demoSnapshot, experienceCases, snapshotOf } from '../../../../fixtures';
import { evaluate } from '../evaluate';
import { expectCase, runCase } from './run-case';

describe('experience', () => {
  for (const testCase of experienceCases) {
    it(`${testCase.name} (${testCase.source})`, () => {
      expectCase(testCase);
    });
  }

  it('returns every project in the snapshot, counted or not — spec §9', () => {
    const outcome = runCase(experienceCases[0]);
    expect(outcome.evidence).toHaveLength(demoSnapshot.pastProjects.length);
    for (const ref of outcome.evidence) {
      expect(ref.source).toBe('past_project');
      expect(typeof ref.counted).toBe('boolean');
    }
    expect(new Set(outcome.evidence.map((ref) => ref.id))).toEqual(
      new Set(demoSnapshot.pastProjects.map((project) => project.id)),
    );
  });

  it('says why a project fell short, on the project itself', () => {
    const outcome = runCase(experienceCases[0]);
    const peel = outcome.evidence.find((ref) => ref.id === 'proj-peel');
    expect(peel?.counted).toBe(false);
    expect(peel?.detail).toContain('£180,000 is under £400,000');

    const mft = outcome.evidence.find((ref) => ref.id === 'proj-mft');
    expect(mft?.counted).toBe(true);
    expect(mft?.detail).toBe('£1,400,000 · ended Mar 2025 · healthcare · public sector');
  });

  it('names the nearest miss when a value gate is what shut the door', () => {
    const outcome = runCase(experienceCases[1]);
    expect(outcome.rationale).toContain('Largest recorded contract is £1,400,000');
    expect(outcome.rationale).toContain('Manchester University NHS Foundation Trust');
    expect(outcome.rationale).toContain('short by £100,000');
  });

  it('cannot decide when a project without a recorded value could still carry the count', () => {
    const result = evaluate({
      asOf: DEMO_ASOF,
      submissionDeadline: null,
      snapshot: snapshotOf({
        pastProjects: [
          {
            id: 'p-unpriced',
            clientName: 'Bruntwood',
            title: 'Office cleaning',
            contractValue: null,
            currency: 'GBP',
            sector: 'commercial',
            startedOn: null,
            endedOn: null,
            isPublicSector: false,
            refereeContactable: false,
          },
        ],
      }),
      requirements: [
        {
          id: 'x',
          kind: 'experience',
          obligation: 'mandatory',
          summary: 'One contract ≥ £500,000',
          constraint: { kind: 'experience', min_count: 1, min_value: 500_000, currency: 'GBP' },
        },
      ],
    });
    expect(result.results[0].verdict).toBe('unknown');
    expect(result.results[0].rationale).toContain('no contract value recorded');
    expect(result.results[0].evidence[0].counted).toBe(false);
  });

  it('is a fail, not an unknown, when no project is recorded at all', () => {
    const result = evaluate({
      asOf: DEMO_ASOF,
      submissionDeadline: null,
      snapshot: snapshotOf({ pastProjects: [] }),
      requirements: [
        {
          id: 'x',
          kind: 'experience',
          obligation: 'mandatory',
          summary: 'Three comparable contracts',
          constraint: { kind: 'experience', min_count: 3 },
        },
      ],
    });
    expect(result.results[0].verdict).toBe('fail');
    expect(result.results[0].evidence).toEqual([]);
  });
});
