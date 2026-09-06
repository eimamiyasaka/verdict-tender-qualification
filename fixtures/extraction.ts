/**
 * Extraction pipeline fixtures — spec §8.
 *
 * These exist so the ingest session can build and test `persist.ts` and the review
 * queue without an API key, and so the Documents tab can be built against real
 * success and failure shapes rather than an imagined one.
 *
 * The important cases are the unhappy ones: a chunk that fails, a draft the model
 * was not confident about, a draft whose constraint does not match its kind, a
 * credential code that does not exist, and a PDF with no text layer.
 */

import {
  NO_TEXT_LAYER_MESSAGE,
  unresolvedCredentialConstraint,
  type ChunkPlan,
  type DocumentExtractionOutcome,
  type ExtractRequirementsFailure,
  type ExtractRequirementsRequest,
  type ExtractRequirementsSuccess,
  type PageText,
  type RequirementDraft,
} from '../contracts';

/* ---------------------------------------------------------------------------
 * Chunk planning. 5-page windows, 1 page of overlap, last window ends on the last
 * page. `planChunks(n)` must return exactly these.
 * ------------------------------------------------------------------------- */

export const chunkPlanCases: { pageCount: number; expected: ChunkPlan[] }[] = [
  { pageCount: 0, expected: [] },
  { pageCount: 1, expected: [{ index: 0, startPage: 1, endPage: 1 }] },
  { pageCount: 5, expected: [{ index: 0, startPage: 1, endPage: 5 }] },
  {
    pageCount: 6,
    expected: [
      { index: 0, startPage: 1, endPage: 5 },
      { index: 1, startPage: 5, endPage: 6 },
    ],
  },
  {
    pageCount: 12,
    expected: [
      { index: 0, startPage: 1, endPage: 5 },
      { index: 1, startPage: 5, endPage: 9 },
      { index: 2, startPage: 9, endPage: 12 },
    ],
  },
  {
    // The NHS PSQ. Eleven chunks at concurrency 4.
    pageCount: 44,
    expected: [
      { index: 0, startPage: 1, endPage: 5 },
      { index: 1, startPage: 5, endPage: 9 },
      { index: 2, startPage: 9, endPage: 13 },
      { index: 3, startPage: 13, endPage: 17 },
      { index: 4, startPage: 17, endPage: 21 },
      { index: 5, startPage: 21, endPage: 25 },
      { index: 6, startPage: 25, endPage: 29 },
      { index: 7, startPage: 29, endPage: 33 },
      { index: 8, startPage: 33, endPage: 37 },
      { index: 9, startPage: 37, endPage: 41 },
      { index: 10, startPage: 41, endPage: 44 },
    ],
  },
];

/* ---------------------------------------------------------------------------
 * Text-layer detection, before any model call. Threshold is 200 chars per page.
 * ------------------------------------------------------------------------- */

export const textLayerCases: {
  name: string;
  totalCharacters: number;
  pageCount: number;
  expected: boolean;
}[] = [
  { name: 'ordinary text PDF', totalCharacters: 62_400, pageCount: 44, expected: true },
  { name: 'exactly at the threshold', totalCharacters: 2_400, pageCount: 12, expected: true },
  { name: 'one character short', totalCharacters: 2_399, pageCount: 12, expected: false },
  { name: 'a scan — page furniture only', totalCharacters: 310, pageCount: 12, expected: false },
  { name: 'no text at all', totalCharacters: 0, pageCount: 12, expected: false },
  { name: 'no pages', totalCharacters: 0, pageCount: 0, expected: false },
];

/**
 * Camden's Appendix C. `hasTextLayer(310, 12)` is false, so the document is marked
 * failed with this message stored verbatim and no model call is ever made.
 */
export const scannedDocumentCase = {
  filename: 'Appendix C — Site Schedule.pdf',
  pageCount: 12,
  totalCharacters: 310,
  expectedExtractionStatus: 'failed' as const,
  expectedExtractionError: NO_TEXT_LAYER_MESSAGE,
};

/* ---------------------------------------------------------------------------
 * A chunk, as pdf.js hands it over. Page numbers are the true ones.
 * ------------------------------------------------------------------------- */

export const samplePages: PageText[] = [
  {
    pageNumber: 29,
    text: '4.1 Quality and environmental management\n\n4.1.1 Bidders must hold current certification to ISO 9001 for a quality management system covering cleaning and facilities management services.\n\n4.1.2 Bidders must hold current certification to ISO 14001 for an environmental management system, or provide evidence of an equivalent environmental management system independently verified within the last three years.\n\n4.1.3 Certification to ISO 45001 is not mandatory but will be viewed favourably in the evaluation of technical ability.',
  },
  {
    pageNumber: 30,
    text: '4.3 Health and safety\n\n4.3.1 Bidders must hold current CHAS accreditation or membership of an equivalent scheme registered under the Safety Schemes in Procurement (SSIP) umbrella.\n\n4.3.3 Bidders employing five or more people must provide a written health and safety policy signed by a director.\n\n4.3.4 Registration with Constructionline at Gold level is desirable and may reduce the evidence required at contract award.',
  },
  {
    pageNumber: 31,
    text: '4.2 Information security\n\n4.2.1 Bidders must hold current certification to ISO/IEC 27001 covering the scope of the services described in the Specification. Certification must be issued by a UKAS-accredited certification body and must be valid at the date of tender submission. Failure to evidence this requirement will result in your submission being excluded from further evaluation.\n\n4.2.2 All suppliers handling Authority data must hold a current Cyber Essentials certificate as a minimum.\n\n4.2.3 Suppliers holding Cyber Essentials Plus will be awarded additional marks under the information governance criterion.',
  },
];

export const sampleChunkRequest: ExtractRequirementsRequest = {
  documentId: 'nhs-psq',
  filename: 'PSQ.pdf',
  docType: 'psq',
  chunk: {
    index: 7,
    startPage: 29,
    endPage: 33,
    text: samplePages.map((p) => '[page ' + p.pageNumber + ']\n' + p.text).join('\n\n'),
  },
};

/** What a good chunk result looks like. Every draft carries a real page and quote. */
export const sampleDrafts: RequirementDraft[] = [
  {
    kind: 'certification',
    obligation: 'mandatory',
    summary: 'ISO 9001 quality management certification',
    constraint: { kind: 'certification', credential_code: 'ISO9001' },
    pageNumber: 29,
    quotedClause:
      'Bidders must hold current certification to ISO 9001 for a quality management system covering cleaning and facilities management services.',
    clauseReference: '4.1.1',
    extractionConfidence: 0.97,
  },
  {
    kind: 'certification',
    obligation: 'mandatory',
    summary: 'ISO 27001 certification',
    constraint: { kind: 'certification', credential_code: 'ISO27001' },
    pageNumber: 31,
    quotedClause:
      'Bidders must hold current certification to ISO/IEC 27001 covering the scope of the services described in the Specification. Certification must be issued by a UKAS-accredited certification body and must be valid at the date of tender submission. Failure to evidence this requirement will result in your submission being excluded from further evaluation.',
    clauseReference: '4.2.1',
    extractionConfidence: 0.96,
  },
  {
    kind: 'certification',
    obligation: 'desirable',
    summary: 'ISO 45001 occupational health and safety certification',
    constraint: { kind: 'certification', credential_code: 'ISO45001' },
    pageNumber: 29,
    quotedClause:
      'Certification to ISO 45001 is not mandatory but will be viewed favourably in the evaluation of technical ability.',
    clauseReference: '4.1.3',
    extractionConfidence: 0.89,
  },
  {
    kind: 'policy',
    obligation: 'mandatory',
    summary: 'Health and safety policy',
    constraint: { kind: 'policy', policy_type: 'health_safety' },
    pageNumber: 30,
    quotedClause:
      'Bidders employing five or more people must provide a written health and safety policy signed by a director.',
    clauseReference: '4.3.3',
    extractionConfidence: 0.94,
  },
];

export const sampleChunkSuccess: ExtractRequirementsSuccess = {
  ok: true,
  documentId: 'nhs-psq',
  chunkIndex: 7,
  model: 'claude-sonnet-4-6',
  drafts: sampleDrafts,
  rejectedCount: 0,
};

/**
 * One chunk failing does not fail the document (spec §8). The count is stored on
 * the event and shown in the Documents tab; the other ten chunks still land.
 */
export const sampleChunkFailure: ExtractRequirementsFailure = {
  ok: false,
  documentId: 'nhs-psq',
  chunkIndex: 4,
  error: {
    code: 'timeout',
    message: 'The model did not respond within 60 seconds for pages 17–21.',
  },
};

/* ---------------------------------------------------------------------------
 * Drafts that must not reach the matrix, and what happens to each instead.
 * ------------------------------------------------------------------------- */

/** Below CONFIDENCE_THRESHOLD. Held in the review queue, not persisted as a Requirement. */
export const lowConfidenceDraft: RequirementDraft = {
  kind: 'experience',
  obligation: 'mandatory',
  summary: 'Possibly three contracts of similar scope',
  constraint: { kind: 'experience', min_count: 3 },
  pageNumber: 41,
  quotedClause:
    'The Authority may require evidence of comparable delivery, the extent of which will be determined at the evaluation stage.',
  clauseReference: '7.6',
  extractionConfidence: 0.41,
};

/**
 * Fails `RequirementDraftSchema`: `kind` is certification but the constraint has no
 * `credential_code`. Zod rejects it at the boundary and the database CHECK would
 * reject it too. It is counted on the outcome as `draftsRejected`, never dropped
 * quietly — a shape problem that nobody can see is a shape problem that persists.
 */
export const malformedDraft = {
  kind: 'certification',
  obligation: 'mandatory',
  summary: 'Some accreditation',
  constraint: { kind: 'certification' },
  pageNumber: 31,
  quotedClause: 'Bidders must hold an appropriate accreditation.',
  extractionConfidence: 0.72,
} as const;

/**
 * Spec §14, row 4. The buyer named a scheme that is not in `credential_types`. The
 * row is stored as `kind = 'other'` with the raw string preserved, and evaluates to
 * `unknown` — visible in the matrix and answerable by a human, rather than silently
 * dropped or coerced to the nearest known code.
 */
export const unknownCredentialDraft: RequirementDraft = {
  kind: 'other',
  obligation: 'mandatory',
  summary: 'ISO 22301 business continuity certification',
  constraint: unresolvedCredentialConstraint('ISO22301'),
  pageNumber: 32,
  quotedClause:
    'Bidders must hold current certification to ISO 22301 for business continuity management.',
  clauseReference: '4.5.1',
  extractionConfidence: 0.88,
};

/**
 * The same obligation stated in two documents. Both drafts are emitted (spec §8),
 * the higher-confidence one becomes the `Requirement`, and the loser's provenance
 * becomes a `RequirementCitation`. `constraintDedupeKey` must return the same value
 * for both.
 */
export const duplicateDraftPair: { psq: RequirementDraft; itt: RequirementDraft } = {
  psq: {
    kind: 'certification',
    obligation: 'mandatory',
    summary: 'ISO 27001 certification',
    constraint: { kind: 'certification', credential_code: 'ISO27001' },
    pageNumber: 31,
    quotedClause:
      'Bidders must hold current certification to ISO/IEC 27001 covering the scope of the services described in the Specification.',
    clauseReference: '4.2.1',
    extractionConfidence: 0.96,
  },
  itt: {
    kind: 'certification',
    obligation: 'mandatory',
    summary: 'ISO 27001 required throughout the contract',
    constraint: { kind: 'certification', credential_code: 'ISO27001' },
    pageNumber: 9,
    quotedClause:
      'Tenderers are reminded that ISO/IEC 27001 certification is a condition of participation and must remain valid throughout the contract term.',
    clauseReference: '1.4',
    extractionConfidence: 0.9,
  },
};

/* ---------------------------------------------------------------------------
 * The document-level outcome the Documents tab and the audit log both read.
 * ------------------------------------------------------------------------- */

/** NHS PSQ: eleven chunks, one timed out, and the tab says so. */
export const nhsPsqOutcome: DocumentExtractionOutcome = {
  documentId: 'nhs-psq',
  chunksTotal: 11,
  chunksSucceeded: 10,
  chunksFailed: 1,
  draftsAccepted: 26,
  draftsHeldForReview: 3,
  draftsRejected: 1,
  requirementsCreated: 24,
  citationsCreated: 2,
};

/** Camden Appendix C: failed before any chunk was planned. */
export const camdenAppendixOutcome: DocumentExtractionOutcome = {
  documentId: 'camden-appendix',
  chunksTotal: 0,
  chunksSucceeded: 0,
  chunksFailed: 0,
  draftsAccepted: 0,
  draftsHeldForReview: 0,
  draftsRejected: 0,
  requirementsCreated: 0,
  citationsCreated: 0,
};

/**
 * Spec §14: a document that parsed fine and yielded nothing is not an empty matrix,
 * it is a message. `NO_REQUIREMENTS_MESSAGE` renders instead of a blank table.
 */
export const emptyResultOutcome: DocumentExtractionOutcome = {
  documentId: 'camden-spec',
  chunksTotal: 5,
  chunksSucceeded: 5,
  chunksFailed: 0,
  draftsAccepted: 0,
  draftsHeldForReview: 0,
  draftsRejected: 0,
  requirementsCreated: 0,
  citationsCreated: 0,
};
