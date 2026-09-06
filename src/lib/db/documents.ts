/**
 * Tender documents (§7.5) and the persistence end of the extraction pipeline (§8).
 *
 * The browser does the reading (pdf.js) and the model call goes through
 * /api/extract-requirements; this module records what came back. One chunk
 * failing never fails the document — the failed count is stored on the event
 * and surfaced in the Documents tab.
 */
import type { DocumentType, RequirementDraft, TenderDocument } from "@/lib/types";
import { persistDrafts, type PersistOutcome } from "./_placeholder/persist";
import { appendEvent, clone, getStore, newId } from "./_placeholder/store";

export async function addDocument(
  orgId: string,
  userId: string,
  tenderId: string,
  input: { filename: string; docType: DocumentType; pageCount: number | null },
): Promise<TenderDocument> {
  const store = getStore();
  const tender = store.tenders.find((t) => t.id === tenderId && t.orgId === orgId);
  if (!tender) throw new Error("Tender not found");
  const doc: TenderDocument = {
    id: newId(),
    tenderId,
    orgId,
    filename: input.filename,
    docType: input.docType,
    filePath: null, // runtime uploads are never persisted (§6.4)
    pageCount: input.pageCount,
    extractionStatus: "pending",
    extractionError: null,
    uploadedAt: new Date(),
  };
  store.documents.push(doc);
  if (tender.status === "draft") {
    tender.status = "extracting";
    tender.updatedAt = doc.uploadedAt;
  }
  appendEvent(store, {
    orgId,
    actorId: userId,
    actorKind: "user",
    action: "document.uploaded",
    subjectTable: "tender_documents",
    subjectId: doc.id,
    payload: { tenderId, filename: doc.filename, docType: doc.docType, pageCount: doc.pageCount },
  });
  return clone(doc);
}

export async function markExtractionRunning(orgId: string, documentId: string): Promise<void> {
  const store = getStore();
  const doc = store.documents.find((d) => d.id === documentId && d.orgId === orgId);
  if (!doc) throw new Error("Document not found");
  doc.extractionStatus = "running";
}

export interface ExtractionFailure {
  status: "failed";
  /** The user-facing message, stored verbatim on the document. */
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

function settleTenderStatus(orgId: string, tenderId: string) {
  const store = getStore();
  const tender = store.tenders.find((t) => t.id === tenderId && t.orgId === orgId);
  if (!tender) return;
  if (tender.status !== "extracting" && tender.status !== "draft" && tender.status !== "extraction_failed") return;
  const docs = store.documents.filter((d) => d.tenderId === tenderId);
  if (docs.some((d) => d.extractionStatus === "pending" || d.extractionStatus === "running")) return;
  const anyComplete = docs.some((d) => d.extractionStatus === "complete");
  tender.status = anyComplete ? "extracted" : "extraction_failed";
  tender.updatedAt = new Date();
}

export async function recordExtractionOutcome(
  orgId: string,
  userId: string,
  documentId: string,
  outcome: ExtractionFailure | ExtractionSuccess,
): Promise<{ document: TenderDocument; persisted: PersistOutcome | null }> {
  const store = getStore();
  const doc = store.documents.find((d) => d.id === documentId && d.orgId === orgId);
  if (!doc) throw new Error("Document not found");
  doc.pageCount = outcome.pageCount ?? doc.pageCount;

  if (outcome.status === "failed") {
    doc.extractionStatus = "failed";
    doc.extractionError = outcome.error;
    appendEvent(store, {
      orgId,
      actorId: null,
      actorKind: "system",
      action: "extraction.failed",
      subjectTable: "tender_documents",
      subjectId: doc.id,
      payload: { tenderId: doc.tenderId, filename: doc.filename, error: outcome.error },
    });
    settleTenderStatus(orgId, doc.tenderId);
    return { document: clone(doc), persisted: null };
  }

  const persisted = persistDrafts(store, { orgId, tenderId: doc.tenderId, documentId: doc.id, drafts: outcome.drafts });
  doc.extractionStatus = "complete";
  doc.extractionError = null;
  appendEvent(store, {
    orgId,
    actorId: userId,
    actorKind: "model",
    action: "extraction.completed",
    subjectTable: "tender_documents",
    subjectId: doc.id,
    payload: {
      tenderId: doc.tenderId,
      filename: doc.filename,
      model: outcome.model,
      chunkCount: outcome.chunkCount,
      failedChunks: outcome.failedChunks,
      requirementsFound: persisted.created,
      citationsAdded: persisted.citationsAdded,
      heldForReview: persisted.heldForReview,
      rejected: persisted.rejected,
    },
  });
  settleTenderStatus(orgId, doc.tenderId);
  return { document: clone(doc), persisted };
}

export async function deleteDocument(orgId: string, userId: string, documentId: string): Promise<void> {
  const store = getStore();
  const index = store.documents.findIndex((d) => d.id === documentId && d.orgId === orgId);
  if (index === -1) return;
  const [doc] = store.documents.splice(index, 1);
  // Cascade: requirements cited from this document, their citations, results and tasks.
  const removedIds = new Set(store.requirements.filter((r) => r.documentId === doc.id).map((r) => r.id));
  store.requirements = store.requirements.filter((r) => !removedIds.has(r.id));
  store.citations = store.citations.filter((c) => c.documentId !== doc.id && !removedIds.has(c.requirementId));
  store.results = store.results.filter((r) => !removedIds.has(r.requirementId));
  store.tasks = store.tasks.filter((t) => !t.requirementId || !removedIds.has(t.requirementId));
  store.responses = store.responses.filter((r) => !removedIds.has(r.requirementId));
  appendEvent(store, {
    orgId,
    actorId: userId,
    actorKind: "user",
    action: "document.uploaded",
    subjectTable: "tender_documents",
    subjectId: doc.id,
    payload: { tenderId: doc.tenderId, filename: doc.filename, change: "removed", requirementsRemoved: removedIds.size },
  });
  settleTenderStatus(orgId, doc.tenderId);
}
