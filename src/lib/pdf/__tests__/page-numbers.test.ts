/**
 * The citation chain, end to end, against real PDFs — spec §6.5, §8 steps 2–4.
 *
 * A wrong page number is worse than a missing requirement, because it silently
 * destroys the trust the whole matrix is built on. Everything between the file
 * and the model is asserted here: pdf.js hands back pages 1..n in order, and
 * every chunk's `[page N]` section holds exactly page N's text.
 *
 * It runs over whatever PDFs are committed under `public/packs/` — the three
 * seeded packs (spec §13) — or over the file named by `VERDICT_PDF_FIXTURE`.
 * On a branch where neither exists there is nothing real to assert against, so
 * the suite says so rather than passing vacuously.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// pdf.js 6 targets browsers that ship the Uint8Array base64/hex helpers, which
// Node 24 does not have. The application only ever runs this in the browser;
// the gap is the test runner's, so the test runner fills it.
const uint8: any = Uint8Array.prototype;
if (typeof uint8.toHex !== 'function') {
  uint8.toHex = function toHex(this: Uint8Array) {
    return Buffer.from(this).toString('hex');
  };
  uint8.toBase64 = function toBase64(this: Uint8Array) {
    return Buffer.from(this).toString('base64');
  };
  (Uint8Array as any).fromHex = (value: string) => new Uint8Array(Buffer.from(value, 'hex'));
  (Uint8Array as any).fromBase64 = (value: string) => new Uint8Array(Buffer.from(value, 'base64'));
}

const pdfjs = await import('pdfjs-dist');
const { extractPdfText } = await import('../extract');
const { buildChunks, pageMarker } = await import('../../ingest/chunk');
const { hasTextLayer } = await import('../../../../contracts');

// In the browser the bundler resolves this; in Node it is a plain file path.
pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
  path.join(process.cwd(), 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs'),
).href;

function findPdfs(dir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  return entries.flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return findPdfs(full);
    return /\.pdf$/i.test(entry) ? [full] : [];
  });
}

const fixture = process.env.VERDICT_PDF_FIXTURE;
const pdfs = fixture ? [fixture] : findPdfs(path.join(process.cwd(), 'public', 'packs'));

describe.skipIf(pdfs.length === 0)('page numbers survive the trip from pdf.js to a chunk', () => {
  for (const file of pdfs) {
    it(path.basename(file), async () => {
      const bytes = readFileSync(file);
      const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
      const doc = await extractPdfText(blob);

      // pdf.js's own 1-based index, in order, with no gaps.
      expect(doc.pageCount).toBeGreaterThan(0);
      expect(doc.pages.map((p) => p.pageNumber)).toEqual(
        Array.from({ length: doc.pageCount }, (_, i) => i + 1),
      );
      expect(doc.totalCharacters).toBe(doc.pages.reduce((n, p) => n + p.text.length, 0));
      // A committed pack is a text PDF; if this fails the pack is a scan.
      expect(hasTextLayer(doc.totalCharacters, doc.pageCount)).toBe(true);

      const chunks = buildChunks(doc.pages, doc.pageCount);
      expect(chunks[0].startPage).toBe(1);
      expect(chunks[chunks.length - 1].endPage).toBe(doc.pageCount);

      const byPage = new Map(doc.pages.map((p) => [p.pageNumber, p.text]));
      for (const [i, chunk] of chunks.entries()) {
        // 1 page of overlap: each window restarts on the previous one's last page.
        if (i > 0) expect(chunk.startPage).toBe(chunks[i - 1].endPage);

        const sections = chunk.text.split(/\[page (\d+)\]\n?/).slice(1);
        const numbered: number[] = [];
        for (let s = 0; s < sections.length; s += 2) {
          const pageNumber = Number(sections[s]);
          numbered.push(pageNumber);
          // The clause the model is asked to cite as page N really is page N.
          expect(sections[s + 1].trim()).toBe((byPage.get(pageNumber) ?? '').trim());
        }
        expect(numbered).toEqual(
          Array.from({ length: chunk.endPage - chunk.startPage + 1 }, (_, k) => chunk.startPage + k),
        );
        expect(chunk.text).not.toContain(pageMarker(chunk.startPage - 1));
        expect(chunk.text).not.toContain(pageMarker(chunk.endPage + 1));
      }
    }, 300_000);
  }
});

describe.skipIf(pdfs.length > 0)('page numbers', () => {
  it.skip('needs a real PDF — commit one under public/packs/ or set VERDICT_PDF_FIXTURE', () => {});
});
