/**
 * NHS Supply Chain — Managed Cleaning Services. The NO BID.
 *
 * This is the demo screen (spec §10.2). Two blocking failures, both quantified,
 * three unknowns, and a citation the reviewer can open the real PDF to check.
 *
 * Assessment counts, which the verdict block renders:
 *   21 pass · 2 fail · 3 unknown · 8 desirable
 *
 * 40 requirements in total. The six that are neither mandatory-evaluable nor
 * desirable are the four method statements and two dates — `not_applicable` to
 * eligibility (spec §9), which is why `mandatoryTotal` is 26 rather than 32.
 */

import { NHS_SUBMISSION_DEADLINE, DEMO_ASOF, d, t } from '../clock';
import type { RequirementFixture, TenderFixture } from '../types';

const documents: TenderFixture['documents'] = [
  {
    key: 'notice',
    filename: 'Contract Notice.pdf',
    docType: 'contract_notice',
    filePath: '/packs/nhs/contract-notice.pdf',
    pageCount: 6,
    extractionStatus: 'complete',
  },
  {
    key: 'psq',
    filename: 'PSQ.pdf',
    docType: 'psq',
    filePath: '/packs/nhs/psq.pdf',
    pageCount: 44,
    extractionStatus: 'complete',
  },
  {
    key: 'itt',
    filename: 'ITT.pdf',
    docType: 'itt',
    filePath: '/packs/nhs/itt.pdf',
    pageCount: 38,
    extractionStatus: 'complete',
  },
  {
    key: 'spec',
    filename: 'Specification.pdf',
    docType: 'specification',
    filePath: '/packs/nhs/specification.pdf',
    pageCount: 18,
    extractionStatus: 'complete',
  },
  {
    key: 'evaluation',
    filename: 'Evaluation Methodology.pdf',
    docType: 'evaluation_methodology',
    filePath: '/packs/nhs/evaluation-methodology.pdf',
    pageCount: 9,
    extractionStatus: 'complete',
  },
];

/* ---------------------------------------------------------------------------
 * BLOCKING — mandatory, verdict fail. These two rows are the demo.
 * ------------------------------------------------------------------------- */

const blocking: RequirementFixture[] = [
  {
    key: 'nhs-iso27001',
    kind: 'certification',
    obligation: 'mandatory',
    summary: 'ISO 27001 certification',
    constraint: { kind: 'certification', credential_code: 'ISO27001' },
    document: 'psq',
    pageNumber: 31,
    clauseReference: '4.2.1',
    quotedClause:
      'Bidders must hold current certification to ISO/IEC 27001 covering the scope of the services described in the Specification. Certification must be issued by a UKAS-accredited certification body and must be valid at the date of tender submission. Failure to evidence this requirement will result in your submission being excluded from further evaluation.',
    extractionConfidence: 0.96,
    // The same obligation restated in the ITT. Deduplicated to one matrix row; the
    // losing draft's provenance lands in requirement_citations and the drawer lists
    // both (spec §7.5). This is the row that makes "both citations are kept" true.
    alsoCitedIn: [
      {
        document: 'itt',
        pageNumber: 9,
        clauseReference: '1.4',
        quotedClause:
          'Tenderers are reminded that ISO/IEC 27001 certification is a condition of participation and must remain valid throughout the contract term.',
      },
    ],
    expected: {
      verdict: 'fail',
      rationale: 'Not held. No certificate on your profile.',
      evidence: [],
    },
  },
  {
    key: 'nhs-turnover-5m',
    kind: 'financial',
    obligation: 'mandatory',
    summary: 'Minimum annual turnover £5,000,000',
    constraint: {
      kind: 'financial',
      metric: 'annual_turnover',
      operator: 'gte',
      value: 5_000_000,
      currency: 'GBP',
      years_required: 1,
      basis: 'each_year',
    },
    document: 'psq',
    pageNumber: 28,
    clauseReference: '3.4',
    quotedClause:
      'The Authority requires a minimum general annual turnover of £5,000,000 in the most recent completed financial year for which accounts have been filed. This threshold has been set at approximately twice the estimated annual contract value and the Authority considers it proportionate to the subject matter of the contract.',
    extractionConfidence: 0.94,
    expected: {
      verdict: 'fail',
      rationale: 'FY2025 turnover £4,120,000 — short by £880,000.',
      evidence: [
        {
          source: 'financial_year',
          id: 'fy2025',
          label: 'FY2025 (year ending 31 Mar 2025)',
          detail: 'Turnover £4,120,000',
        },
      ],
    },
  },
];

/* ---------------------------------------------------------------------------
 * NEEDS AN ANSWER FROM YOU — mandatory, verdict unknown.
 * ------------------------------------------------------------------------- */

const unknowns: RequirementFixture[] = [
  {
    key: 'nhs-employers-liability',
    kind: 'insurance',
    obligation: 'mandatory',
    summary: "Employers' liability cover ≥ £10,000,000",
    constraint: {
      kind: 'insurance',
      insurance_kind: 'employers_liability',
      min_cover: 10_000_000,
      currency: 'GBP',
    },
    document: 'psq',
    pageNumber: 34,
    clauseReference: '5.2',
    quotedClause:
      "Employers' liability insurance of not less than £10,000,000 for each and every claim must be held and maintained for the duration of the contract. Evidence of cover must be provided to the Authority prior to contract award.",
    extractionConfidence: 0.93,
    expected: {
      verdict: 'unknown',
      rationale: "No employers' liability policy recorded. Add one to resolve.",
      evidence: [],
    },
  },
  {
    key: 'nhs-net-assets-3yr',
    kind: 'financial',
    obligation: 'mandatory',
    summary: 'Net assets ≥ £500,000 in each of the last three filed years',
    constraint: {
      kind: 'financial',
      metric: 'net_assets',
      operator: 'gte',
      value: 500_000,
      currency: 'GBP',
      years_required: 3,
      basis: 'each_year',
    },
    document: 'psq',
    pageNumber: 28,
    clauseReference: '3.7',
    quotedClause:
      'Bidders must demonstrate positive net assets of not less than £500,000 in each of the three most recent sets of filed accounts.',
    extractionConfidence: 0.91,
    expected: {
      verdict: 'unknown',
      rationale:
        'FY2023 accounts are not on file. Net assets met in FY2025 (£890,000) and FY2024 (£705,000); the third year cannot be checked.',
    },
  },
  {
    key: 'nhs-pbt-2yr',
    kind: 'financial',
    obligation: 'mandatory',
    summary: 'Profit before tax positive in each of the last two filed years',
    constraint: {
      kind: 'financial',
      metric: 'profit_before_tax',
      operator: 'gt',
      value: 0,
      currency: 'GBP',
      years_required: 2,
      basis: 'each_year',
    },
    document: 'psq',
    pageNumber: 28,
    clauseReference: '3.8',
    quotedClause:
      'The Authority will assess profitability over the two most recent filed accounting periods. A loss before taxation in either period must be explained in writing and may result in a request for a parent company guarantee.',
    extractionConfidence: 0.88,
    expected: {
      verdict: 'unknown',
      rationale:
        'FY2024 profit before tax is not recorded. FY2025 profit before tax £212,000 meets the requirement.',
    },
  },
];

/* ---------------------------------------------------------------------------
 * MET — mandatory, verdict pass. Collapsed behind "21 requirements met".
 * ------------------------------------------------------------------------- */

const met: RequirementFixture[] = [
  {
    key: 'nhs-iso9001',
    kind: 'certification',
    obligation: 'mandatory',
    summary: 'ISO 9001 quality management certification',
    constraint: { kind: 'certification', credential_code: 'ISO9001' },
    document: 'psq',
    pageNumber: 29,
    clauseReference: '4.1.1',
    quotedClause:
      'Bidders must hold current certification to ISO 9001 for a quality management system covering cleaning and facilities management services.',
    extractionConfidence: 0.97,
    expected: { verdict: 'pass' },
  },
  {
    key: 'nhs-iso14001',
    kind: 'certification',
    obligation: 'mandatory',
    summary: 'ISO 14001 environmental management certification',
    constraint: { kind: 'certification', credential_code: 'ISO14001' },
    document: 'psq',
    pageNumber: 29,
    clauseReference: '4.1.2',
    quotedClause:
      'Bidders must hold current certification to ISO 14001 for an environmental management system, or provide evidence of an equivalent environmental management system independently verified within the last three years.',
    extractionConfidence: 0.92,
    // expiresOn is null on this credential. Spec §9 and §14: pass, not unknown.
    expected: { verdict: 'pass' },
  },
  {
    key: 'nhs-cyber-essentials',
    kind: 'certification',
    obligation: 'mandatory',
    summary: 'Cyber Essentials certification',
    constraint: { kind: 'certification', credential_code: 'CYBER_ESSENTIALS' },
    document: 'psq',
    pageNumber: 31,
    clauseReference: '4.2.2',
    quotedClause:
      'All suppliers handling Authority data must hold a current Cyber Essentials certificate as a minimum.',
    extractionConfidence: 0.95,
    expected: { verdict: 'pass' },
  },
  {
    key: 'nhs-chas',
    kind: 'certification',
    obligation: 'mandatory',
    summary: 'CHAS accreditation or equivalent SSIP membership',
    constraint: { kind: 'certification', credential_code: 'CHAS' },
    document: 'psq',
    pageNumber: 30,
    clauseReference: '4.3.1',
    quotedClause:
      'Bidders must hold current CHAS accreditation or membership of an equivalent scheme registered under the Safety Schemes in Procurement (SSIP) umbrella.',
    extractionConfidence: 0.9,
    expected: {
      verdict: 'pass',
      warning:
        'CHAS accreditation expires 5 Oct 2026, 21 days after the submission deadline. Renew before mobilisation.',
    },
  },
  {
    key: 'nhs-public-liability',
    kind: 'insurance',
    obligation: 'mandatory',
    summary: 'Public liability cover ≥ £5,000,000',
    constraint: {
      kind: 'insurance',
      insurance_kind: 'public_liability',
      min_cover: 5_000_000,
      currency: 'GBP',
    },
    document: 'psq',
    pageNumber: 34,
    clauseReference: '5.1',
    quotedClause:
      'Public liability insurance of not less than £5,000,000 for each and every claim must be held for the duration of the contract.',
    extractionConfidence: 0.96,
    alsoCitedIn: [
      {
        document: 'itt',
        pageNumber: 11,
        clauseReference: '2.1',
        quotedClause:
          'The successful tenderer shall maintain public liability cover of £5,000,000 minimum throughout the contract period and shall provide certificates annually.',
      },
    ],
    expected: { verdict: 'pass' },
  },
  {
    key: 'nhs-professional-indemnity',
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
    pageNumber: 34,
    clauseReference: '5.3',
    quotedClause:
      'Professional indemnity insurance of not less than £1,000,000 for each and every claim is required where the supplier provides advisory or specification services.',
    extractionConfidence: 0.89,
    expected: { verdict: 'pass' },
  },
  {
    key: 'nhs-hs-policy',
    kind: 'policy',
    obligation: 'mandatory',
    summary: 'Health and safety policy',
    constraint: { kind: 'policy', policy_type: 'health_safety' },
    document: 'psq',
    pageNumber: 30,
    clauseReference: '4.3.3',
    quotedClause:
      'Bidders employing five or more people must provide a written health and safety policy signed by a director.',
    extractionConfidence: 0.94,
    expected: { verdict: 'pass' },
  },
  {
    key: 'nhs-equality-policy',
    kind: 'policy',
    obligation: 'mandatory',
    summary: 'Equality and diversity policy',
    constraint: { kind: 'policy', policy_type: 'equality' },
    document: 'psq',
    pageNumber: 36,
    clauseReference: '6.1',
    quotedClause:
      'Bidders must confirm that they have an equality and diversity policy in place and must provide a copy on request.',
    extractionConfidence: 0.93,
    expected: { verdict: 'pass' },
  },
  {
    key: 'nhs-modern-slavery',
    kind: 'policy',
    obligation: 'mandatory',
    summary: 'Modern slavery statement',
    constraint: { kind: 'policy', policy_type: 'modern_slavery' },
    document: 'psq',
    pageNumber: 36,
    clauseReference: '6.2',
    quotedClause:
      'Bidders must confirm compliance with the Modern Slavery Act 2015 and provide their current slavery and human trafficking statement.',
    extractionConfidence: 0.95,
    expected: {
      verdict: 'pass',
      warning:
        'Modern slavery statement last reviewed 1 Feb 2024, 31 months ago. Refresh it before submission.',
    },
  },
  {
    key: 'nhs-environmental-policy',
    kind: 'policy',
    obligation: 'mandatory',
    summary: 'Environmental management policy',
    constraint: { kind: 'policy', policy_type: 'environmental' },
    document: 'psq',
    pageNumber: 37,
    clauseReference: '6.4',
    quotedClause:
      'Bidders must hold a written environmental management policy setting out how environmental impacts arising from the services will be identified and controlled.',
    extractionConfidence: 0.91,
    expected: { verdict: 'pass' },
  },
  {
    key: 'nhs-net-assets-250k',
    kind: 'financial',
    obligation: 'mandatory',
    summary: 'Net assets ≥ £250,000 in the most recent filed year',
    constraint: {
      kind: 'financial',
      metric: 'net_assets',
      operator: 'gte',
      value: 250_000,
      currency: 'GBP',
      years_required: 1,
    },
    document: 'psq',
    pageNumber: 28,
    clauseReference: '3.5',
    quotedClause:
      'Net assets in the most recent filed accounts must be not less than £250,000.',
    extractionConfidence: 0.92,
    expected: { verdict: 'pass' },
  },
  {
    key: 'nhs-pbt-non-negative',
    kind: 'financial',
    obligation: 'mandatory',
    summary: 'Profit before tax not negative in the most recent filed year',
    constraint: {
      kind: 'financial',
      metric: 'profit_before_tax',
      operator: 'gte',
      value: 0,
      currency: 'GBP',
      years_required: 1,
    },
    document: 'psq',
    pageNumber: 28,
    clauseReference: '3.6',
    quotedClause:
      'The most recent filed accounts must not show a loss before taxation.',
    extractionConfidence: 0.87,
    expected: { verdict: 'pass' },
  },
  {
    key: 'nhs-turnover-avg-3m',
    kind: 'financial',
    obligation: 'mandatory',
    summary: 'Average annual turnover ≥ £3,000,000 across the last two filed years',
    constraint: {
      kind: 'financial',
      metric: 'annual_turnover',
      operator: 'gte',
      value: 3_000_000,
      currency: 'GBP',
      years_required: 2,
      basis: 'average',
    },
    document: 'itt',
    pageNumber: 12,
    clauseReference: '2.3',
    quotedClause:
      'Tenderers must evidence an average annual turnover of at least £3,000,000 across the two most recent filed accounting periods.',
    extractionConfidence: 0.9,
    expected: { verdict: 'pass' },
  },
  {
    key: 'nhs-turnover-proportionate',
    kind: 'financial',
    obligation: 'mandatory',
    summary: 'Annual turnover ≥ £1,200,000 (twice annual contract value)',
    constraint: {
      kind: 'financial',
      metric: 'annual_turnover',
      operator: 'gte',
      value: 1_200_000,
      currency: 'GBP',
      years_required: 1,
    },
    document: 'itt',
    pageNumber: 12,
    clauseReference: '2.2',
    quotedClause:
      'Tenderers must demonstrate turnover of at least twice the annual value of this contract, being £1,200,000, in the most recent completed financial year.',
    extractionConfidence: 0.86,
    expected: { verdict: 'pass' },
  },
  {
    key: 'nhs-exp-three-contracts',
    kind: 'experience',
    obligation: 'mandatory',
    summary: 'Three comparable contracts of £400,000 or more in the last 36 months',
    constraint: {
      kind: 'experience',
      min_count: 3,
      min_value: 400_000,
      currency: 'GBP',
      within_last_months: 36,
    },
    document: 'psq',
    pageNumber: 40,
    clauseReference: '7.1',
    quotedClause:
      'Bidders must provide details of three contracts of a similar scope and scale, each with an annual value of not less than £400,000, delivered within the last three years.',
    extractionConfidence: 0.93,
    expected: { verdict: 'pass' },
  },
  {
    key: 'nhs-exp-public-sector',
    kind: 'experience',
    obligation: 'mandatory',
    summary: 'Two public sector contracts in the last 60 months',
    constraint: {
      kind: 'experience',
      min_count: 2,
      public_sector_only: true,
      within_last_months: 60,
    },
    document: 'psq',
    pageNumber: 40,
    clauseReference: '7.2',
    quotedClause:
      'At least two of the contracts provided must have been delivered for a public sector body within the last five years.',
    extractionConfidence: 0.94,
    expected: { verdict: 'pass' },
  },
  {
    key: 'nhs-exp-five-contracts',
    kind: 'experience',
    obligation: 'mandatory',
    summary: 'Five contracts delivered in the last 60 months',
    constraint: { kind: 'experience', min_count: 5, within_last_months: 60 },
    document: 'psq',
    pageNumber: 40,
    clauseReference: '7.3',
    quotedClause:
      'Bidders must be able to evidence a minimum of five contracts delivered or in delivery within the last five years.',
    extractionConfidence: 0.88,
    expected: { verdict: 'pass' },
  },
  {
    key: 'nhs-exp-references',
    kind: 'experience',
    obligation: 'mandatory',
    summary: 'Two contactable customer references',
    constraint: { kind: 'experience', min_count: 2, referee_required: true },
    document: 'psq',
    pageNumber: 41,
    clauseReference: '7.4',
    quotedClause:
      'Contact details must be provided for a named referee at two of the contracts listed. The Authority reserves the right to contact referees without further notice.',
    extractionConfidence: 0.91,
    expected: { verdict: 'pass' },
  },
  {
    key: 'nhs-exp-healthcare',
    kind: 'experience',
    obligation: 'mandatory',
    summary: 'One healthcare-sector contract in the last 60 months',
    constraint: {
      kind: 'experience',
      min_count: 1,
      sector: 'healthcare',
      within_last_months: 60,
    },
    document: 'itt',
    pageNumber: 18,
    clauseReference: '4.1',
    quotedClause:
      'Tenderers must evidence at least one contract delivered in a healthcare setting within the last five years.',
    extractionConfidence: 0.92,
    expected: { verdict: 'pass' },
  },
  {
    key: 'nhs-exp-1m-contract',
    kind: 'experience',
    obligation: 'mandatory',
    summary: 'One contract with an annual value of £1,000,000 or more',
    constraint: { kind: 'experience', min_count: 1, min_value: 1_000_000, currency: 'GBP' },
    document: 'itt',
    pageNumber: 18,
    clauseReference: '4.2',
    quotedClause:
      'At least one contract listed must have an annual value of £1,000,000 or greater.',
    extractionConfidence: 0.9,
    expected: { verdict: 'pass' },
  },
  {
    key: 'nhs-exp-local-gov',
    kind: 'experience',
    obligation: 'mandatory',
    summary: 'One local government contract',
    constraint: { kind: 'experience', min_count: 1, sector: 'local_government' },
    document: 'itt',
    pageNumber: 19,
    clauseReference: '4.3',
    quotedClause:
      'Tenderers must evidence experience of delivering services to a local authority.',
    extractionConfidence: 0.85,
    expected: { verdict: 'pass' },
  },
];

/* ---------------------------------------------------------------------------
 * DESIRABLE — 2 pass, 4 fail, 2 unknown. desirableScore 25.00.
 * ------------------------------------------------------------------------- */

const desirable: RequirementFixture[] = [
  {
    key: 'nhs-iso45001',
    kind: 'certification',
    obligation: 'desirable',
    summary: 'ISO 45001 occupational health and safety certification',
    constraint: { kind: 'certification', credential_code: 'ISO45001' },
    document: 'psq',
    pageNumber: 29,
    clauseReference: '4.1.3',
    quotedClause:
      'Certification to ISO 45001 is not mandatory but will be viewed favourably in the evaluation of technical ability.',
    extractionConfidence: 0.89,
    expected: { verdict: 'fail', rationale: 'Not held. No certificate on your profile.' },
  },
  {
    key: 'nhs-cyber-essentials-plus',
    kind: 'certification',
    obligation: 'desirable',
    summary: 'Cyber Essentials Plus certification',
    constraint: { kind: 'certification', credential_code: 'CYBER_ESSENTIALS_PLUS' },
    document: 'psq',
    pageNumber: 31,
    clauseReference: '4.2.3',
    quotedClause:
      'Suppliers holding Cyber Essentials Plus will be awarded additional marks under the information governance criterion.',
    extractionConfidence: 0.9,
    expected: { verdict: 'fail', rationale: 'Not held. No certificate on your profile.' },
  },
  {
    key: 'nhs-constructionline',
    kind: 'certification',
    obligation: 'desirable',
    summary: 'Constructionline registration',
    constraint: { kind: 'certification', credential_code: 'CONSTRUCTIONLINE' },
    document: 'psq',
    pageNumber: 30,
    clauseReference: '4.3.4',
    quotedClause:
      'Registration with Constructionline at Gold level is desirable and may reduce the evidence required at contract award.',
    extractionConfidence: 0.84,
    expected: { verdict: 'fail', rationale: 'Not held. No certificate on your profile.' },
  },
  {
    key: 'nhs-exp-healthcare-two',
    kind: 'experience',
    obligation: 'desirable',
    summary: 'Two healthcare-sector contracts',
    constraint: { kind: 'experience', min_count: 2, sector: 'healthcare' },
    document: 'evaluation',
    pageNumber: 5,
    clauseReference: '3.2',
    quotedClause:
      'Tenderers evidencing two or more contracts delivered for NHS bodies will score more highly against criterion T2.',
    extractionConfidence: 0.87,
    expected: { verdict: 'pass' },
  },
  {
    key: 'nhs-exp-public-three',
    kind: 'experience',
    obligation: 'desirable',
    summary: 'Three public sector contracts in the last 60 months',
    constraint: {
      kind: 'experience',
      min_count: 3,
      public_sector_only: true,
      within_last_months: 60,
    },
    document: 'evaluation',
    pageNumber: 5,
    clauseReference: '3.3',
    quotedClause:
      'Additional marks are available where three or more of the contracts evidenced were delivered for contracting authorities.',
    extractionConfidence: 0.86,
    expected: { verdict: 'pass' },
  },
  {
    key: 'nhs-product-liability',
    kind: 'insurance',
    obligation: 'desirable',
    summary: 'Product liability cover ≥ £1,000,000',
    constraint: {
      kind: 'insurance',
      insurance_kind: 'product_liability',
      min_cover: 1_000_000,
      currency: 'GBP',
    },
    document: 'psq',
    pageNumber: 34,
    clauseReference: '5.4',
    quotedClause:
      'Product liability cover of £1,000,000 is desirable where the supplier supplies consumables under the contract.',
    extractionConfidence: 0.82,
    expected: { verdict: 'unknown', rationale: 'No product liability policy recorded.' },
  },
  {
    key: 'nhs-credit-score',
    kind: 'financial',
    obligation: 'desirable',
    summary: 'Commercial credit score of 70 or above',
    constraint: {
      kind: 'financial',
      metric: 'credit_score',
      operator: 'gte',
      value: 70,
      years_required: 1,
    },
    document: 'psq',
    pageNumber: 29,
    clauseReference: '3.9',
    quotedClause:
      'The Authority may obtain a commercial credit report. A score below 70 will trigger a request for further financial assurance but will not of itself exclude a bidder.',
    extractionConfidence: 0.79,
    // credit_score is in FinancialMetric but has no column on FinancialYear. Spec §9's
    // definition of unknown covers it permanently — see METRICS_NOT_IN_SNAPSHOT.
    expected: {
      verdict: 'unknown',
      rationale: 'Commercial credit score is not held in the company profile.',
    },
  },
  {
    key: 'nhs-exp-1_5m',
    kind: 'experience',
    obligation: 'desirable',
    summary: 'One contract with an annual value of £1,500,000 or more',
    constraint: { kind: 'experience', min_count: 1, min_value: 1_500_000, currency: 'GBP' },
    document: 'evaluation',
    pageNumber: 6,
    clauseReference: '3.5',
    quotedClause:
      'Experience of contracts above £1,500,000 per annum will be treated as evidence of capacity to mobilise at scale.',
    extractionConfidence: 0.83,
    expected: {
      verdict: 'fail',
      rationale:
        'Largest recorded contract is £1,400,000 (Manchester University NHS Foundation Trust) — short by £100,000.',
    },
  },
];

/* ---------------------------------------------------------------------------
 * NOT APPLICABLE to eligibility — method statements and dates (spec §9). These
 * are excluded from mandatoryTotal, which is why 26 gates sit inside 40 rows.
 * ------------------------------------------------------------------------- */

const notApplicable: RequirementFixture[] = [
  {
    key: 'nhs-ms1',
    kind: 'question',
    obligation: 'mandatory',
    summary: 'Method Statement 1 — Mobilisation and TUPE',
    constraint: { kind: 'question', response_format: 'method_statement' },
    document: 'itt',
    pageNumber: 22,
    questionRef: 'Method Statement 1',
    wordLimit: 1500,
    weighting: 25,
    clauseReference: '5.1',
    quotedClause:
      'Describe your approach to mobilising the service within eight weeks of contract award, including your handling of TUPE transfer for an estimated 41 staff. Maximum 1,500 words. This question carries 25% of the total score.',
    extractionConfidence: 0.95,
    expected: { verdict: 'not_applicable' },
  },
  {
    key: 'nhs-ms2',
    kind: 'question',
    obligation: 'mandatory',
    summary: 'Method Statement 2 — Service delivery and quality',
    constraint: { kind: 'question', response_format: 'method_statement' },
    document: 'itt',
    pageNumber: 23,
    questionRef: 'Method Statement 2',
    wordLimit: 2000,
    weighting: 30,
    clauseReference: '5.2',
    quotedClause:
      'Set out how you will deliver the cleaning specification to the National Standards of Healthcare Cleanliness 2021, including audit, rectification and reporting. Maximum 2,000 words. This question carries 30% of the total score.',
    extractionConfidence: 0.95,
    expected: { verdict: 'not_applicable' },
  },
  {
    key: 'nhs-ms3',
    kind: 'question',
    obligation: 'mandatory',
    summary: 'Method Statement 3 — Social value',
    constraint: { kind: 'question', response_format: 'method_statement' },
    document: 'itt',
    pageNumber: 24,
    questionRef: 'Method Statement 3',
    wordLimit: 1000,
    weighting: 10,
    clauseReference: '5.3',
    quotedClause:
      'Describe the social value you will deliver under this contract with reference to the Social Value Model themes. Maximum 1,000 words. This question carries 10% of the total score.',
    extractionConfidence: 0.94,
    expected: { verdict: 'not_applicable' },
  },
  {
    key: 'nhs-ms4',
    kind: 'question',
    obligation: 'mandatory',
    summary: 'Method Statement 4 — Business continuity',
    constraint: { kind: 'question', response_format: 'method_statement' },
    document: 'itt',
    pageNumber: 25,
    questionRef: 'Method Statement 4',
    wordLimit: 1200,
    weighting: 10,
    clauseReference: '5.4',
    quotedClause:
      'Explain your business continuity arrangements, including cover for staff absence and response to a service failure. Maximum 1,200 words. This question carries 10% of the total score.',
    extractionConfidence: 0.93,
    expected: { verdict: 'not_applicable' },
  },
  {
    key: 'nhs-clarification-deadline',
    kind: 'date',
    obligation: 'informational',
    summary: 'Clarification questions close 7 Sep 2026',
    constraint: {
      kind: 'date',
      date_kind: 'clarification_deadline',
      occurs_at: '2026-09-07T17:00:00+01:00',
    },
    document: 'notice',
    pageNumber: 4,
    clauseReference: '2.6',
    quotedClause:
      'Clarification questions must be submitted through the portal by 17:00 on 7 September 2026. Questions received after this time will not be answered.',
    extractionConfidence: 0.97,
    expected: { verdict: 'not_applicable' },
  },
  {
    key: 'nhs-submission-deadline',
    kind: 'date',
    obligation: 'mandatory',
    summary: 'Tender submission closes 14 Sep 2026',
    constraint: {
      kind: 'date',
      date_kind: 'submission_deadline',
      occurs_at: '2026-09-14T12:00:00+01:00',
    },
    document: 'itt',
    pageNumber: 6,
    clauseReference: '1.2',
    quotedClause:
      'Tenders must be uploaded to the portal by 12:00 noon on 14 September 2026. The portal will close automatically and late submissions cannot be accepted.',
    extractionConfidence: 0.98,
    expected: { verdict: 'not_applicable' },
  },
];

export const nhsTender: TenderFixture = {
  key: 'nhs',
  title: 'NHS Supply Chain — Managed Cleaning Services',
  buyerName: 'NHS Supply Chain',
  source: 'find_a_tender',
  noticeReference: 'ocds-h6vhtk-04f2a1',
  sourceUrl: 'https://www.find-tender.service.gov.uk/Notice/04f2a1-2026',
  contractValue: 2_400_000,
  currency: 'GBP',
  durationMonths: 48,
  lotReference: null,
  status: 'assessed',
  createdBy: 'owner',
  documents,
  keyDates: [
    {
      kind: 'clarification_deadline',
      occursAt: t('2026-09-07T17:00:00+01:00'),
      document: 'notice',
      pageNumber: 4,
      quotedClause:
        'Clarification questions must be submitted through the portal by 17:00 on 7 September 2026.',
    },
    {
      kind: 'submission_deadline',
      occursAt: NHS_SUBMISSION_DEADLINE,
      document: 'itt',
      pageNumber: 6,
      quotedClause:
        'Tenders must be uploaded to the portal by 12:00 noon on 14 September 2026.',
    },
    { kind: 'award_notification', occursAt: t('2026-10-16T12:00:00+01:00') },
    { kind: 'contract_start', occursAt: t('2026-12-01T00:00:00Z') },
    { kind: 'contract_end', occursAt: t('2030-11-30T00:00:00Z') },
  ],
  requirements: [...blocking, ...unknowns, ...met, ...desirable, ...notApplicable],
  assessments: [
    {
      version: 1,
      recommendation: 'no_bid',
      mandatoryTotal: 26,
      mandatoryPassed: 20,
      mandatoryFailed: 3,
      mandatoryUnknown: 3,
      desirableScore: 25.0,
      rationale:
        'Three mandatory gates fail: ISO 27001 and ISO 14001 are not held, and turnover is £880,000 short of the £5,000,000 threshold. Three further gates cannot be decided from the profile.',
      deadlineUsed: NHS_SUBMISSION_DEADLINE,
      asOfUsed: t('2026-08-24T10:12:00Z'),
      runBy: 'owner',
      historicalNote:
        'Run before the ISO 14001 certificate was added to the profile. Re-running evaluate() against the current snapshot will NOT reproduce these counts, and must not — Invariant 3 means version 1 stays exactly as it was.',
    },
    {
      version: 2,
      recommendation: 'no_bid',
      mandatoryTotal: 26,
      mandatoryPassed: 21,
      mandatoryFailed: 2,
      mandatoryUnknown: 3,
      desirableScore: 25.0,
      rationale:
        'Two mandatory gates fail. ISO 27001 is not held and cannot be obtained before the deadline; annual turnover is £4,120,000 against a £5,000,000 threshold. Three further gates are undecidable from the profile as it stands — employers’ liability cover, three-year net assets and two-year profitability. Adding the missing evidence would resolve the unknowns but would not clear the two failures.',
      deadlineUsed: NHS_SUBMISSION_DEADLINE,
      asOfUsed: DEMO_ASOF,
      runBy: 'owner',
    },
  ],
  // status is `assessed`, not `bidding`: the Workspace tab shows
  // WORKSPACE_NOT_BIDDING_MESSAGE rather than task cards.
  tasks: [],
  responses: [],
};

/** Handy for tests that assert against a single row without scanning the array. */
export const nhsRequirementsByKey = Object.fromEntries(
  nhsTender.requirements.map((r) => [r.key, r]),
) as Record<string, RequirementFixture>;

/** The contract start/end dates above are also the ones the metadata line renders. */
export const nhsContractWindow = { start: d('2026-12-01'), end: d('2030-11-30') };
