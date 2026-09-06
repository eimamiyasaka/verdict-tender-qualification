/**
 * Chunking and the text-layer gate, asserted against `fixtures/extraction.ts`.
 *
 * These are the two steps that decide whether a citation can be trusted and
 * whether a model call happens at all, so they are pinned by fixture rather
 * than by anything this session invented.
 */

import { describe, expect, it } from 'vitest';
import {
  CHUNK_PAGE_OVERLAP,
  CHUNK_PAGE_SPAN,
  hasTextLayer,
  planChunks,
  type PageText,
} from '../../../../contracts';
import {
  chunkPlanCases,
  sampleChunkRequest,
  samplePages,
  scannedDocumentCase,
  textLayerCases,
} from '../../../../fixtures/extraction';
import { buildChunks, chunkText, isChunkWorthSending, pageMarker } from '../chunk';

describe('planChunks — 5-page windows with 1 page of overlap', () => {
  it('matches every pinned chunk plan', () => {
    for (const testCase of chunkPlanCases) {
      expect(planChunks(testCase.pageCount), String(testCase.pageCount) + ' pages').toEqual(
        testCase.expected,
      );
    }
  });

  it('keeps the window and the overlap the spec froze', () => {
    expect(CHUNK_PAGE_SPAN).toBe(5);
    expect(CHUNK_PAGE_OVERLAP).toBe(1);
    // The overlap is why a clause spanning a page break is never cut in half:
    // page 5 is the last page of chunk 0 and the first page of chunk 1.
    const plans = planChunks(12);
    for (let i = 1; i < plans.length; i += 1) {
      expect(plans[i].startPage).toBe(plans[i - 1].endPage);
    }
    expect(plans[plans.length - 1].endPage).toBe(12);
  });
});

describe('buildChunks — true page offsets travel with the text', () => {
  const pages: PageText[] = Array.from({ length: 12 }, (_, i) => ({
    pageNumber: i + 1,
    text: 'Clause ' + (i + 1) + '.1 The supplier shall do the thing on page ' + (i + 1) + '.',
  }));

  it('carries each window its own pages, marked with their real page numbers', () => {
    const chunks = buildChunks(pages);
    expect(chunks.map((c) => [c.index, c.startPage, c.endPage])).toEqual([
      [0, 1, 5],
      [1, 5, 9],
      [2, 9, 12],
    ]);
    for (const chunk of chunks) {
      for (let page = chunk.startPage; page <= chunk.endPage; page += 1) {
        expect(chunk.text).toContain(pageMarker(page));
        expect(chunk.text).toContain('page ' + page + '.');
      }
      expect(chunk.text).not.toContain(pageMarker(chunk.startPage - 1));
      expect(chunk.text).not.toContain(pageMarker(chunk.endPage + 1));
    }
  });

  it('reproduces the pinned chunk text for the NHS PSQ sample', () => {
    expect(chunkText(samplePages)).toBe(sampleChunkRequest.chunk.text);
  });

  it('addresses pages by page number, not array position', () => {
    // A document whose first page yielded no text still puts page 3's clause
    // on page 3 — the citation cannot drift by an index.
    const sparse: PageText[] = [
      { pageNumber: 2, text: 'Second page.' },
      { pageNumber: 3, text: 'Third page.' },
    ];
    const [chunk] = buildChunks(sparse, 3);
    expect(chunk).toEqual({
      index: 0,
      startPage: 1,
      endPage: 3,
      text: '[page 1]\n\n\n[page 2]\nSecond page.\n\n[page 3]\nThird page.',
    });
  });

  it('does not send a window with no words in it', () => {
    const [blank] = buildChunks([{ pageNumber: 1, text: '' }], 1);
    expect(isChunkWorthSending(blank)).toBe(false);
    const [real] = buildChunks([{ pageNumber: 1, text: 'A clause.' }], 1);
    expect(isChunkWorthSending(real)).toBe(true);
  });
});

describe('hasTextLayer — the gate before any model call', () => {
  it('matches every pinned threshold case', () => {
    for (const testCase of textLayerCases) {
      expect(hasTextLayer(testCase.totalCharacters, testCase.pageCount), testCase.name).toBe(
        testCase.expected,
      );
    }
  });

  it('rejects Camden’s scanned Appendix C', () => {
    expect(hasTextLayer(scannedDocumentCase.totalCharacters, scannedDocumentCase.pageCount)).toBe(
      false,
    );
  });
});
