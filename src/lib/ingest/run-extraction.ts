/**
 * Browser-side orchestration of the extraction pipeline (§8 steps 2–8).
 *
 * For each file: register the document → read it with pdf.js → reject a
 * scanned PDF before any model call → chunk → POST chunks at concurrency 4
 * with per-chunk progress → record the outcome. One chunk failing never fails
 * the document; the failed count is recorded on the event.
 *
 * Client-only. Server work goes through Server Actions and the one API route.
 */
import { markExtractionRunningAction, recordExtractionAction, registerDocumentAction } from "@/lib/actions/documents";
import type { DocumentType, RequirementDraft } from "@/lib/types";
import { chunkPages, mapWithConcurrency } from "./chunk";
import { extractPdfText, hasTextLayer, NO_TEXT_LAYER_MESSAGE, UNREADABLE_MESSAGE } from "./pdf-text";

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const MAX_FILES = 6;
export const CHUNK_CONCURRENCY = 4;

export interface UploadItem {
  id: string;
  file: File;
  docType: DocumentType;
}

export type ItemProgress =
  | { stage: "queued" }
  | { stage: "registering" }
  | { stage: "reading"; done: number; total: number }
  | { stage: "extracting"; done: number; total: number; failed: number }
  | { stage: "recording" }
  | { stage: "complete"; requirementsFound: number; citationsAdded: number; heldForReview: number; failedChunks: number; chunkCount: number }
  | { stage: "failed"; message: string };

export interface ExtractionEvents {
  onProgress: (itemId: string, progress: ItemProgress) => void;
}

interface ChunkResponse {
  model?: string;
  drafts?: RequirementDraft[];
  error?: string;
}

async function postChunk(body: unknown): Promise<ChunkResponse> {
  const response = await fetch("/api/extract-requirements", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    let message = `Extraction request failed (${response.status}).`;
    try {
      const json = (await response.json()) as { error?: string };
      if (json.error) message = json.error;
    } catch {
      // keep the status message
    }
    throw new Error(message);
  }
  return (await response.json()) as ChunkResponse;
}

export async function runExtraction(tenderId: string, items: UploadItem[], events: ExtractionEvents): Promise<void> {
  for (const item of items) {
    events.onProgress(item.id, { stage: "registering" });
    const registered = await registerDocumentAction({
      tenderId,
      filename: item.file.name,
      docType: item.docType,
      pageCount: null,
    });
    if (!registered.ok) {
      events.onProgress(item.id, { stage: "failed", message: registered.error });
      continue;
    }
    const documentId = registered.documentId;

    // Read the PDF in the browser.
    events.onProgress(item.id, { stage: "reading", done: 0, total: 0 });
    let pdf;
    try {
      pdf = await extractPdfText(item.file, (done, total) => events.onProgress(item.id, { stage: "reading", done, total }));
    } catch {
      await recordExtractionAction({ tenderId, documentId, outcome: { status: "failed", error: UNREADABLE_MESSAGE, pageCount: null } });
      events.onProgress(item.id, { stage: "failed", message: UNREADABLE_MESSAGE });
      continue;
    }

    // Scanned PDF: detected before any model call, stored verbatim on the document.
    if (!hasTextLayer(pdf)) {
      await recordExtractionAction({
        tenderId,
        documentId,
        outcome: { status: "failed", error: NO_TEXT_LAYER_MESSAGE, pageCount: pdf.pageCount },
      });
      events.onProgress(item.id, { stage: "failed", message: NO_TEXT_LAYER_MESSAGE });
      continue;
    }

    await markExtractionRunningAction(documentId);
    const chunks = chunkPages(pdf.pages, 5, 1);
    let done = 0;
    let failed = 0;
    let model = "unknown";
    events.onProgress(item.id, { stage: "extracting", done, total: chunks.length, failed });

    const perChunk = await mapWithConcurrency(chunks, CHUNK_CONCURRENCY, async (chunk) => {
      try {
        const result = await postChunk({
          documentName: item.file.name,
          docType: item.docType,
          firstPage: chunk.firstPage,
          lastPage: chunk.lastPage,
          pages: chunk.pages,
        });
        if (result.model) model = result.model;
        return result.drafts ?? [];
      } catch {
        failed += 1;
        return null;
      } finally {
        done += 1;
        events.onProgress(item.id, { stage: "extracting", done, total: chunks.length, failed });
      }
    });

    const drafts = perChunk.flatMap((d) => d ?? []);
    events.onProgress(item.id, { stage: "recording" });
    const recorded = await recordExtractionAction({
      tenderId,
      documentId,
      outcome: {
        status: "complete",
        pageCount: pdf.pageCount,
        model,
        chunkCount: chunks.length,
        failedChunks: failed,
        drafts,
      },
    });
    if (!recorded.ok) {
      events.onProgress(item.id, { stage: "failed", message: recorded.error });
      continue;
    }
    events.onProgress(item.id, {
      stage: "complete",
      requirementsFound: recorded.requirementsFound,
      citationsAdded: recorded.citationsAdded,
      heldForReview: recorded.heldForReview,
      failedChunks: failed,
      chunkCount: chunks.length,
    });
  }
}

/** Guess the document role from its filename so most uploads need no re-tagging. */
export function guessDocType(filename: string): DocumentType {
  const f = filename.toLowerCase();
  if (/\bpsq\b|questionnaire|selection/.test(f)) return "psq";
  if (/\bitt\b|invitation/.test(f)) return "itt";
  if (/pricing|price|schedule of rates|\bboq\b/.test(f)) return "pricing_schedule";
  if (/evaluation|methodology|award criteria|scoring/.test(f)) return "evaluation_methodology";
  if (/terms|conditions|\bt&c|contract\b(?!.*notice)/.test(f)) return "terms_and_conditions";
  if (/notice/.test(f)) return "contract_notice";
  if (/clarification|q&a|questions and answers/.test(f)) return "clarification_log";
  if (/spec/.test(f)) return "specification";
  return "other";
}
