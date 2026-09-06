/**
 * The attribution guarantee — spec §8, and the reason the route echoes
 * `documentId` and `chunkIndex`.
 */

import { describe, expect, it } from 'vitest';
import type { ExtractRequirementsRequest } from '../../../../contracts';
import { sampleChunkFailure, sampleChunkRequest, sampleChunkSuccess } from '../../../../fixtures/extraction';
import { postChunk } from '../post-chunk';

function respondWith(body: unknown, status = 200): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    })) as unknown as typeof fetch;
}

const request: ExtractRequirementsRequest = sampleChunkRequest;

describe('postChunk', () => {
  it('returns a matching success unchanged', async () => {
    const result = await postChunk(request, respondWith(sampleChunkSuccess));
    expect(result).toEqual(sampleChunkSuccess);
  });

  it('discards an answer for a different chunk rather than filing it', async () => {
    const misattributed = { ...sampleChunkSuccess, chunkIndex: 4 };
    const result = await postChunk(request, respondWith(misattributed));
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({
      documentId: request.documentId,
      chunkIndex: request.chunk.index,
      error: { code: 'invalid_output' },
    });
    expect(result).not.toHaveProperty('drafts');
  });

  it('discards an answer for a different document', async () => {
    const misattributed = { ...sampleChunkSuccess, documentId: 'camden-psq' };
    const result = await postChunk(request, respondWith(misattributed));
    expect(result.ok).toBe(false);
    expect(result.documentId).toBe(request.documentId);
  });

  it('passes the route’s own typed failure through', async () => {
    const failure = { ...sampleChunkFailure, chunkIndex: request.chunk.index };
    const result = await postChunk(request, respondWith(failure, 502));
    expect(result).toEqual(failure);
  });

  it('turns a 429 into a rate-limited chunk failure', async () => {
    const result = await postChunk(request, respondWith({ error: 'Too many requests' }, 429));
    expect(result).toMatchObject({
      ok: false,
      documentId: request.documentId,
      chunkIndex: request.chunk.index,
      error: { code: 'rate_limited' },
    });
  });

  it('never throws when the network does', async () => {
    const offline = (async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    const result = await postChunk(request, offline);
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ error: { code: 'model_error' } });
    if (!result.ok) expect(result.error.message).toContain('29–33');
  });

  it('never throws when the body is not JSON', async () => {
    const garbage = (async () => new Response('<html>502</html>', { status: 502 })) as unknown as typeof fetch;
    const result = await postChunk(request, garbage);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('502');
  });
});
