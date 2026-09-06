/**
 * pdf.js in the browser (§6.5, §8 step 3). Page numbers come out correct and
 * free, and the file never leaves the client except as text.
 *
 * Client-only: imported dynamically from the upload panel so the worker and
 * the library are never part of a server bundle.
 */

export interface PageText {
  pageNumber: number;
  text: string;
}

export interface PdfText {
  pageCount: number;
  pages: PageText[];
  totalChars: number;
}

/** Below this many characters per page the PDF is treated as having no text layer. */
export const MIN_CHARS_PER_PAGE = 200;

export const NO_TEXT_LAYER_MESSAGE =
  "This PDF has no text layer. Verdict reads text-based PDFs only — try the buyer's original download rather than a scan.";

export const UNREADABLE_MESSAGE =
  "This file couldn't be opened as a PDF. Check it isn't password-protected or corrupted, and that it is the buyer's original download.";

export function hasTextLayer(pdf: PdfText): boolean {
  if (pdf.pageCount === 0) return false;
  return pdf.totalChars >= MIN_CHARS_PER_PAGE * pdf.pageCount;
}

let workerConfigured = false;

async function loadPdfJs() {
  const pdfjs = await import("pdfjs-dist");
  if (!workerConfigured) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
    workerConfigured = true;
  }
  return pdfjs;
}

export async function extractPdfText(file: File, onPage?: (done: number, total: number) => void): Promise<PdfText> {
  const pdfjs = await loadPdfJs();
  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data });
  const doc = await loadingTask.promise;
  try {
    const pages: PageText[] = [];
    let totalChars = 0;
    for (let i = 1; i <= doc.numPages; i += 1) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ("str" in item ? item.str + (item.hasEOL ? "\n" : " ") : ""))
        .join("")
        .replace(/[ \t]+/g, " ")
        .replace(/\s*\n\s*/g, "\n")
        .trim();
      pages.push({ pageNumber: i, text });
      totalChars += text.length;
      page.cleanup();
      onPage?.(i, doc.numPages);
    }
    return { pageCount: doc.numPages, pages, totalChars };
  } finally {
    await loadingTask.destroy();
  }
}
