/**
 * The one hand-written endpoint — spec §6.1, §8.
 *
 * The model itself is mocked; what is asserted is everything around it that a
 * bad answer could quietly break: the key never leaving the server, the
 * document and chunk being echoed back, and a malformed row costing its own
 * row rather than the whole chunk.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  EXTRACTION_MODEL,
  extractionSystemPrompt,
  type ExtractRequirementsRequest,
  type ExtractRequirementsResponse,
} from '../../../../../contracts';
import { sampleChunkRequest, sampleDrafts } from '../../../../../fixtures/extraction';

const parseMock = vi.fn();

vi.mock('@/lib/auth/session', () => ({
  getSession: vi.fn(async () => ({ userId: 'user-1', email: 'user-1@example.com' })),
}));

// Only the client is replaced; the SDK's real error classes stay, so the
// route's `instanceof` branches are exercised rather than simulated.
vi.mock('@anthropic-ai/sdk', async (importOriginal) => {
  const actual: any = await importOriginal();
  class MockAnthropic {
    messages = { parse: (...args: unknown[]) => parseMock(...args) };
  }
  return { ...actual, default: MockAnthropic };
});

const { getSession } = await import('@/lib/auth/session');
const { POST } = await import('../route');
const { AnthropicError, APIConnectionTimeoutError, RateLimitError } = await import(
  '@anthropic-ai/sdk'
);

const request: ExtractRequirementsRequest = sampleChunkRequest;

function post(body: unknown = request) {
  return POST(
    new Request('http://localhost/api/extract-requirements', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

function modelMessage(overrides: Record<string, unknown> = {}) {
  return {
    model: EXTRACTION_MODEL,
    stop_reason: 'end_turn',
    parsed_output: { drafts: sampleDrafts },
    ...overrides,
  };
}

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
  parseMock.mockReset();
  vi.mocked(getSession).mockResolvedValue({ userId: 'user-1', email: 'user-1@example.com' });
});

afterEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
});

describe('POST /api/extract-requirements', () => {
  it('sends the frozen prompt, model and structured-output config', async () => {
    parseMock.mockResolvedValue(modelMessage());
    await post();

    expect(parseMock).toHaveBeenCalledTimes(1);
    const params = parseMock.mock.calls[0][0] as any;
    expect(params.model).toBe(EXTRACTION_MODEL);
    expect(params.system).toBe(extractionSystemPrompt(request));
    expect(params.messages).toEqual([{ role: 'user', content: request.chunk.text }]);
    // output_config.format, never the deprecated top-level output_format.
    expect(params.output_config.format.type).toBe('json_schema');
    expect(params).not.toHaveProperty('output_format');
  });

  it('echoes the document and chunk back so a result cannot be misattributed', async () => {
    parseMock.mockResolvedValue(modelMessage());
    const body = (await (await post()).json()) as ExtractRequirementsResponse;
    expect(body).toMatchObject({
      ok: true,
      documentId: request.documentId,
      chunkIndex: request.chunk.index,
      model: EXTRACTION_MODEL,
      rejectedCount: 0,
    });
    if (body.ok) expect(body.drafts).toEqual(sampleDrafts);
  });

  it('never reaches the model without a session', async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    const response = await post();
    expect(response.status).toBe(401);
    expect(parseMock).not.toHaveBeenCalled();
  });

  it('says what is missing when the key is not configured', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const response = await post();
    const body = (await response.json()) as ExtractRequirementsResponse;
    expect(parseMock).not.toHaveBeenCalled();
    expect(body.ok).toBe(false);
    if (!body.ok) expect(body.error.message).toContain('ANTHROPIC_API_KEY');
  });

  it('rejects a chunk that is not in the expected shape without calling the model', async () => {
    const response = await post({ ...request, chunk: { ...request.chunk, startPage: 0 } });
    expect(response.status).toBe(400);
    expect(parseMock).not.toHaveBeenCalled();
  });

  it('keeps the good drafts and counts the bad one when the batch fails to parse', async () => {
    // The Zod parse throws only after the raw text has passed through the
    // output format, which is where the route captures it.
    parseMock.mockImplementation(async (params: any) => {
      const bad = { ...sampleDrafts[0], summary: '' };
      params.output_config.format.parse(JSON.stringify({ drafts: [...sampleDrafts, bad] }));
      throw new Error('unreachable');
    });

    const body = (await (await post()).json()) as ExtractRequirementsResponse;
    expect(body.ok).toBe(true);
    if (body.ok) {
      expect(body.drafts).toEqual(sampleDrafts);
      expect(body.rejectedCount).toBe(1);
    }
  });

  it('fails the chunk loudly when nothing can be salvaged', async () => {
    parseMock.mockRejectedValue(new AnthropicError('Failed to parse structured output'));
    const response = await post();
    const body = (await response.json()) as ExtractRequirementsResponse;
    expect(body.ok).toBe(false);
    if (!body.ok) {
      expect(body.error.code).toBe('invalid_output');
      expect(body.documentId).toBe(request.documentId);
      expect(body.chunkIndex).toBe(request.chunk.index);
    }
  });

  it('reports a rate limit as a rate limit', async () => {
    parseMock.mockRejectedValue(
      new RateLimitError(429, undefined, 'rate limited', new Headers()),
    );
    const body = (await (await post()).json()) as ExtractRequirementsResponse;
    expect(body.ok).toBe(false);
    if (!body.ok) expect(body.error.code).toBe('rate_limited');
  });

  it('names the pages and the timeout when the model does not answer', async () => {
    parseMock.mockRejectedValue(new APIConnectionTimeoutError({ message: 'timed out' }));
    const body = (await (await post()).json()) as ExtractRequirementsResponse;
    expect(body.ok).toBe(false);
    if (!body.ok) {
      expect(body.error.code).toBe('timeout');
      expect(body.error.message).toBe(
        'The model did not respond within 60 seconds for pages 29–33.',
      );
    }
  });

  it('does not report a truncated answer as a complete one', async () => {
    parseMock.mockResolvedValue(
      modelMessage({ stop_reason: 'max_tokens', parsed_output: { drafts: [] } }),
    );
    const body = (await (await post()).json()) as ExtractRequirementsResponse;
    expect(body.ok).toBe(false);
    if (!body.ok) expect(body.error.code).toBe('invalid_output');
  });
});
