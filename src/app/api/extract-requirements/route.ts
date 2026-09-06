/**
 * POST /api/extract-requirements — spec §6.1, §8 step 5.
 *
 * The only hand-written HTTP endpoint in the app. It exists for exactly one
 * reason: `ANTHROPIC_API_KEY` must not reach the client. Everything else the
 * browser needs goes through Server Components and Server Actions.
 *
 * One call per 5-page chunk. `documentId` and `chunkIndex` are echoed back so
 * a result can never be attributed to the wrong document, and the caller
 * checks them.
 */

import { NextResponse } from 'next/server';
import Anthropic, {
  APIConnectionTimeoutError,
  APIError,
  AnthropicError,
  AuthenticationError,
  RateLimitError,
} from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import {
  DOCUMENT_TYPES,
  EXTRACTION_MODEL,
  ExtractionBatchSchema,
  RequirementDraftSchema,
  extractionSystemPrompt,
  type ExtractRequirementsFailure,
  type ExtractRequirementsRequest,
  type ExtractRequirementsResponse,
  type ExtractionErrorCode,
  type RequirementDraft,
} from '../../../../contracts';

export const runtime = 'nodejs';
export const maxDuration = 120;

/** One chunk, one attempt, one minute. The caller counts what times out. */
const CHUNK_TIMEOUT_MS = 60_000;
const MAX_OUTPUT_TOKENS = 8000;

/** 5 pages of dense A4 is far under this; anything above it is not a chunk. */
const MAX_CHUNK_CHARS = 200_000;

const requestSchema = z
  .object({
    documentId: z.string().min(1).max(64),
    filename: z.string().min(1).max(200),
    docType: z.enum(DOCUMENT_TYPES),
    chunk: z.object({
      index: z.number().int().min(0),
      startPage: z.number().int().positive(),
      endPage: z.number().int().positive(),
      text: z.string().min(1).max(MAX_CHUNK_CHARS),
    }),
  })
  .refine((body) => body.chunk.endPage >= body.chunk.startPage, {
    message: 'chunk.endPage must not precede chunk.startPage',
    path: ['chunk', 'endPage'],
  });

function failure(
  request: Pick<ExtractRequirementsRequest, 'documentId'> & { chunkIndex: number },
  code: ExtractionErrorCode,
  message: string,
  status: number,
) {
  const body: ExtractRequirementsFailure = {
    ok: false,
    documentId: request.documentId,
    chunkIndex: request.chunkIndex,
    error: { code, message },
  };
  return NextResponse.json<ExtractRequirementsResponse>(body, { status });
}

/**
 * `zodOutputFormat` builds the JSON schema the model is constrained to AND the
 * Zod parse `messages.parse` runs over the result. Constrained decoding only
 * guarantees the structural half — property names, types, required keys — so
 * string lengths, enum members and number ranges are still the Zod parse's job
 * and it can still fail.
 *
 * When it does, one over-long summary would otherwise throw away every good
 * draft in the chunk. Wrapping `parse` keeps the raw text so the failure path
 * can salvage the drafts that are fine and COUNT the ones that are not.
 */
function capturingOutputFormat() {
  const format = zodOutputFormat(ExtractionBatchSchema);
  const raw: { text: string | null } = { text: null };
  return {
    raw,
    format: {
      ...format,
      parse(content: string) {
        raw.text = content;
        return format.parse(content);
      },
    },
  };
}

interface Salvage {
  drafts: RequirementDraft[];
  rejectedCount: number;
}

/** Validates draft by draft, so a bad one costs its own row and nothing else. */
function salvageDrafts(rawText: string | null): Salvage | null {
  if (!rawText) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return null;
  }
  const drafts = (parsed as { drafts?: unknown })?.drafts;
  if (!Array.isArray(drafts)) return null;

  const kept: RequirementDraft[] = [];
  let rejectedCount = 0;
  for (const draft of drafts) {
    const result = RequirementDraftSchema.safeParse(draft);
    if (result.success) kept.push(result.data);
    else rejectedCount += 1;
  }
  return { drafts: kept, rejectedCount };
}

function classify(error: unknown, pages: string): { code: ExtractionErrorCode; message: string } {
  if (error instanceof RateLimitError) {
    return {
      code: 'rate_limited',
      message: 'The extraction service is rate limited. Wait a moment and re-upload the file.',
    };
  }
  if (error instanceof APIConnectionTimeoutError) {
    return {
      code: 'timeout',
      message:
        'The model did not respond within ' +
        CHUNK_TIMEOUT_MS / 1000 +
        ' seconds for pages ' +
        pages +
        '.',
    };
  }
  if (error instanceof AuthenticationError) {
    return {
      code: 'model_error',
      message: 'The extraction service rejected the server’s API key. Check ANTHROPIC_API_KEY.',
    };
  }
  if (error instanceof APIError) {
    return { code: 'model_error', message: 'The model returned an error for pages ' + pages + '.' };
  }
  if (error instanceof AnthropicError) {
    return {
      code: 'invalid_output',
      message: 'The model returned requirements in a shape Verdict could not read for pages ' + pages + '.',
    };
  }
  return { code: 'model_error', message: 'Extraction failed for pages ' + pages + '.' };
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Sign in to extract requirements.' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'The chunk could not be read.' }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'The chunk was not in the expected shape.' }, { status: 400 });
  }
  const extractRequest: ExtractRequirementsRequest = parsed.data;
  const { chunk } = extractRequest;
  const pages = chunk.startPage + '–' + chunk.endPage;
  const identity = { documentId: extractRequest.documentId, chunkIndex: chunk.index };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return failure(
      identity,
      'model_error',
      'Extraction is not configured on this deployment — ANTHROPIC_API_KEY is not set.',
      500,
    );
  }

  // One attempt, one retry: the caller already treats a failed chunk as a
  // counted, visible outcome rather than something to hide behind retries.
  const client = new Anthropic({ apiKey, timeout: CHUNK_TIMEOUT_MS, maxRetries: 1 });
  const { raw, format } = capturingOutputFormat();

  try {
    const message = await client.messages.parse({
      model: EXTRACTION_MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: extractionSystemPrompt(extractRequest),
      messages: [{ role: 'user', content: chunk.text }],
      output_config: { format },
    });

    if (message.stop_reason === 'refusal') {
      return failure(
        identity,
        'model_error',
        'The model declined to extract pages ' + pages + '.',
        502,
      );
    }
    if (message.stop_reason === 'max_tokens') {
      const salvaged = salvageDrafts(raw.text);
      if (!salvaged) {
        return failure(
          identity,
          'invalid_output',
          'Pages ' + pages + ' produced more requirements than one chunk can return.',
          502,
        );
      }
      return NextResponse.json<ExtractRequirementsResponse>({
        ok: true,
        ...identity,
        model: message.model,
        drafts: salvaged.drafts,
        rejectedCount: salvaged.rejectedCount,
      });
    }

    return NextResponse.json<ExtractRequirementsResponse>({
      ok: true,
      ...identity,
      model: message.model,
      drafts: message.parsed_output?.drafts ?? [],
      rejectedCount: 0,
    });
  } catch (error) {
    // The Zod parse threw: keep every draft that is well formed and count the
    // rest, rather than losing a whole chunk to one bad row.
    const salvaged = error instanceof AnthropicError && !(error instanceof APIError)
      ? salvageDrafts(raw.text)
      : null;
    if (salvaged && salvaged.drafts.length > 0) {
      return NextResponse.json<ExtractRequirementsResponse>({
        ok: true,
        ...identity,
        model: EXTRACTION_MODEL,
        drafts: salvaged.drafts,
        rejectedCount: salvaged.rejectedCount,
      });
    }
    const { code, message } = classify(error, pages);
    return failure(identity, code, message, 502);
  }
}
