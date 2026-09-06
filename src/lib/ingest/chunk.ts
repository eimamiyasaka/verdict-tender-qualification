/**
 * Chunking — spec §8 step 4.
 *
 * The window plan itself is `planChunks` in `contracts.ts` and is not
 * reimplemented here: 5-page windows with 1 page of overlap, the last window
 * always ending on the last page. The overlap exists so a clause spanning a
 * page break is never cut in half.
 *
 * All this module adds is the text. Every chunk carries its TRUE page offsets,
 * and each page is announced inline with a `[page N]` marker so the model can
 * cite the page a clause actually appears on rather than the first page of the
 * window — which is what `extractionSystemPrompt` tells it to do.
 */

import { planChunks, type DocumentChunk, type PageText } from '../../../contracts';

/** The inline marker the model reads page numbers from. */
export function pageMarker(pageNumber: number): string {
  return '[page ' + pageNumber + ']';
}

export function chunkText(pages: readonly PageText[]): string {
  return pages.map((page) => pageMarker(page.pageNumber) + '\n' + page.text).join('\n\n');
}

/**
 * Slices per-page text into the windows `planChunks` asked for.
 *
 * Pages are addressed by their true `pageNumber`, not by array position, so a
 * document whose pages arrive out of order — or with a gap — still produces
 * windows whose contents match their stated page range.
 */
export function buildChunks(pages: readonly PageText[], pageCount?: number): DocumentChunk[] {
  const total = pageCount ?? pages.reduce((max, page) => Math.max(max, page.pageNumber), 0);
  const byPage = new Map(pages.map((page) => [page.pageNumber, page]));
  return planChunks(total).map((plan) => {
    const window: PageText[] = [];
    for (let pageNumber = plan.startPage; pageNumber <= plan.endPage; pageNumber += 1) {
      const page = byPage.get(pageNumber);
      window.push(page ?? { pageNumber, text: '' });
    }
    return { ...plan, text: chunkText(window) };
  });
}

/**
 * A chunk with no words in it cannot yield a citation, so sending it would buy
 * an API call and a token bill for a guaranteed empty answer. Skipped chunks
 * are counted as succeeded, not failed — nothing went wrong.
 */
export function isChunkWorthSending(chunk: DocumentChunk): boolean {
  return chunk.text.replace(/\[page \d+\]/g, '').trim().length > 0;
}
