/**
 * `prepare.ts` — the validation, deduplication and shaping half of persistence,
 * asserted against `fixtures/extraction.ts`.
 *
 * The cases that matter here are the unhappy ones. Every draft that does not
 * become a requirement has to be visible as a count somewhere, because a
 * pipeline that quietly drops rows and reports success looks exactly like
 * success.
 */

import { describe, expect, it } from 'vitest';
import {
  CONFIDENCE_THRESHOLD,
  NO_TEXT_LAYER_MESSAGE,
  constraintDedupeKey,
  type RequirementDraft,
} from '../../../../contracts';
import {
  camdenAppendixOutcome,
  duplicateDraftPair,
  emptyResultOutcome,
  lowConfidenceDraft,
  malformedDraft,
  sampleDrafts,
  scannedDocumentCase,
  unknownCredentialDraft,
} from '../../../../fixtures/extraction';
import { allChunksFailedMessage, prepareExtraction, prepareFailedExtraction } from '../prepare';

const base = {
  tenderId: 'tender-nhs',
  documentId: 'nhs-psq',
  filename: 'PSQ.pdf',
  model: 'claude-sonnet-4-6',
  pageCount: 44,
  chunksTotal: 11,
  chunksSucceeded: 10,
  chunksFailed: 1,
};

function prepare(drafts: readonly unknown[], overrides: Partial<typeof base> = {}) {
  return prepareExtraction({ ...base, ...overrides, drafts });
}

describe('a good chunk result', () => {
  const prepared = prepare(sampleDrafts);

  it('turns every draft into a requirement, with its true page and verbatim clause', () => {
    expect(prepared.input.requirements).toHaveLength(sampleDrafts.length);
    for (const draft of sampleDrafts) {
      const row = prepared.input.requirements.find((r) => r.summary === draft.summary);
      expect(row).toBeDefined();
      expect(row?.pageNumber).toBe(draft.pageNumber);
      expect(row?.quotedClause).toBe(draft.quotedClause);
      expect(row?.documentId).toBe(base.documentId);
    }
  });

  it('carries the chunk failure through instead of hiding it behind a success', () => {
    expect(prepared.input.outcome).toMatchObject({
      documentId: 'nhs-psq',
      chunksTotal: 11,
      chunksSucceeded: 10,
      chunksFailed: 1,
      draftsAccepted: 4,
      draftsHeldForReview: 0,
      draftsRejected: 0,
      requirementsCreated: 4,
      citationsCreated: 0,
    });
    expect(prepared.input.status).toBe('complete');
  });
});

describe('drafts that must not reach the matrix', () => {
  it('counts a malformed draft as rejected rather than dropping it quietly', () => {
    const prepared = prepare([malformedDraft, ...sampleDrafts]);
    expect(prepared.input.outcome.draftsRejected).toBe(1);
    expect(prepared.rejections).toHaveLength(1);
    expect(prepared.rejections[0].index).toBe(0);
    expect(prepared.input.requirements).toHaveLength(sampleDrafts.length);
  });

  it('holds a low-confidence draft for review and keeps it out of the matrix', () => {
    expect(lowConfidenceDraft.extractionConfidence).toBeLessThan(CONFIDENCE_THRESHOLD);
    const prepared = prepare([lowConfidenceDraft, ...sampleDrafts]);
    expect(prepared.input.outcome.draftsHeldForReview).toBe(1);
    expect(prepared.input.outcome.draftsAccepted).toBe(sampleDrafts.length);
    expect(prepared.heldForReview).toEqual([lowConfidenceDraft]);
    expect(prepared.input.requirements.some((r) => r.summary === lowConfidenceDraft.summary)).toBe(
      false,
    );
  });

  it('adds the drafts the route already rejected to this document’s total', () => {
    const prepared = prepare([malformedDraft], { chunksFailed: 0, chunksSucceeded: 11 });
    expect(prepared.input.outcome.draftsRejected).toBe(1);
    const withUpstream = prepareExtraction({
      ...base,
      draftsRejectedUpstream: 2,
      drafts: [malformedDraft],
    });
    expect(withUpstream.input.outcome.draftsRejected).toBe(3);
  });
});

describe('a credential code that is not in CredentialType (spec §14)', () => {
  it('keeps a draft the model already typed as `other`, raw code intact', () => {
    const prepared = prepare([unknownCredentialDraft]);
    const [row] = prepared.input.requirements;
    expect(row.kind).toBe('other');
    expect(row.constraintJson).toEqual(unknownCredentialDraft.constraint);
    expect(row.constraintJson).toMatchObject({
      original_kind: 'certification',
      credential_code: 'ISO22301',
    });
  });

  it('rewrites a certification the model typed with an unknown code, never coercing it', () => {
    const invented: RequirementDraft = {
      kind: 'certification',
      obligation: 'mandatory',
      summary: 'ISO 22301 business continuity certification',
      constraint: { kind: 'certification', credential_code: 'ISO22301' },
      pageNumber: 32,
      quotedClause:
        'Bidders must hold current certification to ISO 22301 for business continuity management.',
      clauseReference: '4.5.1',
      extractionConfidence: 0.88,
    };
    const [row] = prepare([invented]).input.requirements;
    expect(row.kind).toBe('other');
    expect(row.constraintJson).toMatchObject({
      kind: 'other',
      original_kind: 'certification',
      credential_code: 'ISO22301',
    });
    // Nothing was coerced to the nearest known code, and nothing was dropped.
    expect(row.constraintJson).not.toMatchObject({ credential_code: 'ISO27001' });
    expect(prepare([invented]).input.outcome.requirementsCreated).toBe(1);
  });

  it('leaves a known code as a certification', () => {
    const [row] = prepare([sampleDrafts[1]]).input.requirements;
    expect(row.kind).toBe('certification');
    expect(row.constraintJson).toEqual({ kind: 'certification', credential_code: 'ISO27001' });
  });
});

describe('deduplication — both citations are kept', () => {
  const { psq, itt } = duplicateDraftPair;

  it('gives the two mentions the same dedupe key', () => {
    expect(constraintDedupeKey(psq.kind, psq.constraint)).toBe(
      constraintDedupeKey(itt.kind, itt.constraint),
    );
  });

  it('keeps the highest-confidence draft and files the loser as a citation', () => {
    const prepared = prepare([itt, psq]);
    expect(prepared.input.requirements).toHaveLength(1);
    const [row] = prepared.input.requirements;
    expect(row.extractionConfidence).toBe(psq.extractionConfidence);
    expect(row.pageNumber).toBe(psq.pageNumber);
    expect(row.summary).toBe(psq.summary);
    expect(row.additionalCitations).toEqual([
      {
        documentId: base.documentId,
        pageNumber: itt.pageNumber,
        quotedClause: itt.quotedClause,
        clauseReference: itt.clauseReference,
      },
    ]);
    expect(prepared.input.outcome).toMatchObject({
      draftsAccepted: 2,
      requirementsCreated: 1,
      citationsCreated: 1,
    });
  });

  it('does not depend on the order the drafts arrived in', () => {
    const forwards = prepare([psq, itt]).input.requirements[0];
    const backwards = prepare([itt, psq]).input.requirements[0];
    expect(forwards.pageNumber).toBe(backwards.pageNumber);
    expect(forwards.additionalCitations).toEqual(backwards.additionalCitations);
  });

  it('carries a dedupe key so the data layer can merge across documents', () => {
    const [row] = prepare([psq]).input.requirements;
    expect(row.dedupeKey).toBe(constraintDedupeKey('certification', psq.constraint));
  });
});

describe('date constraints are mirrored into key dates', () => {
  const deadline: RequirementDraft = {
    kind: 'date',
    obligation: 'mandatory',
    summary: 'Submission deadline',
    constraint: {
      kind: 'date',
      date_kind: 'submission_deadline',
      occurs_at: '2026-09-14T12:00:00+01:00',
    },
    pageNumber: 4,
    quotedClause: 'Tenders must be received by 12:00 on 14 September 2026.',
    clauseReference: '1.2',
    extractionConfidence: 0.95,
  };

  it('writes a key date and keeps the requirement row', () => {
    const prepared = prepare([deadline]);
    expect(prepared.input.requirements).toHaveLength(1);
    expect(prepared.input.keyDates).toEqual([
      {
        kind: 'submission_deadline',
        occursAt: '2026-09-14T12:00:00+01:00',
        documentId: base.documentId,
        pageNumber: 4,
        quotedClause: deadline.quotedClause,
      },
    ]);
  });

  it('does not mirror the same date twice', () => {
    const prepared = prepare([deadline, { ...deadline, pageNumber: 9, extractionConfidence: 0.7 }]);
    expect(prepared.input.keyDates).toHaveLength(1);
    expect(prepared.input.requirements[0].additionalCitations).toHaveLength(1);
  });
});

describe('a document that parsed and yielded nothing', () => {
  it('is an outcome of zeroes, not an error', () => {
    const prepared = prepareExtraction({
      ...base,
      documentId: 'camden-spec',
      filename: 'Specification.pdf',
      chunksTotal: 5,
      chunksSucceeded: 5,
      chunksFailed: 0,
      drafts: [],
    });
    expect(prepared.input.outcome).toEqual(emptyResultOutcome);
    expect(prepared.input.status).toBe('complete');
    expect(prepared.input.extractionError).toBeNull();
  });
});

describe('a document where no chunk landed at all', () => {
  it('is failed, not completed with a zero beside it', () => {
    const prepared = prepareExtraction({
      ...base,
      chunksTotal: 11,
      chunksSucceeded: 0,
      chunksFailed: 11,
      drafts: [],
    });
    expect(prepared.input.status).toBe('failed');
    expect(prepared.input.extractionError).toBe(allChunksFailedMessage(11));
    expect(prepared.input.outcome.chunksFailed).toBe(11);
    expect(prepared.input.requirements).toEqual([]);
  });

  it('is still a completed document when one chunk landed', () => {
    const prepared = prepare(sampleDrafts, { chunksSucceeded: 1, chunksFailed: 10 });
    expect(prepared.input.status).toBe('complete');
    expect(prepared.input.extractionError).toBeNull();
  });
});

describe('a scanned PDF fails before any model call', () => {
  it('stores the message verbatim and counts no chunks at all', () => {
    const payload = prepareFailedExtraction({
      tenderId: 'tender-camden',
      documentId: 'camden-appendix',
      filename: scannedDocumentCase.filename,
      pageCount: scannedDocumentCase.pageCount,
      message: NO_TEXT_LAYER_MESSAGE,
    });
    expect(payload.status).toBe(scannedDocumentCase.expectedExtractionStatus);
    expect(payload.extractionError).toBe(scannedDocumentCase.expectedExtractionError);
    expect(payload.outcome).toEqual(camdenAppendixOutcome);
    expect(payload.requirements).toEqual([]);
    expect(payload.keyDates).toEqual([]);
  });
});
