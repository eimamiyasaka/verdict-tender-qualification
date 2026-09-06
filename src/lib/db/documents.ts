/**
 * Tender documents (§7.5) and the persistence end of the extraction pipeline (§8).
 *
 * The browser reads the PDF (pdf.js) and the model call goes through
 * `/api/extract-requirements`; this module records what came back. One chunk
 * failing never fails the document — the failed count is stored on the event and
 * surfaced in the Documents tab, because a pipeline that unions an empty result
 * into a total and reports success looks exactly like success.
 */

import {
  CONFIDENCE_THRESHOLD,
  RequirementDraftSchema,
  constraintDedupeKey,
  type DocumentExtractionOutcome,
  type RequirementConstraint,
  type RequirementDraft as ContractRequirementDraft,
} from "../../../contracts";
import type { DocumentType, ExtractionStatus, RequirementDraft, TenderDocument } from "@/lib/types";
import { prisma } from "./client";
import { appendEvent } from "./events";
import {
  persistExtraction,
  settleTenderStatus,
  type PersistKeyDateInput,
  type PersistRequirementInput,
} from "./ingest";

interface DocumentRow {
  id: string;
  tenderId: string;
  orgId: string;
  filename: string;
  docType: string;
  filePath: string | null;
  pageCount: number | null;
  extractionStatus: string;
  extractionError: string | null;
  uploadedAt: Date;
}

export function toDocument(row: DocumentRow): TenderDocument {
  return {
    id: row.id,
    tenderId: row.tenderId,
    orgId: row.orgId,
    filename: row.filename,
    docType: row.docType as DocumentType,
    filePath: row.filePath,
    pageCount: row.pageCount,
    extractionStatus: row.extractionStatus as ExtractionStatus,
    extractionError: row.extractionError,
    uploadedAt: row.uploadedAt,
  };
}

export async function listDocuments(orgId: string, tenderId: string): Promise<TenderDocument[]> {
  const rows = await prisma.tenderDocument.findMany({
    where: { orgId, tenderId },
    orderBy: { uploadedAt: "asc" },
  });
  return rows.map(toDocument);
}

export async function getDocument(orgId: string, documentId: string): Promise<TenderDocument | null> {
  const row = await prisma.tenderDocument.findFirst({ where: { id: documentId, orgId } });
  return row ? toDocument(row) : null;
}

/* ---------------------------------------------------------------------------
 * Writes
 * ------------------------------------------------------------------------- */

export async function addDocument(
  orgId: string,
  userId: string,
  tenderId: string,
  input: { filename: string; docType: DocumentType; pageCount: number | null },
): Promise<TenderDocument> {
  return prisma.$transaction(async (tx) => {
    const tender = await tx.tender.findFirst({ where: { id: tenderId, orgId }, select: { status: true } });
    if (!tender) throw new Error("Tender not found");

    const doc = await tx.tenderDocument.create({
      data: {
        tenderId,
        orgId,
        filename: input.filename,
        docType: input.docType,
        // Runtime uploads are read in the browser and discarded (§6.4).
        filePath: null,
        pageCount: input.pageCount,
        extractionStatus: "pending",
      },
    });
    if (tender.status === "draft") {
      await tx.tender.update({ where: { id: tenderId }, data: { status: "extracting" } });
    }
    await appendEvent(tx, {
      orgId,
      actorId: userId,
      actorKind: "user",
      action: "document.uploaded",
      subjectTable: "tender_documents",
      subjectId: doc.id,
      payload: {
        tenderId,
        filename: doc.filename,
        docType: doc.docType,
        pageCount: doc.pageCount,
      },
    });
    return toDocument(doc);
  });
}

export async function markExtractionRunning(orgId: string, documentId: string): Promise<void> {
  const { count } = await prisma.tenderDocument.updateMany({
    where: { id: documentId, orgId },
    data: { extractionStatus: "running" },
  });
  if (count === 0) throw new Error("Document not found");
}

export interface ExtractionFailure {
  status: "failed";
  /** The user-facing message, stored verbatim on the document (§8 step 3). */
  error: string;
  pageCount: number | null;
}

export interface ExtractionSuccess {
  status: "complete";
  pageCount: number | null;
  model: string;
  chunkCount: number;
  failedChunks: number;
  drafts: RequirementDraft[];
}

/** What the upload panel reports back after a document settles. */
export interface PersistOutcome {
  created: number;
  citationsAdded: number;
  heldForReview: number;
  rejected: number;
  keyDatesCreated: number;
}

/**
 * Records the outcome of extracting one document.
 *
 * A failure writes the message verbatim and one `extraction.failed` event. A
 * success validates and deduplicates the drafts with the frozen helpers in
 * `contracts.ts`, then hands the rows to `persistExtraction`, which owns the
 * transaction, the row writes and the single `extraction.completed` event.
 *
 * `feat/extraction-live` owns `src/lib/ingest/` and will call
 * `persistExtraction` directly with rows it has already validated. This function
 * stays for the upload panel that shipped against it on `main`.
 */
export async function recordExtractionOutcome(
  orgId: string,
  userId: string,
  documentId: string,
  outcome: ExtractionFailure | ExtractionSuccess,
): Promise<{ document: TenderDocument; persisted: PersistOutcome | null }> {
  const doc = await prisma.tenderDocument.findFirst({ where: { id: documentId, orgId } });
  if (!doc) throw new Error("Document not found");

  if (outcome.status === "failed") {
    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.tenderDocument.update({
        where: { id: documentId },
        data: {
          extractionStatus: "failed",
          extractionError: outcome.error,
          pageCount: outcome.pageCount ?? doc.pageCount,
        },
      });
      await appendEvent(tx, {
        orgId,
        actorId: null,
        actorKind: "system",
        action: "extraction.failed",
        subjectTable: "tender_documents",
        subjectId: documentId,
        payload: {
          tenderId: doc.tenderId,
          filename: doc.filename,
          error: outcome.error,
          pageCount: outcome.pageCount ?? doc.pageCount,
        },
      });
      await settleTenderStatus(tx, orgId, doc.tenderId);
      return row;
    });
    return { document: toDocument(updated), persisted: null };
  }

  const sifted = siftDrafts(outcome.drafts);
  const result = await persistExtraction(orgId, {
    tenderId: doc.tenderId,
    documentId,
    model: outcome.model,
    actorId: userId,
    pageCount: outcome.pageCount,
    requirements: sifted.requirements,
    keyDates: sifted.keyDates,
    outcome: {
      documentId,
      chunksTotal: outcome.chunkCount,
      chunksSucceeded: outcome.chunkCount - outcome.failedChunks,
      chunksFailed: outcome.failedChunks,
      draftsAccepted: sifted.accepted,
      draftsHeldForReview: sifted.heldForReview,
      draftsRejected: sifted.rejected,
      requirementsCreated: sifted.requirements.length,
      citationsCreated: sifted.citationCount,
    } satisfies DocumentExtractionOutcome,
  });

  const document = await prisma.tenderDocument.findFirstOrThrow({ where: { id: documentId, orgId } });
  return {
    document: toDocument(document),
    persisted: {
      created: result.requirementsCreated,
      citationsAdded: result.citationsCreated,
      heldForReview: sifted.heldForReview,
      rejected: sifted.rejected,
      keyDatesCreated: result.keyDatesCreated,
    },
  };
}

/**
 * Validate, threshold and deduplicate a chunk's drafts using only the frozen
 * rules in `contracts.ts` — `RequirementDraftSchema`, `CONFIDENCE_THRESHOLD` and
 * `constraintDedupeKey`. The highest-confidence draft of a duplicate group
 * becomes the requirement; every loser's provenance becomes a citation (§8 step 7).
 */
function siftDrafts(drafts: RequirementDraft[]): {
  requirements: PersistRequirementInput[];
  keyDates: PersistKeyDateInput[];
  accepted: number;
  heldForReview: number;
  rejected: number;
  citationCount: number;
} {
  const valid: ContractRequirementDraft[] = [];
  let rejected = 0;
  let heldForReview = 0;

  for (const draft of drafts) {
    const parsed = RequirementDraftSchema.safeParse(draft);
    if (!parsed.success) {
      rejected += 1;
      continue;
    }
    if (parsed.data.extractionConfidence < CONFIDENCE_THRESHOLD) {
      heldForReview += 1;
      continue;
    }
    valid.push(parsed.data);
  }

  const groups = new Map<string, ContractRequirementDraft[]>();
  for (const draft of valid) {
    const key = constraintDedupeKey(draft.kind, draft.constraint);
    const group = groups.get(key);
    if (group) group.push(draft);
    else groups.set(key, [draft]);
  }

  const requirements: PersistRequirementInput[] = [];
  let citationCount = 0;
  for (const group of groups.values()) {
    const [winner, ...losers] = [...group].sort(
      (a, b) => b.extractionConfidence - a.extractionConfidence,
    );
    citationCount += losers.length;
    requirements.push({
      kind: winner.kind,
      obligation: winner.obligation,
      summary: winner.summary,
      constraint: winner.constraint as RequirementConstraint,
      pageNumber: winner.pageNumber,
      quotedClause: winner.quotedClause,
      clauseReference: winner.clauseReference ?? null,
      questionRef: winner.questionRef ?? null,
      wordLimit: winner.wordLimit ?? null,
      weighting: winner.weighting ?? null,
      extractionConfidence: winner.extractionConfidence,
      additionalCitations: losers.map((l) => ({
        pageNumber: l.pageNumber,
        quotedClause: l.quotedClause,
        clauseReference: l.clauseReference ?? null,
      })),
    });
  }

  // `date` constraints mirror into key_dates (§8 step 7, contracts DateConstraint).
  const keyDates = valid
    .filter((d) => d.constraint.kind === "date")
    .map((d) => {
      const constraint = d.constraint as Extract<RequirementConstraint, { kind: "date" }>;
      return {
        kind: constraint.date_kind,
        occursAt: new Date(constraint.occurs_at),
        pageNumber: d.pageNumber,
        quotedClause: d.quotedClause,
      };
    });

  return {
    requirements,
    keyDates,
    accepted: valid.length,
    heldForReview,
    rejected,
    citationCount,
  };
}

export async function deleteDocument(orgId: string, userId: string, documentId: string): Promise<void> {
  const doc = await prisma.tenderDocument.findFirst({ where: { id: documentId, orgId } });
  if (!doc) return;
  await prisma.$transaction(async (tx) => {
    const removed = await tx.requirement.count({ where: { documentId, orgId } });
    // The schema cascades requirements, their citations, results, tasks and
    // responses from the document row (§7.5).
    await tx.tenderDocument.delete({ where: { id: documentId } });
    await appendEvent(tx, {
      orgId,
      actorId: userId,
      actorKind: "user",
      action: "document.uploaded",
      subjectTable: "tender_documents",
      subjectId: documentId,
      payload: {
        tenderId: doc.tenderId,
        filename: doc.filename,
        change: "removed",
        requirementsRemoved: removed,
      },
    });
    await settleTenderStatus(tx, orgId, doc.tenderId);
  });
}

