import type { PageText } from "./pdf-text";

export interface Chunk {
  index: number;
  /** True page numbers from the source document. */
  firstPage: number;
  lastPage: number;
  pages: PageText[];
}

/**
 * 5-page windows with 1 page of overlap (§8 step 4). The overlap exists so a
 * clause spanning a page break is never cut in half; every chunk carries its
 * true page offsets so citations stay page-accurate.
 */
export function chunkPages(pages: PageText[], size = 5, overlap = 1): Chunk[] {
  if (pages.length === 0) return [];
  const step = Math.max(1, size - overlap);
  const chunks: Chunk[] = [];
  for (let start = 0; start < pages.length; start += step) {
    const slice = pages.slice(start, start + size);
    chunks.push({
      index: chunks.length,
      firstPage: slice[0].pageNumber,
      lastPage: slice[slice.length - 1].pageNumber,
      pages: slice,
    });
    if (start + size >= pages.length) break;
  }
  return chunks;
}

/** Runs `worker` over `items` with at most `concurrency` in flight, preserving order of results. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
  return results;
}
