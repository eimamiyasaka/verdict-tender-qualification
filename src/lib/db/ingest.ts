/**
 * Persistence for the extraction pipeline (§8 step 7) — the write half of
 * `feat/extraction-live`'s work, owned here because it is a database write.
 *
 * The division of labour is deliberate. The caller (`src/lib/ingest/`) owns
 * chunking, the model call, Zod validation against `RequirementDraftSchema` and
 * deduplication on `constraintDedupeKey`. This function owns the transaction,
 * the row writes and the single `extraction.completed` event — all of which
 * commit together, so a half-written matrix cannot survive a failure and the
 * audit log cannot claim requirements that were rolled back.
 *
 * Invariant 1 (§7.5) is the database's job: `documentId`, `pageNumber` and
 * `quotedClause` are NOT NULL and the CHECK constraints in the init migration
 * reject a bad page number or an over-long clause. Nothing here softens that.
 */

import type {
  DocumentExtractionOutcome,
  ExtractionCompletedPayload,
  KeyDateKind,
  Obligation,
  RequirementConstraint,
  RequirementKind,
} from "../../../contracts";
import { prisma, toDecimal, type Tx } from "./client";
import { appendEvent } from "./events";

/** A citation kept from a losing duplicate (§7.5, `requirement_citations`). */
export interface PersistCitationInput {
  /** Defaults to the requirement's own document when the duplicate came from it. */
  documentId?: string | null;
  pageNumber: number;
  quotedClause: string;
  clauseReference?: string | null;
}

/** One surviving requirement, already validated and already deduplicated. */
export interface PersistRequirementInput {
  kind: RequirementKind;
  obligation: Obligation;
  summary: string;
  constraint: RequirementConstraint;
  pageNumber: number;
  quotedClause: string;
  clauseReference?: string | null;
  /** `kind = question` only. */
  questionRef?: string | null;
  wordLimit?: number | null;
  weighting?: number | null;
  extractionConfidence?: number | null;
  additionalCitations: PersistCitationInput[];
}

/** A `date` constraint mirrored into `key_dates` (§7.5). */
export interface PersistKeyDateInput {
  kind: KeyDateKind;
  occursAt: Date;
  documentId?: string | null;
  pageNumber?: number | null;
  quotedClause?: string | null;
}

export interface PersistExtractionInput {
  tenderId: string;
  documentId: string;
  /** Recorded on the event so an old extraction stays explainable (§10.5). */
  model: string;
  /** Who ran it. Null for a system or scheduled run. */
  actorId: string | null;
  /** Corrects the page count once pdf.js has actually opened the file. */
  pageCount?: number | null;
  requirements: PersistRequirementInput[];
  keyDates: PersistKeyDateInput[];
  /** Counted, never hidden — including the chunks that failed (§8). */
  outcome: DocumentExtractionOutcome;
}

export interface PersistExtractionResult {
  requirementsCreated: number;
  citationsCreated: number;
  keyDatesCreated: number;
}

/**
 * A tender is `extracted` once no document is still pending or running and at
 * least one completed; `extraction_failed` when every document failed. Runs
 * inside the caller's transaction so the status and the rows commit together.
 */
export async function settleTenderStatus(tx: Tx, orgId: string, tenderId: string): Promise<void> {
  const tender = await tx.tender.findFirst({ where: { id: tenderId, orgId }, select: { status: true } });
  if (!tender) return;
  if (
    tender.status !== "extracting" &&
    tender.status !== "draft" &&
    tender.status !== "extraction_failed"
  ) {
    return;
  }
  const docs = await tx.tenderDocument.findMany({
    where: { tenderId, orgId },
    select: { extractionStatus: true },
  });
  if (docs.some((d) => d.extractionStatus === "pending" || d.extractionStatus === "running")) return;
  const anyComplete = docs.some((d) => d.extractionStatus === "complete");
  await tx.tender.update({
    where: { id: tenderId },
    data: { status: anyComplete ? "extracted" : "extraction_failed" },
  });
}

/**
 * Writes one document's extraction result. Returns the three counts the upload
 * panel reports; the full outcome, including the chunks that failed and the
 * drafts held for review, goes on the event.
 */
export async function persistExtraction(
  orgId: string,
  input: PersistExtractionInput,
): Promise<PersistExtractionResult> {
  return prisma.$transaction(
    async (tx) => {
      // `orgId` comes from the session; the document must belong to it and to
      // the tender the caller named. Neither is taken on trust (§6.3).
      const document = await tx.tenderDocument.findFirst({
        where: { id: input.documentId, orgId, tenderId: input.tenderId },
        select: { id: true, filename: true, pageCount: true },
      });
      if (!document) throw new Error("Document not found");

      let citationsCreated = 0;
      for (const requirement of input.requirements) {
        await tx.requirement.create({
          data: {
            tenderId: input.tenderId,
            orgId,
            kind: requirement.kind,
            obligation: requirement.obligation,
            summary: requirement.summary,
            constraintJson: requirement.constraint as never,
            documentId: input.documentId,
            pageNumber: requirement.pageNumber,
            quotedClause: requirement.quotedClause,
            clauseReference: requirement.clauseReference ?? null,
            questionRef: requirement.questionRef ?? null,
            wordLimit: requirement.wordLimit ?? null,
            weighting: toDecimal(requirement.weighting),
            extractionConfidence: toDecimal(requirement.extractionConfidence),
            citations: {
              create: requirement.additionalCitations.map((citation) => ({
                orgId,
                documentId: citation.documentId ?? input.documentId,
                pageNumber: citation.pageNumber,
                quotedClause: citation.quotedClause,
                clauseReference: citation.clauseReference ?? null,
              })),
            },
          },
        });
        citationsCreated += requirement.additionalCitations.length;
      }

      let keyDatesCreated = 0;
      if (input.keyDates.length > 0) {
        const created = await tx.keyDate.createMany({
          data: input.keyDates.map((keyDate) => ({
            tenderId: input.tenderId,
            orgId,
            kind: keyDate.kind,
            occursAt: keyDate.occursAt,
            documentId: keyDate.documentId ?? input.documentId,
            pageNumber: keyDate.pageNumber ?? null,
            quotedClause: keyDate.quotedClause ?? null,
          })),
        });
        keyDatesCreated = created.count;
      }

      await tx.tenderDocument.update({
        where: { id: input.documentId },
        data: {
          extractionStatus: "complete",
          extractionError: null,
          pageCount: input.pageCount ?? document.pageCount,
        },
      });
      await settleTenderStatus(tx, orgId, input.tenderId);

      const payload: ExtractionCompletedPayload = {
        model: input.model,
        filename: document.filename,
        chunksTotal: input.outcome.chunksTotal,
        chunksSucceeded: input.outcome.chunksSucceeded,
        chunksFailed: input.outcome.chunksFailed,
        draftsAccepted: input.outcome.draftsAccepted,
        draftsHeldForReview: input.outcome.draftsHeldForReview,
        draftsRejected: input.outcome.draftsRejected,
        requirementsCreated: input.requirements.length,
        citationsCreated,
      };
      await appendEvent(tx, {
        orgId,
        actorId: input.actorId,
        actorKind: "model",
        action: "extraction.completed",
        subjectTable: "tender_documents",
        subjectId: input.documentId,
        payload: payload as unknown as Record<string, unknown>,
      });

      return {
        requirementsCreated: input.requirements.length,
        citationsCreated,
        keyDatesCreated,
      };
    },
    // A 120-page pack is one transaction of a few hundred inserts; the 5s
    // default is too tight over a pooled Supabase connection.
    { timeout: 60_000, maxWait: 15_000 },
  );
}
