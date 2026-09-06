/**
 * Validation, deduplication and shaping — spec §8 step 7.
 *
 * This is the pure half of `persist.ts`: no Prisma, no network, no clock. It
 * takes whatever the browser posted back, decides what may become a
 * `Requirement`, and returns exactly one payload for the data layer to write
 * in one transaction (spec §6.3 — no Prisma call outside `src/lib/db/`).
 *
 * Four things happen here and each one is a spec §14 edge case:
 *   - Every draft is validated with `RequirementDraftSchema`. Rejects are
 *     COUNTED as `draftsRejected`, never dropped quietly: a shape problem
 *     nobody can see is a shape problem that persists.
 *   - Drafts below `CONFIDENCE_THRESHOLD` are held for review and do not enter
 *     the matrix.
 *   - A `credential_code` that is not in `CredentialType` becomes kind `other`
 *     with the raw string preserved, so it shows in the matrix as `unknown`
 *     rather than being dropped or coerced to the nearest known code.
 *   - Duplicates collapse on `constraintDedupeKey`. The highest-confidence
 *     draft becomes the `Requirement`; every loser's document, page and clause
 *     becomes a `RequirementCitation`. This is what makes "both citations are
 *     kept" true rather than aspirational.
 */

import {
  CONFIDENCE_THRESHOLD,
  RequirementDraftSchema,
  constraintDedupeKey,
  isKnownCredentialCode,
  unresolvedCredentialConstraint,
  type DocumentExtractionOutcome,
  type KeyDateKind,
  type Obligation,
  type RequirementConstraint,
  type RequirementDraft,
  type RequirementKind,
} from '../../../contracts';

/* -------------------------------------------------------------------------
 * The payload handed to `persistExtraction` in `src/lib/db/ingest.ts`.
 * ---------------------------------------------------------------------- */

/** A losing duplicate's provenance. One row of `requirement_citations`. */
export interface PreparedCitation {
  documentId: string;
  pageNumber: number;
  quotedClause: string;
  clauseReference: string | null;
}

/** One row of `requirements`, with the citations that lost to it attached. */
export interface PreparedRequirement {
  kind: RequirementKind;
  obligation: Obligation;
  summary: string;
  constraintJson: RequirementConstraint;
  /**
   * `constraintDedupeKey(kind, constraint)`. Carried so the data layer can
   * collapse a requirement already extracted from another document in the same
   * tender onto this one — dedupe within this batch has happened here, dedupe
   * against rows already in the database can only happen there.
   */
  dedupeKey: string;
  documentId: string;
  pageNumber: number;
  quotedClause: string;
  clauseReference: string | null;
  questionRef: string | null;
  wordLimit: number | null;
  weighting: number | null;
  extractionConfidence: number;
  additionalCitations: PreparedCitation[];
}

/** A `date` constraint mirrored into `key_dates` (spec §8 step 7, §7.5). */
export interface PreparedKeyDate {
  kind: KeyDateKind;
  /** ISO 8601 instant with offset, exactly as the constraint stated it. */
  occursAt: string;
  documentId: string;
  pageNumber: number;
  quotedClause: string;
}

export interface PersistExtractionInput {
  tenderId: string;
  documentId: string;
  /** For the `extraction.completed` event payload (`ExtractionCompletedPayload`). */
  filename: string;
  model: string;
  pageCount: number | null;
  /**
   * `complete` even when chunks failed — one chunk failing does not fail the
   * document. `failed` covers the pre-model cases (no text layer, a file that
   * would not open) and the one post-model case where nothing at all landed:
   * see `allChunksFailedMessage`.
   */
  status: 'complete' | 'failed';
  /** The user-facing message, stored verbatim on `tender_documents`. */
  extractionError: string | null;
  requirements: PreparedRequirement[];
  keyDates: PreparedKeyDate[];
  outcome: DocumentExtractionOutcome;
}

/* -------------------------------------------------------------------------
 * Input
 * ---------------------------------------------------------------------- */

export interface PrepareExtractionInput {
  tenderId: string;
  documentId: string;
  filename: string;
  model: string;
  pageCount: number | null;
  chunksTotal: number;
  chunksSucceeded: number;
  chunksFailed: number;
  /**
   * Drafts the extraction route already rejected against
   * `RequirementDraftSchema` before they could be posted back. Added to this
   * document's `draftsRejected` so the count is the document's total, not this
   * step's.
   */
  draftsRejectedUpstream?: number;
  /** Unknown, not `RequirementDraft[]`: this arrives from the browser. */
  drafts: readonly unknown[];
}

export interface PreparedExtraction {
  input: PersistExtractionInput;
  /**
   * Below `CONFIDENCE_THRESHOLD`. Spec §7 has no table for a review queue, so
   * in v1 the queue is the count on the outcome and the drafts themselves are
   * returned to the caller rather than written. They are never folded into
   * anything that looks like success.
   */
  heldForReview: RequirementDraft[];
  /** Why each rejected draft was rejected. Not persisted; useful in a log. */
  rejections: { index: number; message: string }[];
}

/**
 * Every chunk failing is not "one chunk failing". A document that returned
 * nothing at all must not sit in the Documents tab marked complete with a zero
 * beside it, because `extracted` is the status the tender settles on and an
 * assessment run against an empty matrix reads as "all gates clear" — the
 * dangerous failure mode in spec §8, arrived at from the other direction.
 *
 * Not in `contracts.ts`: no other session renders it.
 */
export function allChunksFailedMessage(chunksTotal: number): string {
  return (
    'None of the ' +
    chunksTotal +
    ' page ranges in this document could be extracted, so nothing from it has entered the matrix. Re-upload the file to try again.'
  );
}

/* -------------------------------------------------------------------------
 * Preparation
 * ---------------------------------------------------------------------- */

/**
 * Spec §14, row 4. The model was told to emit `other` itself for a scheme that
 * is not in `credential_types`; when it does not, the row is rewritten here
 * rather than dropped or coerced to the nearest known code. The raw string
 * survives in `constraintJson`, and the evaluator returns `unknown`.
 */
function resolveCredentialCode(draft: RequirementDraft): {
  kind: RequirementKind;
  constraint: RequirementConstraint;
} {
  if (draft.kind !== 'certification' || draft.constraint.kind !== 'certification') {
    return { kind: draft.kind, constraint: draft.constraint };
  }
  const code = draft.constraint.credential_code.trim();
  if (isKnownCredentialCode(code)) {
    return { kind: 'certification', constraint: { kind: 'certification', credential_code: code } };
  }
  return { kind: 'other', constraint: unresolvedCredentialConstraint(code) };
}

function toCitation(requirement: PreparedRequirement): PreparedCitation {
  return {
    documentId: requirement.documentId,
    pageNumber: requirement.pageNumber,
    quotedClause: requirement.quotedClause,
    clauseReference: requirement.clauseReference,
  };
}

function keyDateFrom(requirement: PreparedRequirement): PreparedKeyDate | null {
  const constraint = requirement.constraintJson;
  if (constraint.kind !== 'date') return null;
  return {
    kind: constraint.date_kind,
    occursAt: constraint.occurs_at,
    documentId: requirement.documentId,
    pageNumber: requirement.pageNumber,
    quotedClause: requirement.quotedClause,
  };
}

/**
 * Validates, gates on confidence, resolves credential codes, deduplicates and
 * derives key dates. Returns the single payload the data layer writes.
 */
export function prepareExtraction(input: PrepareExtractionInput): PreparedExtraction {
  const accepted: RequirementDraft[] = [];
  const heldForReview: RequirementDraft[] = [];
  const rejections: { index: number; message: string }[] = [];

  input.drafts.forEach((raw, index) => {
    const parsed = RequirementDraftSchema.safeParse(raw);
    if (!parsed.success) {
      rejections.push({ index, message: parsed.error.issues.map((i) => i.message).join('; ') });
      return;
    }
    if (parsed.data.extractionConfidence < CONFIDENCE_THRESHOLD) {
      heldForReview.push(parsed.data);
      return;
    }
    accepted.push(parsed.data);
  });

  // Highest confidence first, so the survivor of each key is decided on first
  // sight. The sort is stable, so equal confidence keeps the model's own order.
  // The winner takes the whole row, obligation included; a loser only ever
  // contributes a citation.
  const ordered = [...accepted].sort((a, b) => b.extractionConfidence - a.extractionConfidence);

  const byKey = new Map<string, PreparedRequirement>();
  const requirements: PreparedRequirement[] = [];

  for (const draft of ordered) {
    const { kind, constraint } = resolveCredentialCode(draft);
    const dedupeKey = constraintDedupeKey(kind, constraint);
    const row: PreparedRequirement = {
      kind,
      obligation: draft.obligation,
      summary: draft.summary,
      constraintJson: constraint,
      dedupeKey,
      documentId: input.documentId,
      pageNumber: draft.pageNumber,
      quotedClause: draft.quotedClause,
      clauseReference: draft.clauseReference ?? null,
      questionRef: draft.questionRef ?? null,
      wordLimit: draft.wordLimit ?? null,
      weighting: draft.weighting ?? null,
      extractionConfidence: draft.extractionConfidence,
      additionalCitations: [],
    };

    const winner = byKey.get(dedupeKey);
    if (winner) {
      winner.additionalCitations.push(toCitation(row));
      continue;
    }
    byKey.set(dedupeKey, row);
    requirements.push(row);
  }

  const keyDates = requirements
    .map(keyDateFrom)
    .filter((keyDate): keyDate is PreparedKeyDate => keyDate !== null);

  const citationsCreated = requirements.reduce((n, r) => n + r.additionalCitations.length, 0);

  const outcome: DocumentExtractionOutcome = {
    documentId: input.documentId,
    chunksTotal: input.chunksTotal,
    chunksSucceeded: input.chunksSucceeded,
    chunksFailed: input.chunksFailed,
    draftsAccepted: accepted.length,
    draftsHeldForReview: heldForReview.length,
    draftsRejected: rejections.length + (input.draftsRejectedUpstream ?? 0),
    requirementsCreated: requirements.length,
    citationsCreated,
  };

  const nothingSucceeded = input.chunksTotal > 0 && input.chunksSucceeded === 0;

  return {
    input: {
      tenderId: input.tenderId,
      documentId: input.documentId,
      filename: input.filename,
      model: input.model,
      pageCount: input.pageCount,
      status: nothingSucceeded ? 'failed' : 'complete',
      extractionError: nothingSucceeded ? allChunksFailedMessage(input.chunksTotal) : null,
      requirements,
      keyDates,
      outcome,
    },
    heldForReview,
    rejections,
  };
}

/**
 * The pre-model failure path — no text layer (spec §8 step 3), or a file that
 * would not open. Nothing was chunked and nothing was sent, so every count is
 * zero and the message is stored verbatim. It goes through the same data-layer
 * call as a success so the document, its status and its event are still
 * written in one transaction.
 */
export function prepareFailedExtraction(input: {
  tenderId: string;
  documentId: string;
  filename: string;
  pageCount: number | null;
  message: string;
}): PersistExtractionInput {
  return {
    tenderId: input.tenderId,
    documentId: input.documentId,
    filename: input.filename,
    model: '',
    pageCount: input.pageCount,
    status: 'failed',
    extractionError: input.message,
    requirements: [],
    keyDates: [],
    outcome: {
      documentId: input.documentId,
      chunksTotal: 0,
      chunksSucceeded: 0,
      chunksFailed: 0,
      draftsAccepted: 0,
      draftsHeldForReview: 0,
      draftsRejected: 0,
      requirementsCreated: 0,
      citationsCreated: 0,
    },
  };
}
