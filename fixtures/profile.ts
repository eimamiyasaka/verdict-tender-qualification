/**
 * Meridian's capability tables — the entire evidence surface `evaluate()` reads
 * (spec §7.4), plus a ready-made `CapabilitySnapshot` for tests that do not want
 * to go through the database.
 *
 * Read this file next to `tenders/*.ts`: every verdict in the demo is a
 * consequence of exactly what is and is not here.
 */

import type { CapabilitySnapshot } from '../contracts';
import { d } from './clock';
import { demoOrganisation } from './organisation';
import type {
  CredentialFixture,
  FinancialYearFixture,
  InsuranceFixture,
  PastProjectFixture,
  PolicyFixture,
} from './types';

/* ---------------------------------------------------------------------------
 * Credentials — four held. ISO 27001 is deliberately absent; it is the NHS
 * tender's first blocking failure and the reason the demo lands.
 * ------------------------------------------------------------------------- */

export const demoCredentials: CredentialFixture[] = [
  {
    key: 'cred-iso9001',
    code: 'ISO9001',
    reference: 'ISO9001/MER/0912',
    issuedOn: d('2024-12-01'),
    expiresOn: d('2027-11-30'),
    evidenceUrl: null,
  },
  {
    key: 'cred-iso14001',
    code: 'ISO14001',
    reference: 'EMS-4471',
    issuedOn: d('2023-06-15'),
    expiresOn: null,
    note:
      'expiresOn null exercises spec §9 and §14: null means DOES NOT EXPIRE and must ' +
      'evaluate to pass. It is the one row that catches an engine treating null as missing.',
  },
  {
    key: 'cred-chas',
    code: 'CHAS',
    reference: 'CHAS-882140',
    issuedOn: d('2025-10-06'),
    expiresOn: d('2026-10-05'),
    note:
      'Expires 21 days after the NHS deadline, 28 after Camden, 13 after Leeds — inside ' +
      'CREDENTIAL_EXPIRY_WARNING_DAYS for all three, so every tender shows a pass with a dated warning.',
  },
  {
    key: 'cred-cyber-essentials',
    code: 'CYBER_ESSENTIALS',
    reference: 'CE-2026-33810',
    issuedOn: d('2026-04-01'),
    expiresOn: d('2027-03-31'),
  },
  // Not held, and each absence is load-bearing somewhere in the demo:
  //   ISO27001              -> NHS blocking failure
  //   CYBER_ESSENTIALS_PLUS -> desirable failure on NHS and Leeds
  //   ISO45001              -> desirable failure on all three
  //   CONSTRUCTIONLINE      -> desirable failure on NHS and Leeds
  //   SAFECONTRACTOR        -> desirable failure on Camden
];

/* ---------------------------------------------------------------------------
 * Financial years — two filed. FY2023 is absent and FY2024's profit before tax is
 * null. Those two gaps are the whole `unknown` story: we cannot see what was never
 * entered, and saying so is different from saying the company failed.
 * ------------------------------------------------------------------------- */

export const demoFinancialYears: FinancialYearFixture[] = [
  {
    key: 'fy2025',
    yearEnding: d('2025-03-31'),
    turnover: 4_120_000,
    netAssets: 890_000,
    profitBeforeTax: 212_000,
    currency: 'GBP',
    note: 'Turnover is a near miss against the NHS £5,000,000 gate — short by £880,000.',
  },
  {
    key: 'fy2024',
    yearEnding: d('2024-03-31'),
    turnover: 3_870_000,
    netAssets: 705_000,
    profitBeforeTax: null,
    currency: 'GBP',
    note:
      'profitBeforeTax null is the "row exists, metric missing" case: unknown, naming the year. ' +
      'It must not be read as zero, and it must not be read as a loss.',
  },
  // FY2023 (year ending 31 Mar 2023) is not filed. Any requirement asking for three
  // years is unknown, naming FY2023 — never a fail.
];

/* ---------------------------------------------------------------------------
 * Insurance — two policies. No employers' liability row exists at all, which is
 * the demo's second act: spec §9 makes that `unknown`, not `fail`, because an
 * uninsured company and a company that has not filled in the form look identical
 * from here. Adding it in step 4 of the reviewer path resolves the unknown and
 * leaves the no-bid standing.
 * ------------------------------------------------------------------------- */

export const demoInsurances: InsuranceFixture[] = [
  {
    key: 'ins-public-liability',
    kind: 'public_liability',
    coverAmount: 10_000_000,
    currency: 'GBP',
    insurer: 'Zurich Municipal',
    expiresOn: d('2027-03-31'),
  },
  {
    key: 'ins-professional-indemnity',
    kind: 'professional_indemnity',
    coverAmount: 5_000_000,
    currency: 'GBP',
    insurer: 'Hiscox',
    expiresOn: d('2027-03-31'),
  },
];

/**
 * What the reviewer adds at step 4 of the 90-second path (spec §13). Seeding this
 * is wrong — the demo depends on it being absent — but the profile form's test and
 * the "re-run resolves the unknown, the verdict stays no-bid" assertion both need
 * the exact row.
 */
export const employersLiabilityToAdd: InsuranceFixture = {
  key: 'ins-employers-liability',
  kind: 'employers_liability',
  coverAmount: 10_000_000,
  currency: 'GBP',
  insurer: 'Zurich Municipal',
  expiresOn: d('2027-03-31'),
};

/* ---------------------------------------------------------------------------
 * Past projects — nine, six public sector, £180k to £1.4m.
 *
 * The value ceiling matters: the largest contract is £1,400,000, so a desirable
 * requirement asking for £1,500,000 fails honestly rather than by accident.
 * ------------------------------------------------------------------------- */

export const demoPastProjects: PastProjectFixture[] = [
  {
    key: 'proj-mft',
    clientName: 'Manchester University NHS Foundation Trust',
    title: 'Cleaning and domestic services — three acute sites',
    description:
      'Daily cleaning across three acute hospital sites, including theatres and isolation areas, to NHS National Standards of Healthcare Cleanliness.',
    contractValue: 1_400_000,
    currency: 'GBP',
    sector: 'healthcare',
    startedOn: d('2022-04-01'),
    endedOn: d('2025-03-31'),
    isPublicSector: true,
    refereeContactable: true,
  },
  {
    key: 'proj-nca',
    clientName: 'Northern Care Alliance NHS Foundation Trust',
    title: 'Ward cleaning and portering',
    description: 'Ward cleaning, portering and waste stream management across two hospitals.',
    contractValue: 980_000,
    currency: 'GBP',
    sector: 'healthcare',
    startedOn: d('2023-09-01'),
    endedOn: null,
    isPublicSector: true,
    refereeContactable: true,
  },
  {
    key: 'proj-leeds-cc',
    clientName: 'Leeds City Council',
    title: 'Grounds maintenance — north and east districts',
    description: 'Grass cutting, shrub bed maintenance and seasonal planting across 140 sites.',
    contractValue: 620_000,
    currency: 'GBP',
    sector: 'local_government',
    startedOn: d('2021-06-01'),
    endedOn: d('2024-05-31'),
    isPublicSector: true,
    refereeContactable: true,
  },
  {
    key: 'proj-salford',
    clientName: 'University of Salford',
    title: 'Soft FM — campus cleaning and waste',
    description: 'Cleaning, waste and recycling across teaching, residential and library estate.',
    contractValue: 845_000,
    currency: 'GBP',
    sector: 'education',
    startedOn: d('2023-01-01'),
    endedOn: null,
    isPublicSector: true,
    refereeContactable: true,
  },
  {
    key: 'proj-mmu',
    clientName: 'Manchester Metropolitan University',
    title: 'Cleaning services — All Saints campus',
    description: 'Cleaning of teaching and laboratory space, including out-of-hours cover.',
    contractValue: 510_000,
    currency: 'GBP',
    sector: 'education',
    startedOn: d('2020-09-01'),
    endedOn: d('2024-08-31'),
    isPublicSector: true,
    refereeContactable: false,
  },
  {
    key: 'proj-trafford',
    clientName: 'Trafford Council',
    title: 'Street cleansing and public realm',
    description: 'Mechanical sweeping, litter picking and fly-tipping response.',
    contractValue: 430_000,
    currency: 'GBP',
    sector: 'local_government',
    startedOn: d('2022-01-01'),
    endedOn: d('2025-12-31'),
    isPublicSector: true,
    refereeContactable: true,
  },
  {
    key: 'proj-bruntwood',
    clientName: 'Bruntwood',
    title: 'Office cleaning — Manchester city centre portfolio',
    description: 'Daily office cleaning across eleven multi-tenant buildings.',
    contractValue: 310_000,
    currency: 'GBP',
    sector: 'commercial',
    startedOn: d('2024-01-01'),
    endedOn: null,
    isPublicSector: false,
    refereeContactable: false,
  },
  {
    key: 'proj-coop',
    clientName: 'The Co-operative Group',
    title: 'Retail cleaning — north west stores',
    description: 'Overnight cleaning across 64 convenience stores.',
    contractValue: 265_000,
    currency: 'GBP',
    sector: 'retail',
    startedOn: d('2021-03-01'),
    endedOn: d('2023-02-28'),
    isPublicSector: false,
    refereeContactable: false,
  },
  {
    key: 'proj-peel',
    clientName: 'Peel L&P',
    title: 'Facilities cleaning — business park',
    description: 'Common-part cleaning and window cleaning across a 22-unit business park.',
    contractValue: 180_000,
    currency: 'GBP',
    sector: 'commercial',
    startedOn: d('2024-06-01'),
    endedOn: null,
    isPublicSector: false,
    refereeContactable: false,
  },
];

/* ---------------------------------------------------------------------------
 * Policies — four. Data protection is absent, so no tender in the seed asks for
 * it; the modern slavery statement is 31 months old, which is a pass with a
 * warning on every tender, never a fail.
 * ------------------------------------------------------------------------- */

export const demoPolicies: PolicyFixture[] = [
  {
    key: 'pol-health-safety',
    policyType: 'health_safety',
    title: 'Health & Safety Policy',
    lastReviewed: d('2026-02-10'),
    documentUrl: null,
  },
  {
    key: 'pol-equality',
    policyType: 'equality',
    title: 'Equality, Diversity & Inclusion Policy',
    lastReviewed: d('2025-11-04'),
    documentUrl: null,
  },
  {
    key: 'pol-environmental',
    policyType: 'environmental',
    title: 'Environmental Management Policy',
    lastReviewed: d('2026-01-20'),
    documentUrl: null,
  },
  {
    key: 'pol-modern-slavery',
    policyType: 'modern_slavery',
    title: 'Modern Slavery & Human Trafficking Statement',
    lastReviewed: d('2024-02-01'),
    documentUrl: null,
    note:
      '31 months before DEMO_ASOF, past POLICY_REVIEW_WARNING_MONTHS. Spec §9: pass with a ' +
      'warning. An engine that fails this has misread the rule.',
  },
];

/* ---------------------------------------------------------------------------
 * The snapshot the evaluator actually receives. Ids are the fixture keys, which is
 * enough for `EvidenceRef.id` in tests; the seed substitutes real uuids.
 * ------------------------------------------------------------------------- */

export const demoSnapshot: CapabilitySnapshot = {
  orgId: demoOrganisation.id,
  headcount: demoOrganisation.headcount,
  registeredRegion: demoOrganisation.registeredRegion,
  credentials: demoCredentials.map((c) => ({
    id: c.key,
    code: c.code,
    reference: c.reference,
    issuedOn: c.issuedOn,
    expiresOn: c.expiresOn,
  })),
  financialYears: demoFinancialYears.map((f) => ({
    id: f.key,
    yearEnding: f.yearEnding,
    turnover: f.turnover,
    netAssets: f.netAssets,
    profitBeforeTax: f.profitBeforeTax,
    currency: f.currency,
  })),
  insurances: demoInsurances.map((i) => ({
    id: i.key,
    kind: i.kind,
    coverAmount: i.coverAmount,
    currency: i.currency,
    insurer: i.insurer,
    expiresOn: i.expiresOn,
  })),
  pastProjects: demoPastProjects.map((p) => ({
    id: p.key,
    clientName: p.clientName,
    title: p.title,
    contractValue: p.contractValue,
    currency: p.currency,
    sector: p.sector,
    startedOn: p.startedOn,
    endedOn: p.endedOn,
    isPublicSector: p.isPublicSector,
    refereeContactable: p.refereeContactable,
  })),
  policies: demoPolicies.map((p) => ({
    id: p.key,
    policyType: p.policyType,
    title: p.title,
    lastReviewed: p.lastReviewed,
  })),
};

/**
 * The same snapshot after step 4 of the reviewer path. Re-running against this must
 * turn the employers' liability unknown into a pass and leave the NHS
 * recommendation at `no_bid` — the moment that proves the engine is arithmetic and
 * not a model being agreeable (spec §13).
 */
export const demoSnapshotWithEmployersLiability: CapabilitySnapshot = {
  ...demoSnapshot,
  insurances: [
    ...demoSnapshot.insurances,
    {
      id: employersLiabilityToAdd.key,
      kind: employersLiabilityToAdd.kind,
      coverAmount: employersLiabilityToAdd.coverAmount,
      currency: employersLiabilityToAdd.currency,
      insurer: employersLiabilityToAdd.insurer,
      expiresOn: employersLiabilityToAdd.expiresOn,
    },
  ],
};
