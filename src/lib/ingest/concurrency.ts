/**
 * Bounded-concurrency map — spec §8 step 5 runs chunks at
 * `EXTRACTION_CONCURRENCY`.
 *
 * Results are returned in input order regardless of completion order, so a
 * chunk result can never be filed against the wrong chunk. The worker is
 * expected to settle: a rejection here rejects the whole run, which is why
 * `runExtraction` catches per chunk and returns a failure value instead.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const lanes = Math.max(1, Math.min(concurrency, items.length));

  async function runLane(): Promise<void> {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: lanes }, runLane));
  return results;
}
