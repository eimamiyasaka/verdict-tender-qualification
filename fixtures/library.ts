/**
 * The answer library — six past answers, spec §13.
 *
 * Retrieval in v1 is ILIKE over title and body plus tag overlap, ranked by matched
 * term count then `timesUsed`, top 3 (spec §7.7). At six rows that is
 * indistinguishable from anything cleverer, which is why the vector store is one of
 * the eight things §4 cuts.
 *
 * `librarySuggestionCases` below pins what "Suggest from library" must return for
 * the Leeds method statements, so the workspace can be built and tested before the
 * retrieval function exists.
 */

import type { LibraryAnswerFixture } from './types';

export const demoLibraryAnswers: LibraryAnswerFixture[] = [
  {
    key: 'answer-social-value',
    title: 'Social value — local employment and apprenticeships',
    body: 'Meridian delivers social value through local recruitment, apprenticeships and supply chain spend. On our current contracts we recruit within ten miles of each site, we run a twelve-month cleaning apprenticeship accredited by the British Institute of Cleaning Science, and we report social value outcomes quarterly against the Social Value Model themes. Under this contract we would commit to measurable targets for apprentice starts, local supplier spend and paid volunteering hours, reported to the authority each quarter.',
    tags: ['social_value', 'employment', 'apprenticeships'],
    sourceTender: 'nhs',
    timesUsed: 7,
  },
  {
    key: 'answer-safeguarding',
    title: 'Safeguarding and DBS checking',
    body: 'All operatives working on sites with access to children or vulnerable adults hold an enhanced DBS certificate obtained before their first shift and refreshed every three years. Safeguarding training is delivered at induction and annually thereafter. Our safeguarding lead is a named director, and concerns are escalated within four hours under a documented procedure that has been reviewed by two NHS trusts.',
    tags: ['safeguarding', 'dbs', 'healthcare', 'training'],
    sourceTender: 'nhs',
    timesUsed: 4,
  },
  {
    key: 'answer-tupe',
    title: 'TUPE transfer and workforce continuity',
    body: 'We have transferred staff under TUPE on eleven contracts, most recently 41 staff from an incumbent provider on a three-site NHS contract. Our approach is a consultation timetable agreed within seven days of award, individual meetings with every transferring employee, measurement of terms and conditions against the transferring contract rather than our own, and a retained pay review date. Our transfer completion rate across those contracts is 96% of eligible staff.',
    tags: ['tupe', 'mobilisation', 'workforce', 'hr'],
    sourceTender: 'nhs',
    timesUsed: 9,
  },
  {
    key: 'answer-environmental',
    title: 'Environmental management and carbon reduction',
    body: 'Meridian operates an ISO 14001 certified environmental management system. Chemical use is controlled through a dosing system that removed 78% of single-use plastic from our consumables in 2025. Our fleet is 40% electric with a commitment to full transition by 2029. We measure and report scope 1 and 2 emissions annually and set a reduction target for each contract at mobilisation.',
    tags: ['environmental', 'iso14001', 'carbon', 'net_zero', 'sustainability'],
    sourceTender: 'camden',
    timesUsed: 6,
  },
  {
    key: 'answer-quality-assurance',
    title: 'Quality management, audit and rectification',
    body: 'Our ISO 9001 certified quality management system runs a three-tier audit regime: daily supervisor checks recorded on a mobile app, weekly contract manager audits against the specification, and a monthly independent audit by our quality team. Failures are logged with a rectification window of four hours for critical areas and twenty-four hours otherwise. Audit scores and rectification times are reported to the client monthly and reviewed at contract meetings.',
    tags: ['quality', 'iso9001', 'audit', 'kpi', 'rectification'],
    sourceTender: 'nhs',
    timesUsed: 11,
  },
  {
    key: 'answer-business-continuity',
    title: 'Business continuity and service resilience',
    body: 'Our business continuity plan is tested twice a year and covers staff absence, supply chain failure, site access loss and IT outage. We hold a relief pool sized at 12% of contract headcount, mutual aid arrangements with two regional providers, and a minimum eight weeks of critical consumables in regional stock. During the 2025 storm closures we maintained service on every contract without a reported failure.',
    tags: ['business_continuity', 'resilience', 'risk', 'contingency'],
    sourceTender: 'camden',
    timesUsed: 5,
  },
];

/**
 * What "Suggest from library" must return, in order, for a given requirement.
 * Ranked by matched-term count then `timesUsed`, capped at LIBRARY_SUGGESTION_LIMIT.
 */
export const librarySuggestionCases: {
  requirement: string;
  query: string;
  expectedOrder: string[];
}[] = [
  {
    requirement: 'leeds-ms3',
    query: 'social value commitments measurable targets',
    expectedOrder: ['answer-social-value'],
  },
  {
    requirement: 'leeds-ms2',
    query: 'quality management system audit regime rectification',
    expectedOrder: ['answer-quality-assurance'],
  },
  {
    requirement: 'leeds-ms5',
    query: 'TUPE transfer workforce management',
    expectedOrder: ['answer-tupe'],
  },
  {
    requirement: 'leeds-ms4',
    query: 'sustainability net zero carbon',
    expectedOrder: ['answer-environmental'],
  },
  {
    // No library answer covers mobilisation on its own; TUPE and business
    // continuity both match a term. An empty result would also be honest — what
    // must not happen is a confident irrelevant suggestion.
    requirement: 'leeds-ms1',
    query: 'mobilisation six weeks campus',
    expectedOrder: ['answer-tupe'],
  },
];
