/**
 * Golden cases for the qualification engine — spec §9's stated test coverage, plus
 * the edge cases §14 names.
 *
 * Each case is a complete `EvaluationInput` reduced to one requirement, so a
 * failure names exactly one rule. `rationaleIncludes` asserts on substrings rather
 * than whole sentences: the numbers in a rationale are the contract, the prose
 * around them is not.
 *
 * Spec §9 asks for, at minimum, all four verdicts for `certification`, `financial`
 * and `insurance`; the missing financial year; the currency mismatch; a credential
 * expiring between today and the deadline; `expiresOn = null`; and the empty-string
 * word count. All of those are below, marked with the clause they come from.
 */

import {
  recommend,
  type BidRecommendation,
  type CapabilitySnapshot,
  type EvaluableRequirement,
  type EvaluationInput,
  type MandatoryCounts,
  type Obligation,
  type Verdict,
} from '../contracts';
import { DEMO_ASOF, d, t } from './clock';
import { demoSnapshot, demoSnapshotWithEmployersLiability } from './profile';

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

export const emptySnapshot: CapabilitySnapshot = {
  orgId: 'org-under-test',
  headcount: 62,
  registeredRegion: 'England',
  credentials: [],
  financialYears: [],
  insurances: [],
  pastProjects: [],
  policies: [],
};

export function snapshotOf(partial: Partial<CapabilitySnapshot>): CapabilitySnapshot {
  return { ...emptySnapshot, ...partial };
}

export interface RequirementCase {
  name: string;
  /** The spec clause this case exists to hold in place. */
  source: string;
  asOf: Date;
  submissionDeadline: Date | null;
  snapshot: CapabilitySnapshot;
  requirement: EvaluableRequirement;
  expected: {
    verdict: Verdict;
    rationaleIncludes?: string[];
    warningIncludes?: string[];
    /** Number of `EvidenceRef` entries the outcome must carry. */
    evidenceCount?: number;
    /** Of those, how many are marked `counted: true`. */
    countedEvidence?: number;
  };
}

export function toEvaluationInput(testCase: RequirementCase): EvaluationInput {
  return {
    asOf: testCase.asOf,
    submissionDeadline: testCase.submissionDeadline,
    snapshot: testCase.snapshot,
    requirements: [testCase.requirement],
  };
}

const DEADLINE = t('2026-09-14T12:00:00+01:00');

function req(
  id: string,
  kind: EvaluableRequirement['kind'],
  summary: string,
  constraint: EvaluableRequirement['constraint'],
  obligation: Obligation = 'mandatory',
): EvaluableRequirement {
  return { id, kind, obligation, summary, constraint };
}

/* ---------------------------------------------------------------------------
 * certification — all four verdicts, plus the three expiry rules.
 * ------------------------------------------------------------------------- */

export const certificationCases: RequirementCase[] = [
  {
    name: 'held and valid well past the deadline → pass',
    source: '§9 certification',
    asOf: DEMO_ASOF,
    submissionDeadline: DEADLINE,
    snapshot: snapshotOf({
      credentials: [
        {
          id: 'c1',
          code: 'ISO9001',
          reference: 'ISO9001/MER/0912',
          issuedOn: d('2024-12-01'),
          expiresOn: d('2027-11-30'),
        },
      ],
    }),
    requirement: req('r1', 'certification', 'ISO 9001 certification', {
      kind: 'certification',
      credential_code: 'ISO9001',
    }),
    expected: { verdict: 'pass', evidenceCount: 1 },
  },
  {
    name: 'expiresOn null means does not expire → pass',
    source: '§7.4, §9, §14 — null is not missing',
    asOf: DEMO_ASOF,
    submissionDeadline: DEADLINE,
    snapshot: snapshotOf({
      credentials: [
        {
          id: 'c2',
          code: 'ISO14001',
          reference: 'EMS-4471',
          issuedOn: d('2023-06-15'),
          expiresOn: null,
        },
      ],
    }),
    requirement: req('r2', 'certification', 'ISO 14001 certification', {
      kind: 'certification',
      credential_code: 'ISO14001',
    }),
    expected: { verdict: 'pass' },
  },
  {
    name: 'expires 21 days after the deadline → pass with a dated warning',
    source: '§9, §14 — within CREDENTIAL_EXPIRY_WARNING_DAYS after the deadline',
    asOf: DEMO_ASOF,
    submissionDeadline: DEADLINE,
    snapshot: snapshotOf({
      credentials: [
        {
          id: 'c3',
          code: 'CHAS',
          reference: 'CHAS-882140',
          issuedOn: d('2025-10-06'),
          expiresOn: d('2026-10-05'),
        },
      ],
    }),
    requirement: req('r3', 'certification', 'CHAS accreditation', {
      kind: 'certification',
      credential_code: 'CHAS',
    }),
    expected: { verdict: 'pass', warningIncludes: ['5 Oct 2026'] },
  },
  {
    name: 'expires 31 days after the deadline → pass, no warning',
    source: '§9 — just outside the warning window',
    asOf: DEMO_ASOF,
    submissionDeadline: DEADLINE,
    snapshot: snapshotOf({
      credentials: [
        { id: 'c4', code: 'CHAS', reference: null, issuedOn: null, expiresOn: d('2026-10-15') },
      ],
    }),
    requirement: req('r4', 'certification', 'CHAS accreditation', {
      kind: 'certification',
      credential_code: 'CHAS',
    }),
    expected: { verdict: 'pass' },
  },
  {
    name: 'expires between today and the deadline → fail, with the expiry date',
    source: '§9, §14 — the classic technical disqualification',
    asOf: DEMO_ASOF,
    submissionDeadline: DEADLINE,
    snapshot: snapshotOf({
      credentials: [
        { id: 'c5', code: 'ISO9001', reference: null, issuedOn: null, expiresOn: d('2026-09-10') },
      ],
    }),
    requirement: req('r5', 'certification', 'ISO 9001 certification', {
      kind: 'certification',
      credential_code: 'ISO9001',
    }),
    expected: { verdict: 'fail', rationaleIncludes: ['10 Sep 2026'] },
  },
  {
    name: 'already expired before today → fail',
    source: '§9 certification',
    asOf: DEMO_ASOF,
    submissionDeadline: DEADLINE,
    snapshot: snapshotOf({
      credentials: [
        { id: 'c6', code: 'ISO9001', reference: null, issuedOn: null, expiresOn: d('2026-01-31') },
      ],
    }),
    requirement: req('r6', 'certification', 'ISO 9001 certification', {
      kind: 'certification',
      credential_code: 'ISO9001',
    }),
    expected: { verdict: 'fail', rationaleIncludes: ['31 Jan 2026'] },
  },
  {
    name: 'not held at all → fail, because absence is knowable',
    source: '§9 — the profile is a closed world of certifications held',
    asOf: DEMO_ASOF,
    submissionDeadline: DEADLINE,
    snapshot: emptySnapshot,
    requirement: req('r7', 'certification', 'ISO 27001 certification', {
      kind: 'certification',
      credential_code: 'ISO27001',
    }),
    expected: { verdict: 'fail', rationaleIncludes: ['Not held'], evidenceCount: 0 },
  },
  {
    name: 'unrecognised credential code → unknown, raw string preserved',
    source: '§14 row 4 — stored as kind other, never dropped',
    asOf: DEMO_ASOF,
    submissionDeadline: DEADLINE,
    snapshot: demoSnapshot,
    requirement: req(
      'r8',
      'other',
      'ISO 22301 business continuity certification',
      {
        kind: 'other',
        original_kind: 'certification',
        credential_code: 'ISO22301',
        note: 'Credential code is not in credential_types; stored verbatim.',
      },
    ),
    expected: { verdict: 'unknown', rationaleIncludes: ['ISO22301'] },
  },
  {
    name: 'informational obligation → not_applicable',
    source: '§9 verdict semantics — informational carries no obligation',
    asOf: DEMO_ASOF,
    submissionDeadline: DEADLINE,
    snapshot: emptySnapshot,
    requirement: req(
      'r9',
      'certification',
      'The Authority notes that ISO 27001 is held by most incumbent suppliers',
      { kind: 'certification', credential_code: 'ISO27001' },
      'informational',
    ),
    expected: { verdict: 'not_applicable' },
  },
  {
    name: 'no submission deadline recorded → falls back to asOf for validity',
    source: '§7.5 — getSubmissionDeadline can legitimately return null',
    asOf: DEMO_ASOF,
    submissionDeadline: null,
    snapshot: snapshotOf({
      credentials: [
        { id: 'c7', code: 'ISO9001', reference: null, issuedOn: null, expiresOn: d('2026-09-10') },
      ],
    }),
    // Valid at asOf (3 Sep) even though it lapses on the 10th. With no deadline
    // there is nothing to measure against, so this is a pass, not a fail.
    requirement: req('r10', 'certification', 'ISO 9001 certification', {
      kind: 'certification',
      credential_code: 'ISO9001',
    }),
    expected: { verdict: 'pass' },
  },
];

/* ---------------------------------------------------------------------------
 * financial — all four verdicts, the missing year, the null metric, the currency
 * mismatch, and the metrics the snapshot can never answer.
 * ------------------------------------------------------------------------- */

const fy2025 = {
  id: 'fy2025',
  yearEnding: d('2025-03-31'),
  turnover: 4_120_000,
  netAssets: 890_000,
  profitBeforeTax: 212_000,
  currency: 'GBP',
};

const fy2024 = {
  id: 'fy2024',
  yearEnding: d('2024-03-31'),
  turnover: 3_870_000,
  netAssets: 705_000,
  profitBeforeTax: null,
  currency: 'GBP',
};

export const financialCases: RequirementCase[] = [
  {
    name: 'turnover above the threshold → pass',
    source: '§9 financial',
    asOf: DEMO_ASOF,
    submissionDeadline: DEADLINE,
    snapshot: snapshotOf({ financialYears: [fy2025, fy2024] }),
    requirement: req('f1', 'financial', 'Annual turnover ≥ £3,000,000', {
      kind: 'financial',
      metric: 'annual_turnover',
      operator: 'gte',
      value: 3_000_000,
      currency: 'GBP',
      years_required: 1,
    }),
    expected: { verdict: 'pass', evidenceCount: 1 },
  },
  {
    name: 'turnover below the threshold → fail, quantified with the shortfall',
    source: '§9 — "FY2025 turnover £4,120,000 — short by £880,000", never "not met"',
    asOf: DEMO_ASOF,
    submissionDeadline: DEADLINE,
    snapshot: snapshotOf({ financialYears: [fy2025, fy2024] }),
    requirement: req('f2', 'financial', 'Minimum annual turnover £5,000,000', {
      kind: 'financial',
      metric: 'annual_turnover',
      operator: 'gte',
      value: 5_000_000,
      currency: 'GBP',
      years_required: 1,
    }),
    expected: {
      verdict: 'fail',
      rationaleIncludes: ['FY2025', '£4,120,000', '£880,000'],
      evidenceCount: 1,
    },
  },
  {
    name: 'a required year is not filed → unknown, naming the year',
    source: '§9 — we cannot see what was never entered',
    asOf: DEMO_ASOF,
    submissionDeadline: DEADLINE,
    snapshot: snapshotOf({ financialYears: [fy2025, fy2024] }),
    requirement: req('f3', 'financial', 'Net assets ≥ £500,000 for three years', {
      kind: 'financial',
      metric: 'net_assets',
      operator: 'gte',
      value: 500_000,
      currency: 'GBP',
      years_required: 3,
      basis: 'each_year',
    }),
    expected: { verdict: 'unknown', rationaleIncludes: ['FY2023'] },
  },
  {
    name: 'the year is filed but the metric is null → unknown, naming the year',
    source: '§7.4 — a null metric is the case the product is built on',
    asOf: DEMO_ASOF,
    submissionDeadline: DEADLINE,
    snapshot: snapshotOf({ financialYears: [fy2025, fy2024] }),
    requirement: req('f4', 'financial', 'Profit before tax positive for two years', {
      kind: 'financial',
      metric: 'profit_before_tax',
      operator: 'gt',
      value: 0,
      currency: 'GBP',
      years_required: 2,
      basis: 'each_year',
    }),
    expected: { verdict: 'unknown', rationaleIncludes: ['FY2024'] },
  },
  {
    name: 'currency mismatch → unknown, never a silent conversion',
    source: '§9, §14 — no invented exchange rate, ever',
    asOf: DEMO_ASOF,
    submissionDeadline: DEADLINE,
    snapshot: snapshotOf({ financialYears: [fy2025, fy2024] }),
    requirement: req('f5', 'financial', 'Annual turnover ≥ €4,000,000', {
      kind: 'financial',
      metric: 'annual_turnover',
      operator: 'gte',
      value: 4_000_000,
      currency: 'EUR',
      years_required: 1,
    }),
    expected: { verdict: 'unknown', rationaleIncludes: ['EUR', 'GBP'] },
  },
  {
    name: 'metric the snapshot cannot hold → unknown',
    source: '§9 / METRICS_NOT_IN_SNAPSHOT — credit_score has no column',
    asOf: DEMO_ASOF,
    submissionDeadline: DEADLINE,
    snapshot: snapshotOf({ financialYears: [fy2025, fy2024] }),
    requirement: req('f6', 'financial', 'Credit score ≥ 70', {
      kind: 'financial',
      metric: 'credit_score',
      operator: 'gte',
      value: 70,
      years_required: 1,
    }),
    expected: { verdict: 'unknown', rationaleIncludes: ['credit score'] },
  },
  {
    name: 'no financial years at all → unknown, not fail',
    source: '§9 — an empty profile is not a failing profile',
    asOf: DEMO_ASOF,
    submissionDeadline: DEADLINE,
    snapshot: emptySnapshot,
    requirement: req('f7', 'financial', 'Annual turnover ≥ £1,000,000', {
      kind: 'financial',
      metric: 'annual_turnover',
      operator: 'gte',
      value: 1_000_000,
      currency: 'GBP',
      years_required: 1,
    }),
    expected: { verdict: 'unknown' },
  },
  {
    name: 'average basis across two filed years → pass',
    source: '§9 financial, basis average — (4,120,000 + 3,870,000) / 2 = 3,995,000',
    asOf: DEMO_ASOF,
    submissionDeadline: DEADLINE,
    snapshot: snapshotOf({ financialYears: [fy2025, fy2024] }),
    requirement: req('f8', 'financial', 'Average annual turnover ≥ £3,000,000', {
      kind: 'financial',
      metric: 'annual_turnover',
      operator: 'gte',
      value: 3_000_000,
      currency: 'GBP',
      years_required: 2,
      basis: 'average',
    }),
    expected: { verdict: 'pass', evidenceCount: 2 },
  },
  {
    name: 'average basis just short → fail',
    source: '§9 financial, basis average — 3,995,000 against 4,000,000',
    asOf: DEMO_ASOF,
    submissionDeadline: DEADLINE,
    snapshot: snapshotOf({ financialYears: [fy2025, fy2024] }),
    requirement: req('f9', 'financial', 'Average annual turnover ≥ £4,000,000', {
      kind: 'financial',
      metric: 'annual_turnover',
      operator: 'gte',
      value: 4_000_000,
      currency: 'GBP',
      years_required: 2,
      basis: 'average',
    }),
    expected: { verdict: 'fail', rationaleIncludes: ['£3,995,000', '£5,000'] },
  },
  {
    name: 'any_year basis — one qualifying year is enough → pass',
    source: '§9 financial, basis any_year',
    asOf: DEMO_ASOF,
    submissionDeadline: DEADLINE,
    snapshot: snapshotOf({ financialYears: [fy2025, fy2024] }),
    requirement: req('f10', 'financial', 'Turnover ≥ £4,000,000 in any of the last two years', {
      kind: 'financial',
      metric: 'annual_turnover',
      operator: 'gte',
      value: 4_000_000,
      currency: 'GBP',
      years_required: 2,
      basis: 'any_year',
    }),
    expected: { verdict: 'pass' },
  },
  {
    name: 'informational obligation → not_applicable',
    source: '§9 verdict semantics',
    asOf: DEMO_ASOF,
    submissionDeadline: DEADLINE,
    snapshot: snapshotOf({ financialYears: [fy2025] }),
    requirement: req(
      'f11',
      'financial',
      'The estimated annual contract value is £600,000',
      {
        kind: 'financial',
        metric: 'annual_turnover',
        operator: 'gte',
        value: 600_000,
        currency: 'GBP',
      },
      'informational',
    ),
    expected: { verdict: 'not_applicable' },
  },
];

/* ---------------------------------------------------------------------------
 * insurance — the one that differs from certification on purpose.
 * ------------------------------------------------------------------------- */

export const insuranceCases: RequirementCase[] = [
  {
    name: 'cover above the minimum and in force → pass',
    source: '§9 insurance',
    asOf: DEMO_ASOF,
    submissionDeadline: DEADLINE,
    snapshot: snapshotOf({
      insurances: [
        {
          id: 'i1',
          kind: 'public_liability',
          coverAmount: 10_000_000,
          currency: 'GBP',
          insurer: 'Zurich Municipal',
          expiresOn: d('2027-03-31'),
        },
      ],
    }),
    requirement: req('n1', 'insurance', 'Public liability ≥ £5,000,000', {
      kind: 'insurance',
      insurance_kind: 'public_liability',
      min_cover: 5_000_000,
      currency: 'GBP',
    }),
    expected: { verdict: 'pass', evidenceCount: 1 },
  },
  {
    name: 'cover exactly at the minimum → pass',
    source: '§9 insurance — gte boundary; compareMoney must not lose a penny',
    asOf: DEMO_ASOF,
    submissionDeadline: DEADLINE,
    snapshot: snapshotOf({
      insurances: [
        {
          id: 'i2',
          kind: 'public_liability',
          coverAmount: 10_000_000,
          currency: 'GBP',
          insurer: null,
          expiresOn: d('2027-03-31'),
        },
      ],
    }),
    requirement: req('n2', 'insurance', 'Public liability ≥ £10,000,000', {
      kind: 'insurance',
      insurance_kind: 'public_liability',
      min_cover: 10_000_000,
      currency: 'GBP',
    }),
    expected: { verdict: 'pass' },
  },
  {
    name: 'cover below the minimum → fail, quantified',
    source: '§9 insurance',
    asOf: DEMO_ASOF,
    submissionDeadline: DEADLINE,
    snapshot: snapshotOf({
      insurances: [
        {
          id: 'i3',
          kind: 'professional_indemnity',
          coverAmount: 5_000_000,
          currency: 'GBP',
          insurer: 'Hiscox',
          expiresOn: d('2027-03-31'),
        },
      ],
    }),
    requirement: req('n3', 'insurance', 'Professional indemnity ≥ £10,000,000', {
      kind: 'insurance',
      insurance_kind: 'professional_indemnity',
      min_cover: 10_000_000,
      currency: 'GBP',
    }),
    expected: { verdict: 'fail', rationaleIncludes: ['£5,000,000', '£10,000,000'] },
  },
  {
    name: 'policy expired before the deadline → fail',
    source: '§9 insurance — cover must be in force at the deadline',
    asOf: DEMO_ASOF,
    submissionDeadline: DEADLINE,
    snapshot: snapshotOf({
      insurances: [
        {
          id: 'i4',
          kind: 'public_liability',
          coverAmount: 10_000_000,
          currency: 'GBP',
          insurer: null,
          expiresOn: d('2026-09-09'),
        },
      ],
    }),
    requirement: req('n4', 'insurance', 'Public liability ≥ £5,000,000', {
      kind: 'insurance',
      insurance_kind: 'public_liability',
      min_cover: 5_000_000,
      currency: 'GBP',
    }),
    expected: { verdict: 'fail', rationaleIncludes: ['9 Sep 2026'] },
  },
  {
    name: 'no policy of that kind recorded → unknown, NOT fail',
    source:
      '§9 — an uninsured company and a company that has not filled in the form look ' +
      'identical from here. This is the case that separates insurance from certification.',
    asOf: DEMO_ASOF,
    submissionDeadline: DEADLINE,
    snapshot: demoSnapshot,
    requirement: req('n5', 'insurance', "Employers' liability ≥ £10,000,000", {
      kind: 'insurance',
      insurance_kind: 'employers_liability',
      min_cover: 10_000_000,
      currency: 'GBP',
    }),
    expected: { verdict: 'unknown', rationaleIncludes: ['No employers’ liability policy'] },
  },
  {
    name: 'currency mismatch on cover → unknown',
    source: '§14 — never a silent conversion at an invented rate',
    asOf: DEMO_ASOF,
    submissionDeadline: DEADLINE,
    snapshot: snapshotOf({
      insurances: [
        {
          id: 'i5',
          kind: 'public_liability',
          coverAmount: 10_000_000,
          currency: 'GBP',
          insurer: null,
          expiresOn: d('2027-03-31'),
        },
      ],
    }),
    requirement: req('n6', 'insurance', 'Public liability ≥ €8,000,000', {
      kind: 'insurance',
      insurance_kind: 'public_liability',
      min_cover: 8_000_000,
      currency: 'EUR',
    }),
    expected: { verdict: 'unknown', rationaleIncludes: ['EUR', 'GBP'] },
  },
  {
    name: 'informational obligation → not_applicable',
    source: '§9 verdict semantics',
    asOf: DEMO_ASOF,
    submissionDeadline: DEADLINE,
    snapshot: emptySnapshot,
    requirement: req(
      'n7',
      'insurance',
      'The Authority holds its own contract works cover',
      { kind: 'insurance', insurance_kind: 'contract_works', min_cover: 0, currency: 'GBP' },
      'informational',
    ),
    expected: { verdict: 'not_applicable' },
  },
];

/* ---------------------------------------------------------------------------
 * experience — the kind whose evidence the user actually reads.
 * ------------------------------------------------------------------------- */

export const experienceCases: RequirementCase[] = [
  {
    name: 'enough matching projects → pass, evidence marks which counted',
    source: '§9 experience — the user sees which ones counted and which fell short',
    asOf: DEMO_ASOF,
    submissionDeadline: DEADLINE,
    snapshot: demoSnapshot,
    requirement: req('e1', 'experience', 'Three contracts ≥ £400,000 in the last 36 months', {
      kind: 'experience',
      min_count: 3,
      min_value: 400_000,
      currency: 'GBP',
      within_last_months: 36,
    }),
    // All nine projects come back as evidence; six of them satisfy every filter.
    expected: { verdict: 'pass', evidenceCount: 9, countedEvidence: 6 },
  },
  {
    name: 'not enough matching projects → fail, saying how many were found',
    source: '§9 experience',
    asOf: DEMO_ASOF,
    submissionDeadline: DEADLINE,
    snapshot: demoSnapshot,
    requirement: req('e2', 'experience', 'Two contracts ≥ £1,500,000', {
      kind: 'experience',
      min_count: 2,
      min_value: 1_500_000,
      currency: 'GBP',
    }),
    expected: { verdict: 'fail', rationaleIncludes: ['£1,500,000'], countedEvidence: 0 },
  },
  {
    name: 'ongoing project counts as recent',
    source: '§9 / ExperienceConstraint.within_last_months — endedOn null means ongoing',
    asOf: DEMO_ASOF,
    submissionDeadline: DEADLINE,
    snapshot: snapshotOf({
      pastProjects: [
        {
          id: 'p1',
          clientName: 'Northern Care Alliance NHS Foundation Trust',
          title: 'Ward cleaning and portering',
          contractValue: 980_000,
          currency: 'GBP',
          sector: 'healthcare',
          startedOn: d('2023-09-01'),
          endedOn: null,
          isPublicSector: true,
          refereeContactable: true,
        },
      ],
    }),
    requirement: req('e3', 'experience', 'One healthcare contract in the last 12 months', {
      kind: 'experience',
      min_count: 1,
      sector: 'healthcare',
      within_last_months: 12,
    }),
    expected: { verdict: 'pass', countedEvidence: 1 },
  },
  {
    name: 'project ended outside the window → not counted',
    source: '§9 experience — recency measured from endedOn',
    asOf: DEMO_ASOF,
    submissionDeadline: DEADLINE,
    snapshot: snapshotOf({
      pastProjects: [
        {
          id: 'p2',
          clientName: 'The Co-operative Group',
          title: 'Retail cleaning',
          contractValue: 265_000,
          currency: 'GBP',
          sector: 'retail',
          startedOn: d('2021-03-01'),
          endedOn: d('2023-02-28'),
          isPublicSector: false,
          refereeContactable: false,
        },
      ],
    }),
    requirement: req('e4', 'experience', 'One contract in the last 36 months', {
      kind: 'experience',
      min_count: 1,
      within_last_months: 36,
    }),
    expected: { verdict: 'fail', countedEvidence: 0 },
  },
];

/* ---------------------------------------------------------------------------
 * policy — pass, pass with a warning, fail. There is no unknown here: a policy is
 * either recorded or it is not.
 * ------------------------------------------------------------------------- */

export const policyCases: RequirementCase[] = [
  {
    name: 'policy exists and was reviewed recently → pass',
    source: '§9 policy',
    asOf: DEMO_ASOF,
    submissionDeadline: DEADLINE,
    snapshot: snapshotOf({
      policies: [
        {
          id: 'y1',
          policyType: 'health_safety',
          title: 'Health & Safety Policy',
          lastReviewed: d('2026-02-10'),
        },
      ],
    }),
    requirement: req('y1', 'policy', 'Health and safety policy', {
      kind: 'policy',
      policy_type: 'health_safety',
    }),
    expected: { verdict: 'pass' },
  },
  {
    name: 'policy exists but is 31 months old → pass with a warning',
    source: '§9 — over POLICY_REVIEW_WARNING_MONTHS is a warning, never a fail',
    asOf: DEMO_ASOF,
    submissionDeadline: DEADLINE,
    snapshot: snapshotOf({
      policies: [
        {
          id: 'y2',
          policyType: 'modern_slavery',
          title: 'Modern Slavery & Human Trafficking Statement',
          lastReviewed: d('2024-02-01'),
        },
      ],
    }),
    requirement: req('y2', 'policy', 'Modern slavery statement', {
      kind: 'policy',
      policy_type: 'modern_slavery',
    }),
    expected: { verdict: 'pass', warningIncludes: ['31 months'] },
  },
  {
    name: 'policy exists with no review date → pass, no warning',
    source: '§9 — lastReviewed is optional and its absence is not a defect',
    asOf: DEMO_ASOF,
    submissionDeadline: DEADLINE,
    snapshot: snapshotOf({
      policies: [{ id: 'y3', policyType: 'equality', title: null, lastReviewed: null }],
    }),
    requirement: req('y3', 'policy', 'Equality and diversity policy', {
      kind: 'policy',
      policy_type: 'equality',
    }),
    expected: { verdict: 'pass' },
  },
  {
    name: 'policy of that type absent → fail',
    source: '§9 policy — absence is knowable',
    asOf: DEMO_ASOF,
    submissionDeadline: DEADLINE,
    snapshot: demoSnapshot,
    requirement: req('y4', 'policy', 'Data protection policy', {
      kind: 'policy',
      policy_type: 'data_protection',
    }),
    expected: { verdict: 'fail' },
  },
];

/* ---------------------------------------------------------------------------
 * The kinds that never bear on eligibility.
 * ------------------------------------------------------------------------- */

export const notApplicableCases: RequirementCase[] = [
  {
    name: 'question → not_applicable, routed to the workspace',
    source: '§9 per-kind logic',
    asOf: DEMO_ASOF,
    submissionDeadline: DEADLINE,
    snapshot: demoSnapshot,
    requirement: req('a1', 'question', 'Method Statement 1 — Mobilisation', {
      kind: 'question',
      response_format: 'method_statement',
    }),
    expected: { verdict: 'not_applicable' },
  },
  {
    name: 'date → not_applicable, routed to KeyDate',
    source: '§9 per-kind logic',
    asOf: DEMO_ASOF,
    submissionDeadline: DEADLINE,
    snapshot: demoSnapshot,
    requirement: req('a2', 'date', 'Tender submission closes 14 Sep 2026', {
      kind: 'date',
      date_kind: 'submission_deadline',
      occurs_at: '2026-09-14T12:00:00+01:00',
    }),
    expected: { verdict: 'not_applicable' },
  },
  {
    name: 'legal_status → not_applicable, self-declared',
    source: '§9 per-kind logic',
    asOf: DEMO_ASOF,
    submissionDeadline: DEADLINE,
    snapshot: demoSnapshot,
    requirement: req('a3', 'legal_status', 'No mandatory exclusion grounds apply', {
      kind: 'legal_status',
      statement: 'Not subject to a mandatory exclusion ground under Schedule 6.',
    }),
    expected: { verdict: 'not_applicable' },
  },
  {
    name: 'resource → not_applicable in v1, even though headcount is in the snapshot',
    source: '§9 per-kind logic, §7.4 evidence surface',
    asOf: DEMO_ASOF,
    submissionDeadline: DEADLINE,
    snapshot: demoSnapshot,
    requirement: req('a4', 'resource', 'Minimum 40 directly employed operatives', {
      kind: 'resource',
      description: 'Minimum 40 directly employed operatives',
      min_headcount: 40,
    }),
    expected: { verdict: 'not_applicable' },
  },
];

export const allRequirementCases: RequirementCase[] = [
  ...certificationCases,
  ...financialCases,
  ...insuranceCases,
  ...experienceCases,
  ...policyCases,
  ...notApplicableCases,
];

/* ---------------------------------------------------------------------------
 * recommend() — the whole truth table. Three lines of code, and these are all of
 * the inputs that matter.
 * ------------------------------------------------------------------------- */

export const recommendationCases: { counts: MandatoryCounts; expected: BidRecommendation }[] = [
  {
    counts: { mandatoryTotal: 26, mandatoryPassed: 21, mandatoryFailed: 2, mandatoryUnknown: 3 },
    expected: 'no_bid',
  },
  {
    counts: { mandatoryTotal: 19, mandatoryPassed: 16, mandatoryFailed: 0, mandatoryUnknown: 3 },
    expected: 'review',
  },
  {
    counts: { mandatoryTotal: 24, mandatoryPassed: 24, mandatoryFailed: 0, mandatoryUnknown: 0 },
    expected: 'bid',
  },
  {
    // A failure outranks an unknown. There is nothing to review when a gate is shut.
    counts: { mandatoryTotal: 10, mandatoryPassed: 8, mandatoryFailed: 1, mandatoryUnknown: 1 },
    expected: 'no_bid',
  },
  {
    // No mandatory requirements at all. Vacuously a bid.
    counts: { mandatoryTotal: 0, mandatoryPassed: 0, mandatoryFailed: 0, mandatoryUnknown: 0 },
    expected: 'bid',
  },
];

/** Sanity: the fixture's own expectations agree with the frozen implementation. */
export const recommendationCasesHold = recommendationCases.every(
  (c) => recommend(c.counts) === c.expected,
);

/* ---------------------------------------------------------------------------
 * desirableCoverage()
 * ------------------------------------------------------------------------- */

export const desirableCoverageCases: {
  name: string;
  rows: { obligation: Obligation; verdict: Verdict }[];
  expected: number | null;
}[] = [
  {
    name: 'NHS — 2 of 8 desirable criteria pass',
    rows: [
      { obligation: 'desirable', verdict: 'pass' },
      { obligation: 'desirable', verdict: 'pass' },
      { obligation: 'desirable', verdict: 'fail' },
      { obligation: 'desirable', verdict: 'fail' },
      { obligation: 'desirable', verdict: 'fail' },
      { obligation: 'desirable', verdict: 'fail' },
      { obligation: 'desirable', verdict: 'unknown' },
      { obligation: 'desirable', verdict: 'unknown' },
      { obligation: 'mandatory', verdict: 'pass' },
    ],
    expected: 25.0,
  },
  {
    name: 'Leeds — 4 of 9',
    rows: [
      ...Array.from({ length: 4 }, () => ({ obligation: 'desirable' as const, verdict: 'pass' as const })),
      ...Array.from({ length: 3 }, () => ({ obligation: 'desirable' as const, verdict: 'fail' as const })),
      ...Array.from({ length: 2 }, () => ({ obligation: 'desirable' as const, verdict: 'unknown' as const })),
    ],
    expected: 44.44,
  },
  {
    name: 'not_applicable desirables are not scoreable',
    rows: [
      { obligation: 'desirable', verdict: 'pass' },
      { obligation: 'desirable', verdict: 'not_applicable' },
    ],
    expected: 100.0,
  },
  {
    name: 'no desirable requirements → null, not zero',
    rows: [{ obligation: 'mandatory', verdict: 'pass' }],
    expected: null,
  },
  {
    name: 'every desirable is not_applicable → null',
    rows: [{ obligation: 'desirable', verdict: 'not_applicable' }],
    expected: null,
  },
];

/* ---------------------------------------------------------------------------
 * countWords() — spec §7.7. The empty string is the first case, because the old
 * schema's generated column claimed one word for every empty draft.
 * ------------------------------------------------------------------------- */

export const wordCountCases: { body: string; expected: number }[] = [
  { body: '', expected: 0 },
  { body: '   ', expected: 0 },
  { body: '\n\n\t  \n', expected: 0 },
  { body: 'one', expected: 1 },
  { body: '  one  ', expected: 1 },
  { body: 'two words', expected: 2 },
  { body: 'two   words', expected: 2 },
  { body: 'line one\nline two', expected: 4 },
  { body: 'hyphen-joined counts once', expected: 3 },
];

/* ---------------------------------------------------------------------------
 * The whole-tender runs. These are the acceptance tests for `evaluate()`, and
 * `nhsAfterProfileEdit` is step 5 of the 90-second reviewer path: the unknown
 * resolves, and the verdict does not move.
 * ------------------------------------------------------------------------- */

export interface TenderEvaluationCase {
  name: string;
  tender: 'nhs' | 'camden' | 'leeds';
  snapshot: CapabilitySnapshot;
  expected: MandatoryCounts & {
    recommendation: BidRecommendation;
    desirableScore: number | null;
  };
}

export const tenderEvaluationCases: TenderEvaluationCase[] = [
  {
    name: 'NHS at v2 — two blocking failures',
    tender: 'nhs',
    snapshot: demoSnapshot,
    expected: {
      recommendation: 'no_bid',
      mandatoryTotal: 26,
      mandatoryPassed: 21,
      mandatoryFailed: 2,
      mandatoryUnknown: 3,
      desirableScore: 25.0,
    },
  },
  {
    name: 'Camden — no failures, three unknowns',
    tender: 'camden',
    snapshot: demoSnapshot,
    expected: {
      recommendation: 'review',
      mandatoryTotal: 19,
      mandatoryPassed: 16,
      mandatoryFailed: 0,
      mandatoryUnknown: 3,
      desirableScore: 40.0,
    },
  },
  {
    name: 'Leeds — all gates clear',
    tender: 'leeds',
    snapshot: demoSnapshot,
    expected: {
      recommendation: 'bid',
      mandatoryTotal: 24,
      mandatoryPassed: 24,
      mandatoryFailed: 0,
      mandatoryUnknown: 0,
      desirableScore: 44.44,
    },
  },
  {
    // Spec §13, step 5. The employers' liability unknown becomes a pass; the
    // certification failure and the turnover failure do not move, so the verdict
    // stays no_bid. This is the assertion that proves the engine is arithmetic.
    name: 'NHS after the reviewer adds employers’ liability — unknown resolves, verdict holds',
    tender: 'nhs',
    snapshot: demoSnapshotWithEmployersLiability,
    expected: {
      recommendation: 'no_bid',
      mandatoryTotal: 26,
      mandatoryPassed: 22,
      mandatoryFailed: 2,
      mandatoryUnknown: 2,
      desirableScore: 25.0,
    },
  },
];
