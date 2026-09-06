/**
 * The client-side orchestrator — spec §8, in the order the spec puts it, because
 * the order is the design.
 *
 *   1. Reject before parsing. Over `MAX_UPLOAD_BYTES`, or more documents than
 *      `MAX_DOCUMENTS_PER_TENDER`, and nothing is read at all.
 *   2. Extract per-page text with pdf.js, in the browser (spec §6.5). The file
 *      is never uploaded; `filePath` stays null (spec §6.4).
 *   3. `hasTextLayer` BEFORE any model call. A scan is marked failed with
 *      `NO_TEXT_LAYER_MESSAGE` stored verbatim. No API call, no cost, no silence.
 *   4. `planChunks` — 5-page windows, 1 page of overlap, true page offsets.
 *   5. POST at `EXTRACTION_CONCURRENCY` with per-chunk progress.
 *   6. Record the outcome, chunk failures included.
 *
 * ONE CHUNK FAILING DOES NOT FAIL THE DOCUMENT. Every chunk's result is kept
 * independently and the failures are counted, because a pipeline that unions an
 * empty result into a total and reports success looks exactly like success.
 */

import {
  EXTRACTION_CONCURRENCY,
  NO_TEXT_LAYER_MESSAGE,
  hasTextLayer,
  type DocumentChunk,
  type DocumentExtractionOutcome,
  type DocumentType,
  type ExtractRequirementsResponse,
  type RequirementDraft,
} from '../../../contracts';
import { markExtractionRunningAction, registerDocumentAction } from '@/lib/actions/documents';
import { UNREADABLE_PDF_MESSAGE, extractPdfText } from '@/lib/pdf/extract';
import { buildChunks, isChunkWorthSending } from './chunk';
import { mapWithConcurrency } from './concurrency';
import { postChunk } from './post-chunk';
import { saveExtractionAction, saveExtractionFailureAction } from './actions';

export { guessDocType, screenSelection } from './screen';
export type { ScreenableFile, ScreenedFile, ScreenedSelection } from './screen';

/* -------------------------------------------------------------------------
 * Progress
 * ---------------------------------------------------------------------- */

export interface UploadItem {
  /** Stable per selected file, so progress lands on the right row. */
  id: string;
  file: File;
  docType: DocumentType;
}

export type ItemProgress =
  | { stage: 'queued' }
  | { stage: 'registering' }
  | { stage: 'reading'; pagesRead: number; pageCount: number }
  | { stage: 'extracting'; chunksDone: number; chunksTotal: number; chunksFailed: number }
  | { stage: 'saving' }
  | {
      stage: 'complete';
      outcome: DocumentExtractionOutcome;
      keyDatesCreated: number;
      /** `NO_REQUIREMENTS_MESSAGE` when the document parsed and yielded nothing. */
      message: string | null;
    }
  | { stage: 'failed'; message: string };

export interface ExtractionEvents {
  onProgress: (itemId: string, progress: ItemProgress) => void;
}

export interface DocumentRunResult {
  itemId: string;
  filename: string;
  progress: ItemProgress;
}

/* -------------------------------------------------------------------------
 * One document, end to end.
 * ---------------------------------------------------------------------- */

async function runDocument(
  tenderId: string,
  item: UploadItem,
  events: ExtractionEvents,
): Promise<ItemProgress> {
  const report = (progress: ItemProgress) => {
    events.onProgress(item.id, progress);
    return progress;
  };

  report({ stage: 'registering' });
  const registered = await registerDocumentAction({
    tenderId,
    filename: item.file.name,
    docType: item.docType,
    pageCount: null,
  });
  if (!registered.ok) return report({ stage: 'failed', message: registered.error });
  const documentId = registered.documentId;

  const failDocument = async (message: string, pageCount: number | null) => {
    const saved = await saveExtractionFailureAction({
      tenderId,
      documentId,
      filename: item.file.name,
      pageCount,
      message,
    });
    return report({ stage: 'failed', message: saved.ok ? message : saved.error });
  };

  // Step 2 — read the PDF in the browser.
  report({ stage: 'reading', pagesRead: 0, pageCount: 0 });
  let pdf;
  try {
    pdf = await extractPdfText(item.file, (pagesRead, pageCount) =>
      report({ stage: 'reading', pagesRead, pageCount }),
    );
  } catch {
    return failDocument(UNREADABLE_PDF_MESSAGE, null);
  }

  // Step 3 — the text-layer check, before any model call. A scan stops here.
  if (!hasTextLayer(pdf.totalCharacters, pdf.pageCount)) {
    return failDocument(NO_TEXT_LAYER_MESSAGE, pdf.pageCount);
  }

  // Step 4 — 5-page windows with 1 page of overlap, true page offsets.
  const chunks = buildChunks(pdf.pages, pdf.pageCount);
  await markExtractionRunningAction(documentId);

  let chunksDone = 0;
  let chunksFailed = 0;
  const chunksTotal = chunks.length;
  report({ stage: 'extracting', chunksDone, chunksTotal, chunksFailed });

  // Step 5 — POST at EXTRACTION_CONCURRENCY, showing per-chunk progress.
  const results = await mapWithConcurrency(
    chunks,
    EXTRACTION_CONCURRENCY,
    async (chunk: DocumentChunk) => {
      let outcome: ExtractRequirementsResponse | null = null;
      if (isChunkWorthSending(chunk)) {
        outcome = await postChunk({
          documentId,
          filename: item.file.name,
          docType: item.docType,
          chunk,
        });
        if (!outcome.ok) chunksFailed += 1;
      }
      chunksDone += 1;
      report({ stage: 'extracting', chunksDone, chunksTotal, chunksFailed });
      return outcome;
    },
  );

  const drafts: RequirementDraft[] = [];
  let draftsRejectedUpstream = 0;
  let model = '';
  for (const result of results) {
    // A blank chunk was never sent: nothing failed, and nothing came back.
    if (!result) continue;
    if (!result.ok) continue;
    drafts.push(...result.drafts);
    draftsRejectedUpstream += result.rejectedCount;
    if (result.model) model = result.model;
  }

  // Step 6 — record it, chunk failures and all. This call is made even when
  // every chunk failed: a document that produced nothing must say so.
  report({ stage: 'saving' });
  const saved = await saveExtractionAction({
    tenderId,
    documentId,
    filename: item.file.name,
    model: model || 'unknown',
    pageCount: pdf.pageCount,
    chunksTotal,
    chunksSucceeded: chunksTotal - chunksFailed,
    chunksFailed,
    draftsRejectedUpstream,
    drafts,
  });
  if (!saved.ok) return report({ stage: 'failed', message: saved.error });
  // Every chunk failing is not a completed document — see `prepare.ts`.
  if (saved.status === 'failed') {
    return report({ stage: 'failed', message: saved.extractionError ?? 'Extraction failed.' });
  }

  return report({
    stage: 'complete',
    outcome: saved.outcome,
    keyDatesCreated: saved.keyDatesCreated,
    message: saved.message,
  });
}

/**
 * Runs the pipeline over a selection, one document at a time. Documents are
 * sequential so a six-file pack cannot open twenty-four concurrent model calls
 * or hold six PDFs in browser memory at once; chunks inside a document run at
 * `EXTRACTION_CONCURRENCY`.
 */
export async function runExtraction(
  tenderId: string,
  items: readonly UploadItem[],
  events: ExtractionEvents,
): Promise<DocumentRunResult[]> {
  const results: DocumentRunResult[] = [];
  for (const item of items) {
    const progress = await runDocument(tenderId, item, events);
    results.push({ itemId: item.id, filename: item.file.name, progress });
  }
  return results;
}
