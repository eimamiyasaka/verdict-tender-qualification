/**
 * pdf.js in the browser — spec §6.5, §8 steps 2–3.
 *
 * Page numbers come out correct and free, there is no server-side PDF
 * dependency to install, and the file never leaves the client except as text.
 * A pack uploaded at runtime is read into memory here and then discarded:
 * `TenderDocument.filePath` stays null (spec §6.4).
 *
 * Client-only. `pdfjs-dist` is imported dynamically so neither the library nor
 * its worker is ever pulled into a server bundle.
 */

import type { PageText } from '../../../contracts';

/** What one PDF yields. `totalCharacters` feeds `hasTextLayer` (spec §8 step 3). */
export interface PdfDocumentText {
  pageCount: number;
  pages: PageText[];
  totalCharacters: number;
}

/**
 * Not in `contracts.ts` because it is not a shared shape — no other session
 * renders it. Spec §11: errors say what happened and what to do.
 */
export const UNREADABLE_PDF_MESSAGE =
  'This file could not be opened as a PDF. Check it is not password-protected or corrupted, and that it is the buyer’s original download.';

export type PdfProgress = (pagesRead: number, pageCount: number) => void;

let workerConfigured = false;

/**
 * The worker URL is resolved by the bundler, which rewrites this
 * `new URL(..., import.meta.url)` into the emitted asset path. An already-set
 * `workerSrc` is left alone so a host that knows better — a test runner, a
 * different bundler — can point pdf.js somewhere else.
 */
async function loadPdfJs() {
  const pdfjs = await import('pdfjs-dist');
  if (!workerConfigured && !pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url,
    ).toString();
  }
  workerConfigured = true;
  return pdfjs;
}

/**
 * Joins one page's text items back into readable prose.
 *
 * pdf.js hands back positioned runs, not lines. `hasEOL` is the only line
 * signal it gives, so it is the only one used: inventing line breaks from
 * coordinates would change the text the model quotes, and `quotedClause` has
 * to be verbatim (Invariant 1).
 */
function joinPageItems(items: readonly unknown[]): string {
  let out = '';
  for (const item of items) {
    if (!item || typeof item !== 'object' || !('str' in item)) continue;
    const run = item as { str: string; hasEOL?: boolean };
    out += run.str + (run.hasEOL ? '\n' : ' ');
  }
  return out
    .replace(/[ \t]+/g, ' ')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Reads every page of `file` in the browser, in order, reporting progress.
 *
 * `pageNumber` is pdf.js's own 1-based index — the true page of the source
 * PDF, never a chunk-relative one. Everything downstream cites it.
 *
 * Throws with `UNREADABLE_PDF_MESSAGE` when the file cannot be opened at all;
 * a PDF that opens but has no text layer is not an error here — that is
 * `hasTextLayer`'s call, made before any model call (spec §8 step 3).
 */
export async function extractPdfText(file: Blob, onProgress?: PdfProgress): Promise<PdfDocumentText> {
  const pdfjs = await loadPdfJs();
  const data = new Uint8Array(await file.arrayBuffer());

  let loadingTask;
  let doc;
  try {
    loadingTask = pdfjs.getDocument({ data });
    doc = await loadingTask.promise;
  } catch (cause) {
    throw new Error(UNREADABLE_PDF_MESSAGE, { cause });
  }

  try {
    const pages: PageText[] = [];
    let totalCharacters = 0;
    onProgress?.(0, doc.numPages);
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
      const page = await doc.getPage(pageNumber);
      try {
        const content = await page.getTextContent();
        const text = joinPageItems(content.items);
        pages.push({ pageNumber, text });
        totalCharacters += text.length;
      } finally {
        page.cleanup();
      }
      onProgress?.(pageNumber, doc.numPages);
    }
    return { pageCount: doc.numPages, pages, totalCharacters };
  } finally {
    await loadingTask.destroy();
  }
}
