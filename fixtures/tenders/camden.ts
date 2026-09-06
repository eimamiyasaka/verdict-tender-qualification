/**
 * Camden LBC — Grounds Maintenance. The REVIEW.
 *
 * No mandatory failure, three mandatory unknowns, so `recommend()` returns
 * `review`. This is the tender that carries the two document edge cases:
 *
 *   - `spec` was uploaded at runtime, so `filePath` is null. Its citations render
 *     with SOURCE_FILE_NOT_RETAINED_MESSAGE and no link (spec §6.4, §12.6).
 *   - `appendix` is a scan with no text layer. `extractionStatus = failed` and the
 *     stored `extractionError` is shown in full in the Documents tab (spec §8, §14).
 *
 * Assessment counts: 16 pass · 0 fail · 3 unknown · 5 desirable. 27 requirements.
 */

import { CAMDEN_SUBMISSION_DEADLINE, DEMO_ASOF, t } from '../clock';
import { NO_TEXT_LAYER_MESSAGE } from '../../contracts';
import type { RequirementFixture, TenderFixture } from '../types';

const documents: TenderFixture['documents'] = [
  {
    key: 'notice',
    filename: 'Contract Notice.pdf',
    docType: 'contract_notice',
    filePath: '/packs/camden/contract-notice.pdf',
    pageCount: 5,
    extractionStatus: 'complete',
  },
  {
    key: 'psq',
    filename: 'PSQ.pdf',
    docType: 'psq',
    filePath: '/packs/camden/psq.pdf',
    pageCount: 32,
    extractionStatus: 'complete',
  },
  {
    key: 'itt',
    filename: 'ITT.pdf',
    docType: 'itt',
    filePath: '/packs/camden/itt.pdf',
    pageCount: 24,
    extractionStatus: 'complete',
  },
  {
    key: 'spec',
    filename: 'Specification.pdf',
    docType: 'specification',
    // Uploaded at runtime. Text extracted, file discarded.
    filePath: null,
    pageCount: 19,
    extractionStatus: 'complete',
  },
  {
    key: 'appendix',
    filename: 'Appendix C — Site Schedule.pdf',
    docType: 'other',
    filePath: '/packs/camden/appendix-c.pdf',
    pageCount: 12,
    extractionStatus: 'failed',
    extractionError: NO_TEXT_LAYER_MESSAGE,
  },
];

const unknowns: RequirementFixture[] = [
  {
    key: 'camden-employers-liability',
    kind: 'insurance',
    obligation: 'mandatory',
    summary: "Employers' liability cover ≥ £5,000,000",
    constraint: {
      kind: 'insurance',
      insurance_kind: 'employers_liability',
      min_cover: 5_000_000,
      currency: 'GBP',
    },
    document: 'psq',
    pageNumber: 21,
    clauseReference: '5.1',
    quotedClause:
      "Employers' liability insurance of not less than £5,000,000 must be held in accordance with the Employers' Liability (Compulsory Insurance) Act 1969.",
    extractionConfidence: 0.95,
    expected: {
      verdict: 'unknown',
      rationale: "No employers' liability policy recorded. Add one to resolve.",
    },
  },
  {
    key: 'camden-contract-works',
    kind: 'insurance',
    obligation: 'mandatory',
    summary: 'Contract works cover ≥ £250,000',
    constraint: {
      kind: 'insurance',
      insurance_kind: 'contract_works',
      min_cover: 250_000,
      currency: 'GBP',
    },
    document: 'psq',
    pageNumber: 21,
    clauseReference: '5.4',
    quotedClause:
      'Where planting or hard landscaping works are undertaken, contract works insurance of not less than £250,000 must be in place.',
    extractionConfidence: 0.81,
    expected: {
      verdict: 'unknown',
      rationale: 'No contract works policy recorded. Add one to resolve.',
    },
  },
  {
    key: 'camden-current-ratio',
    kind: 'financial',
    obligation: 'mandatory',
    summary: 'Current ratio of 1.0 or above',
    constraint: {
      kind: 'financial',
      metric: 'current_ratio',
      operator: 'gte',
      value: 1,
      years_required: 1,
    },
    document: 'psq',
    pageNumber: 18,
    clauseReference: '3.6',
    quotedClause:
      'Bidders must demonstrate a current ratio of at least 1.0 in the most recent filed accounts.',
    extractionConfidence: 0.86,
    // current_ratio is a valid metric with no column on FinancialYear.
    expected: {
      verdict: 'unknown',
      rationale: 'Current ratio is not held in the company profile.',
    },
  },
];

const met: RequirementFixture[] = [
  {
    key: 'camden-iso9001',
    kind: 'certification',
    obligation: 'mandatory',
    summary: 'ISO 9001 quality management certification',
    constraint: { kind: 'certification', credential_code: 'ISO9001' },
    document: 'psq',
    pageNumber: 19,
    clauseReference: '4.1',
    quotedClause:
      'Bidders must hold current ISO 9001 certification covering grounds maintenance operations.',
    extractionConfidence: 0.95,
    expected: { verdict: 'pass' },
  },
  {
    key: 'camden-iso14001',
    kind: 'certification',
    obligation: 'mandatory',
    summary: 'ISO 14001 environmental management certification',
    constraint: { kind: 'certification', credential_code: 'ISO14001' },
    document: 'psq',
    pageNumber: 19,
    clauseReference: '4.2',
    quotedClause:
      'Given the environmental sensitivity of the sites, bidders must hold current ISO 14001 certification.',
    extractionConfidence: 0.94,
    expected: { verdict: 'pass' },
  },
  {
    key: 'camden-chas',
    kind: 'certification',
    obligation: 'mandatory',
    summary: 'CHAS accreditation or equivalent SSIP membership',
    constraint: { kind: 'certification', credential_code: 'CHAS' },
    document: 'psq',
    pageNumber: 20,
    clauseReference: '4.4',
    quotedClause:
      'Bidders must hold CHAS accreditation or membership of another SSIP-registered scheme.',
    extractionConfidence: 0.92,
    expected: {
      verdict: 'pass',
      warning:
        'CHAS accreditation expires 5 Oct 2026, 28 days after the submission deadline. Renew before mobilisation.',
    },
  },
  {
    key: 'camden-cyber-essentials',
    kind: 'certification',
    obligation: 'mandatory',
    summary: 'Cyber Essentials certification',
    constraint: { kind: 'certification', credential_code: 'CYBER_ESSENTIALS' },
    document: 'psq',
    pageNumber: 20,
    clauseReference: '4.5',
    quotedClause:
      'Suppliers with access to Council systems must hold a current Cyber Essentials certificate.',
    extractionConfidence: 0.93,
    expected: { verdict: 'pass' },
  },
  {
    key: 'camden-public-liability',
    kind: 'insurance',
    obligation: 'mandatory',
    summary: 'Public liability cover ≥ £10,000,000',
    constraint: {
      kind: 'insurance',
      insurance_kind: 'public_liability',
      min_cover: 10_000_000,
      currency: 'GBP',
    },
    document: 'psq',
    pageNumber: 21,
    clauseReference: '5.2',
    quotedClause:
      'Public liability insurance of not less than £10,000,000 for each and every claim is required for works in public open spaces.',
    extractionConfidence: 0.96,
    // Cover is exactly £10,000,000 against a gte threshold. The boundary case.
    expected: { verdict: 'pass' },
  },
  {
    key: 'camden-professional-indemnity',
    kind: 'insurance',
    obligation: 'mandatory',
    summary: 'Professional indemnity cover ≥ £1,000,000',
    constraint: {
      kind: 'insurance',
      insurance_kind: 'professional_indemnity',
      min_cover: 1_000_000,
      currency: 'GBP',
    },
    document: 'psq',
    pageNumber: 21,
    clauseReference: '5.3',
    quotedClause:
      'Professional indemnity insurance of not less than £1,000,000 must be maintained where the supplier provides planting design services.',
    extractionConfidence: 0.88,
    expected: { verdict: 'pass' },
  },
  {
    key: 'camden-hs-policy',
    kind: 'policy',
    obligation: 'mandatory',
    summary: 'Health and safety policy',
    constraint: { kind: 'policy', policy_type: 'health_safety' },
    document: 'psq',
    pageNumber: 22,
    clauseReference: '6.1',
    quotedClause:
      'A written health and safety policy, signed and dated within the last twelve months, must be submitted with the tender.',
    extractionConfidence: 0.94,
    expected: { verdict: 'pass' },
  },
  {
    key: 'camden-equality-policy',
    kind: 'policy',
    obligation: 'mandatory',
    summary: 'Equality and diversity policy',
    constraint: { kind: 'policy', policy_type: 'equality' },
    document: 'psq',
    pageNumber: 22,
    clauseReference: '6.2',
    quotedClause:
      'Bidders must have an equality and diversity policy that meets the Council’s public sector equality duty obligations.',
    extractionConfidence: 0.93,
    expected: { verdict: 'pass' },
  },
  {
    key: 'camden-modern-slavery',
    kind: 'policy',
    obligation: 'mandatory',
    summary: 'Modern slavery statement',
    constraint: { kind: 'policy', policy_type: 'modern_slavery', max_age_months: 12 },
    document: 'psq',
    pageNumber: 23,
    clauseReference: '6.3',
    quotedClause:
      'Bidders must provide a modern slavery and human trafficking statement reviewed within the last twelve months.',
    extractionConfidence: 0.91,
    expected: {
      verdict: 'pass',
      warning:
        'Modern slavery statement last reviewed 1 Feb 2024, 31 months ago against a 12-month requirement. Refresh it before submission.',
    },
  },
  {
    key: 'camden-environmental-policy',
    kind: 'policy',
    obligation: 'mandatory',
    summary: 'Environmental management policy',
    constraint: { kind: 'policy', policy_type: 'environmental' },
    document: 'psq',
    pageNumber: 23,
    clauseReference: '6.4',
    quotedClause:
      'A written environmental management policy covering pesticide use, green waste and biodiversity must be provided.',
    extractionConfidence: 0.9,
    expected: { verdict: 'pass' },
  },
  {
    key: 'camden-turnover',
    kind: 'financial',
    obligation: 'mandatory',
    summary: 'Annual turnover ≥ £780,000',
    constraint: {
      kind: 'financial',
      metric: 'annual_turnover',
      operator: 'gte',
      value: 780_000,
      currency: 'GBP',
      years_required: 1,
    },
    document: 'psq',
    pageNumber: 18,
    clauseReference: '3.4',
    quotedClause:
      'Bidders must evidence a general annual turnover of at least £780,000, being the total value of this contract, in the most recent completed financial year.',
    extractionConfidence: 0.92,
    expected: { verdict: 'pass' },
  },
  {
    key: 'camden-net-assets',
    kind: 'financial',
    obligation: 'mandatory',
    summary: 'Positive net assets in the most recent filed year',
    constraint: {
      kind: 'financial',
      metric: 'net_assets',
      operator: 'gt',
      value: 0,
      currency: 'GBP',
      years_required: 1,
    },
    document: 'psq',
    pageNumber: 18,
    clauseReference: '3.5',
    quotedClause:
      'The most recent filed accounts must show positive net assets.',
    extractionConfidence: 0.9,
    expected: { verdict: 'pass' },
  },
  {
    key: 'camden-exp-three-contracts',
    kind: 'experience',
    obligation: 'mandatory',
    summary: 'Three contracts of £150,000 or more in the last 36 months',
    constraint: {
      kind: 'experience',
      min_count: 3,
      min_value: 150_000,
      currency: 'GBP',
      within_last_months: 36,
    },
    document: 'psq',
    pageNumber: 26,
    clauseReference: '7.1',
    quotedClause:
      'Provide details of three contracts of similar scope, each with an annual value of at least £150,000, delivered within the last three years.',
    extractionConfidence: 0.93,
    expected: { verdict: 'pass' },
  },
  {
    key: 'camden-exp-public-sector',
    kind: 'experience',
    obligation: 'mandatory',
    summary: 'Two public sector contracts',
    constraint: { kind: 'experience', min_count: 2, public_sector_only: true },
    document: 'psq',
    pageNumber: 26,
    clauseReference: '7.2',
    quotedClause:
      'At least two of the contracts listed must have been delivered for a contracting authority.',
    extractionConfidence: 0.94,
    expected: { verdict: 'pass' },
  },
  {
    key: 'camden-exp-local-gov',
    kind: 'experience',
    obligation: 'mandatory',
    summary: 'One local authority grounds contract in the last 60 months',
    constraint: {
      kind: 'experience',
      min_count: 1,
      sector: 'local_government',
      within_last_months: 60,
    },
    document: 'itt',
    pageNumber: 11,
    clauseReference: '3.1',
    quotedClause:
      'Tenderers must evidence at least one grounds maintenance or public realm contract delivered for a local authority within the last five years.',
    extractionConfidence: 0.91,
    expected: { verdict: 'pass' },
  },
  {
    key: 'camden-exp-references',
    kind: 'experience',
    obligation: 'mandatory',
    summary: 'Two contactable customer references',
    constraint: { kind: 'experience', min_count: 2, referee_required: true },
    document: 'psq',
    pageNumber: 27,
    clauseReference: '7.3',
    quotedClause:
      'Named referees with current contact details must be provided for at least two of the contracts listed.',
    extractionConfidence: 0.9,
    expected: { verdict: 'pass' },
  },
];

const desirable: RequirementFixture[] = [
  {
    key: 'camden-iso45001',
    kind: 'certification',
    obligation: 'desirable',
    summary: 'ISO 45001 occupational health and safety certification',
    constraint: { kind: 'certification', credential_code: 'ISO45001' },
    document: 'psq',
    pageNumber: 19,
    clauseReference: '4.3',
    quotedClause:
      'ISO 45001 certification is desirable and will be scored under the health and safety criterion.',
    extractionConfidence: 0.87,
    expected: { verdict: 'fail', rationale: 'Not held. No certificate on your profile.' },
  },
  {
    key: 'camden-safecontractor',
    kind: 'certification',
    obligation: 'desirable',
    summary: 'SafeContractor accreditation',
    constraint: { kind: 'certification', credential_code: 'SAFECONTRACTOR' },
    document: 'psq',
    pageNumber: 20,
    clauseReference: '4.6',
    quotedClause:
      'SafeContractor accreditation is desirable in addition to the mandatory SSIP requirement.',
    extractionConfidence: 0.82,
    expected: { verdict: 'fail', rationale: 'Not held. No certificate on your profile.' },
  },
  {
    key: 'camden-exp-education',
    kind: 'experience',
    obligation: 'desirable',
    summary: 'One education-sector contract of £500,000 or more',
    constraint: {
      kind: 'experience',
      min_count: 1,
      min_value: 500_000,
      currency: 'GBP',
      sector: 'education',
    },
    document: 'itt',
    pageNumber: 12,
    clauseReference: '3.4',
    quotedClause:
      'Experience of maintaining school or university estate will be scored favourably under criterion T3.',
    extractionConfidence: 0.84,
    expected: { verdict: 'pass' },
  },
  {
    key: 'camden-credit-score',
    kind: 'financial',
    obligation: 'desirable',
    summary: 'Commercial credit score of 60 or above',
    constraint: {
      kind: 'financial',
      metric: 'credit_score',
      operator: 'gte',
      value: 60,
      years_required: 1,
    },
    document: 'psq',
    pageNumber: 18,
    clauseReference: '3.7',
    quotedClause:
      'The Council may obtain a credit reference. A score below 60 will prompt a request for additional financial information.',
    extractionConfidence: 0.78,
    expected: {
      verdict: 'unknown',
      rationale: 'Commercial credit score is not held in the company profile.',
    },
  },
  {
    key: 'camden-exp-public-five',
    kind: 'experience',
    obligation: 'desirable',
    summary: 'Five public sector contracts in the last 60 months',
    constraint: {
      kind: 'experience',
      min_count: 5,
      public_sector_only: true,
      within_last_months: 60,
    },
    document: 'itt',
    pageNumber: 12,
    clauseReference: '3.5',
    quotedClause:
      'Tenderers evidencing five or more public sector contracts within the last five years will score more highly under criterion T3.',
    extractionConfidence: 0.85,
    expected: { verdict: 'pass' },
  },
];

const notApplicable: RequirementFixture[] = [
  {
    key: 'camden-ms-a',
    kind: 'question',
    obligation: 'mandatory',
    summary: 'Method Statement A — Service delivery and seasonal planning',
    constraint: { kind: 'question', response_format: 'method_statement' },
    document: 'itt',
    pageNumber: 14,
    questionRef: 'Method Statement A',
    wordLimit: 1500,
    weighting: 40,
    clauseReference: '4.1',
    quotedClause:
      'Describe how you will deliver the grounds maintenance specification across the seasonal cycle, including resourcing at peak growing season. Maximum 1,500 words. Weighted at 40%.',
    extractionConfidence: 0.95,
    expected: { verdict: 'not_applicable' },
  },
  {
    key: 'camden-ms-b',
    kind: 'question',
    obligation: 'mandatory',
    summary: 'Method Statement B — Social value and local employment',
    constraint: { kind: 'question', response_format: 'method_statement' },
    document: 'itt',
    pageNumber: 15,
    questionRef: 'Method Statement B',
    wordLimit: 800,
    weighting: 20,
    clauseReference: '4.2',
    quotedClause:
      'Set out the social value you will deliver, with particular reference to employment of Camden residents. Maximum 800 words. Weighted at 20%.',
    extractionConfidence: 0.94,
    expected: { verdict: 'not_applicable' },
  },
  {
    key: 'camden-submission-deadline',
    kind: 'date',
    obligation: 'mandatory',
    summary: 'Tender submission closes 7 Sep 2026',
    constraint: {
      kind: 'date',
      date_kind: 'submission_deadline',
      occurs_at: '2026-09-07T17:00:00+01:00',
    },
    document: 'notice',
    pageNumber: 3,
    clauseReference: '1.5',
    quotedClause:
      'Tenders must be received via the London Tenders Portal by 17:00 on 7 September 2026.',
    extractionConfidence: 0.98,
    expected: { verdict: 'not_applicable' },
  },
];

export const camdenTender: TenderFixture = {
  key: 'camden',
  title: 'Camden LBC — Grounds Maintenance',
  buyerName: 'London Borough of Camden',
  source: 'contracts_finder',
  noticeReference: 'ocds-h6vhtk-05b93c',
  sourceUrl: 'https://www.contractsfinder.service.gov.uk/notice/05b93c-2026',
  contractValue: 780_000,
  currency: 'GBP',
  durationMonths: 36,
  lotReference: null,
  status: 'assessed',
  createdBy: 'colleague',
  documents,
  keyDates: [
    {
      kind: 'clarification_deadline',
      occursAt: t('2026-08-31T17:00:00+01:00'),
      document: 'notice',
      pageNumber: 3,
      quotedClause:
        'Clarification questions close at 17:00 on 31 August 2026.',
    },
    {
      kind: 'submission_deadline',
      occursAt: CAMDEN_SUBMISSION_DEADLINE,
      document: 'notice',
      pageNumber: 3,
      quotedClause:
        'Tenders must be received via the London Tenders Portal by 17:00 on 7 September 2026.',
    },
    { kind: 'contract_start', occursAt: t('2026-11-01T00:00:00Z') },
    { kind: 'contract_end', occursAt: t('2029-10-31T00:00:00Z') },
  ],
  requirements: [...unknowns, ...met, ...desirable, ...notApplicable],
  assessments: [
    {
      version: 1,
      recommendation: 'review',
      mandatoryTotal: 19,
      mandatoryPassed: 16,
      mandatoryFailed: 0,
      mandatoryUnknown: 3,
      desirableScore: 40.0,
      rationale:
        'No mandatory gate fails, but three cannot be decided from the profile: employers’ liability cover, contract works cover and the current ratio. Two of the three are insurance lines that have never been entered rather than cover that is known to be absent. Resolve them before the clarification deadline and this becomes a bid.',
      deadlineUsed: CAMDEN_SUBMISSION_DEADLINE,
      asOfUsed: DEMO_ASOF,
      runBy: 'colleague',
    },
  ],
  tasks: [],
  responses: [],
};

export const camdenRequirementsByKey = Object.fromEntries(
  camdenTender.requirements.map((r) => [r.key, r]),
) as Record<string, RequirementFixture>;
