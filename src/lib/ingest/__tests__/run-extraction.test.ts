/**
 * The orchestrator, in the order spec §8 puts it.
 *
 * Three guarantees are asserted here and nowhere else:
 *
 *   - A scanned PDF never reaches the model. The check is cheap, it runs
 *     before the first call, and the stored message is the frozen one.
 *   - ONE CHUNK FAILING DOES NOT FAIL THE DOCUMENT. The document still
 *     completes, the drafts from the chunks that worked are still saved, and
 *     the failure is a count on the outcome rather than a silence.
 *   - Every chunk failing DOES fail the document, so an empty matrix never
 *     reaches an assessment dressed as a clean one.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  EXTRACTION_CONCURRENCY,
  NO_TEXT_LAYER_MESSAGE,
  type ExtractRequirementsRequest,
  type PageText,
} from '../../../../contracts';
import { sampleDrafts } from '../../../../fixtures/extraction';

const registerDocumentAction = vi.fn(async () => ({ ok: true as const, documentId: 'doc-1' }));
const markExtractionRunningAction = vi.fn(async () => undefined);
const saveExtractionAction = vi.fn(async (input: any) => ({
  ok: true as const,
  status: (input.chunksTotal > 0 && input.chunksSucceeded === 0 ? 'failed' : 'complete') as
    | 'complete'
    | 'failed',
  extractionError:
    input.chunksTotal > 0 && input.chunksSucceeded === 0 ? 'None of the page ranges landed.' : null,
  requirementsCreated: input.drafts.length,
  citationsCreated: 0,
  keyDatesCreated: 0,
  outcome: {
    documentId: input.documentId,
    chunksTotal: input.chunksTotal,
    chunksSucceeded: input.chunksSucceeded,
    chunksFailed: input.chunksFailed,
    draftsAccepted: input.drafts.length,
    draftsHeldForReview: 0,
    draftsRejected: input.draftsRejectedUpstream,
    requirementsCreated: input.drafts.length,
    citationsCreated: 0,
  },
  message: null,
}));
const saveExtractionFailureAction = vi.fn(async (input: any) => ({
  ok: true as const,
  requirementsCreated: 0,
  citationsCreated: 0,
  keyDatesCreated: 0,
  status: 'failed' as const,
  extractionError: input.message,
  outcome: { documentId: input.documentId } as any,
  message: null,
}));
const extractPdfText = vi.fn();

vi.mock('@/lib/actions/documents', () => ({
  registerDocumentAction: (...args: any[]) => registerDocumentAction(...(args as [])),
  markExtractionRunningAction: (...args: any[]) => markExtractionRunningAction(...(args as [])),
}));
vi.mock('../actions', () => ({
  saveExtractionAction: (input: any) => saveExtractionAction(input),
  saveExtractionFailureAction: (input: any) => saveExtractionFailureAction(input),
}));
vi.mock('@/lib/pdf/extract', () => ({
  UNREADABLE_PDF_MESSAGE: 'unreadable',
  extractPdfText: (...args: any[]) => extractPdfText(...(args as [])),
}));

const { runExtraction } = await import('../run-extraction');

function pagesOf(count: number, charsPerPage: number): PageText[] {
  return Array.from({ length: count }, (_, i) => ({
    pageNumber: i + 1,
    text: ('Clause ' + (i + 1) + '.1 The supplier shall comply. ').padEnd(charsPerPage, 'x'),
  }));
}

function document(count: number, charsPerPage: number) {
  const pages = pagesOf(count, charsPerPage);
  return {
    pageCount: count,
    pages,
    totalCharacters: pages.reduce((n, p) => n + p.text.length, 0),
  };
}

const item = {
  id: 'item-1',
  file: { name: 'PSQ.pdf', size: 1024 } as File,
  docType: 'psq' as const,
};

const progress: Array<{ id: string; stage: string }> = [];
const events = {
  onProgress: (id: string, p: any) => {
    progress.push({ id, stage: p.stage });
  },
};

beforeEach(() => {
  progress.length = 0;
  vi.clearAllMocks();
  registerDocumentAction.mockResolvedValue({ ok: true, documentId: 'doc-1' });
});

describe('a scanned PDF', () => {
  it('is failed with the stored message before a single model call', async () => {
    // 12 pages of page furniture — below 200 characters a page.
    extractPdfText.mockResolvedValue(document(12, 25));
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const [result] = await runExtraction('tender-1', [item], events);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(markExtractionRunningAction).not.toHaveBeenCalled();
    expect(saveExtractionAction).not.toHaveBeenCalled();
    expect(saveExtractionFailureAction).toHaveBeenCalledWith(
      expect.objectContaining({ documentId: 'doc-1', pageCount: 12, message: NO_TEXT_LAYER_MESSAGE }),
    );
    expect(result.progress).toEqual({ stage: 'failed', message: NO_TEXT_LAYER_MESSAGE });
    vi.unstubAllGlobals();
  });
});

describe('a text PDF where one chunk fails', () => {
  const requests: ExtractRequirementsRequest[] = [];

  async function run(failingChunkIndex: number) {
    requests.length = 0;
    extractPdfText.mockResolvedValue(document(12, 400));
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: any) => {
        const body = JSON.parse(init.body) as ExtractRequirementsRequest;
        requests.push(body);
        if (body.chunk.index === failingChunkIndex) {
          return new Response(
            JSON.stringify({
              ok: false,
              documentId: body.documentId,
              chunkIndex: body.chunk.index,
              error: { code: 'timeout', message: 'The model did not respond.' },
            }),
            { status: 502, headers: { 'content-type': 'application/json' } },
          );
        }
        return new Response(
          JSON.stringify({
            ok: true,
            documentId: body.documentId,
            chunkIndex: body.chunk.index,
            model: 'claude-sonnet-4-6',
            drafts: [sampleDrafts[0]],
            rejectedCount: 0,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }),
    );
    const [result] = await runExtraction('tender-1', [item], events);
    vi.unstubAllGlobals();
    return result;
  }

  it('still completes the document, and counts the failure', async () => {
    const result = await run(1);

    expect(result.progress.stage).toBe('complete');
    const saved = saveExtractionAction.mock.calls[0][0];
    expect(saved.chunksTotal).toBe(3);
    expect(saved.chunksFailed).toBe(1);
    expect(saved.chunksSucceeded).toBe(2);
    // The two chunks that worked still contributed their drafts. An empty
    // union reported as a success is the failure mode this guards against.
    expect(saved.drafts).toHaveLength(2);
    if (result.progress.stage === 'complete') {
      expect(result.progress.outcome.chunksFailed).toBe(1);
    }
  });

  it('sends every window with its true page offsets, at the frozen concurrency', async () => {
    await run(-1);
    expect(requests.map((r) => [r.chunk.index, r.chunk.startPage, r.chunk.endPage])).toEqual([
      [0, 1, 5],
      [1, 5, 9],
      [2, 9, 12],
    ]);
    expect(requests.every((r) => r.documentId === 'doc-1' && r.docType === 'psq')).toBe(true);
    expect(EXTRACTION_CONCURRENCY).toBe(4);
  });

  it('reports each stage in the order the spec puts them', async () => {
    await run(-1);
    const stages = progress.map((p) => p.stage);
    expect(stages[0]).toBe('registering');
    expect(stages).toContain('reading');
    expect(stages.indexOf('extracting')).toBeGreaterThan(stages.indexOf('reading'));
    expect(stages.indexOf('saving')).toBeGreaterThan(stages.lastIndexOf('extracting'));
    expect(stages[stages.length - 1]).toBe('complete');
  });
});

describe('a text PDF where every chunk fails', () => {
  it('still records the document rather than leaving it running', async () => {
    extractPdfText.mockResolvedValue(document(6, 400));
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );

    const [result] = await runExtraction('tender-1', [item], events);
    vi.unstubAllGlobals();

    expect(saveExtractionAction).toHaveBeenCalledTimes(1);
    const saved = saveExtractionAction.mock.calls[0][0];
    expect(saved.chunksFailed).toBe(saved.chunksTotal);
    expect(saved.drafts).toEqual([]);
    // Not "complete with nothing in it": the tender must not settle on
    // `extracted` and let an assessment read an empty matrix as all-clear.
    expect(result.progress).toEqual({
      stage: 'failed',
      message: 'None of the page ranges landed.',
    });
  });
});
