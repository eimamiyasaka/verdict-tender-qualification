/**
 * One chunk, one call to `/api/extract-requirements` — spec §8 step 5.
 *
 * Two rules live here and both are about attribution:
 *
 *   - The route echoes `documentId` and `chunkIndex`. If either does not match
 *     what was sent, the answer is DISCARDED rather than filed, because a
 *     result attributed to the wrong document is worse than a missing one.
 *   - Nothing throws. Every way a chunk can fail comes back as a typed
 *     `ExtractRequirementsFailure`, so the caller counts it instead of losing
 *     the whole document to one bad window.
 */

import type {
  ExtractRequirementsRequest,
  ExtractRequirementsResponse,
} from '../../../contracts';

function pageRange(request: ExtractRequirementsRequest): string {
  return request.chunk.startPage + '–' + request.chunk.endPage;
}

export async function postChunk(
  request: ExtractRequirementsRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<ExtractRequirementsResponse> {
  const identity = { documentId: request.documentId, chunkIndex: request.chunk.index };
  const pages = pageRange(request);

  let response: Response;
  try {
    response = await fetchImpl('/api/extract-requirements', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request),
    });
  } catch {
    return {
      ok: false,
      ...identity,
      error: {
        code: 'model_error',
        message:
          'Pages ' +
          pages +
          ' could not be sent for extraction. Check your connection and re-upload the file.',
      },
    };
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const stated = (payload as { error?: unknown } | null)?.error;
    // The route's own typed failure, which already carries the right identity.
    if (stated && typeof stated === 'object' && 'code' in stated) {
      return { ...(payload as ExtractRequirementsResponse), ...identity };
    }
    return {
      ok: false,
      ...identity,
      error: {
        code: response.status === 429 ? 'rate_limited' : 'model_error',
        message:
          typeof stated === 'string'
            ? stated
            : 'Extraction failed for pages ' + pages + ' (' + response.status + ').',
      },
    };
  }

  const result = payload as ExtractRequirementsResponse | null;
  if (
    !result ||
    typeof result.ok !== 'boolean' ||
    result.documentId !== identity.documentId ||
    result.chunkIndex !== identity.chunkIndex
  ) {
    return {
      ok: false,
      ...identity,
      error: {
        code: 'invalid_output',
        message:
          'The extraction service answered for a different chunk, so pages ' +
          pages +
          ' were not used.',
      },
    };
  }
  return result;
}
