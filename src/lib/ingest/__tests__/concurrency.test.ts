/**
 * Spec §8 step 5 — chunks run at `EXTRACTION_CONCURRENCY`, and results come
 * back in chunk order however they finish.
 */

import { describe, expect, it } from 'vitest';
import { EXTRACTION_CONCURRENCY } from '../../../../contracts';
import { mapWithConcurrency } from '../concurrency';

describe('mapWithConcurrency', () => {
  it('never runs more than the limit at once', async () => {
    let inFlight = 0;
    let peak = 0;
    const items = Array.from({ length: 11 }, (_, i) => i);
    await mapWithConcurrency(items, EXTRACTION_CONCURRENCY, async (item) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, (item % 3) + 1));
      inFlight -= 1;
      return item;
    });
    expect(peak).toBe(EXTRACTION_CONCURRENCY);
  });

  it('returns results in input order however they finish', async () => {
    const items = [40, 5, 30, 1, 20, 2];
    const results = await mapWithConcurrency(items, 4, async (item) => {
      await new Promise((resolve) => setTimeout(resolve, item));
      return 'chunk-' + item;
    });
    expect(results).toEqual(items.map((i) => 'chunk-' + i));
  });

  it('handles an empty list', async () => {
    expect(await mapWithConcurrency([], 4, async () => 1)).toEqual([]);
  });
});
