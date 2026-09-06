'use server';

/**
 * The server end of the browser-driven pipeline (spec §8).
 *
 * pdf.js runs in the browser, so the orchestrator lives there too and calls
 * back through these. `orgId` is taken from the session and never from the
 * request body (spec §6.3); everything else is validated before it is used.
 *
 * Drafts make a round trip — browser → extraction route → browser → here —
 * because the browser is the only place that holds the document text. That is
 * exactly why `prepare.ts` re-validates every draft with
 * `RequirementDraftSchema` rather than trusting what comes back.
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getOrgContext } from '@/lib/auth/session';
import { errorMessage } from '@/lib/actions/shared';
import type { DocumentExtractionOutcome } from '../../../contracts';
import { persistDocumentExtraction, persistFailedExtraction } from './persist';

export interface ExtractionRecorded {
  ok: true;
  requirementsCreated: number;
  citationsCreated: number;
  keyDatesCreated: number;
  status: 'complete' | 'failed';
  extractionError: string | null;
  outcome: DocumentExtractionOutcome;
  message: string | null;
}

export type ExtractionRecordResult = ExtractionRecorded | { ok: false; error: string };

const identity = z.object({
  tenderId: z.string().min(1),
  documentId: z.string().min(1),
  filename: z.string().min(1).max(200),
  pageCount: z.number().int().positive().nullable(),
});

const completedSchema = identity.extend({
  model: z.string().min(1).max(120),
  chunksTotal: z.number().int().min(0),
  chunksSucceeded: z.number().int().min(0),
  chunksFailed: z.number().int().min(0),
  draftsRejectedUpstream: z.number().int().min(0),
  /** Shape-checked one by one in `prepare.ts`, which counts what it rejects. */
  drafts: z.array(z.unknown()),
});

const failedSchema = identity.extend({
  message: z.string().min(1).max(500),
});

export type RecordExtractionInput = z.input<typeof completedSchema>;
export type FailExtractionInput = z.input<typeof failedSchema>;

function revalidate(tenderId: string) {
  revalidatePath('/tenders/' + tenderId);
  revalidatePath('/');
}

/**
 * Records everything one document's chunks produced. Called once per document,
 * after every chunk has settled — a failed chunk is a count on the outcome,
 * never a reason to skip this call.
 */
export async function saveExtractionAction(
  input: RecordExtractionInput,
): Promise<ExtractionRecordResult> {
  const { orgId } = await getOrgContext();
  const parsed = completedSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'The extraction result was not understood and has not been saved.' };
  }
  try {
    const result = await persistDocumentExtraction(orgId, parsed.data);
    revalidate(parsed.data.tenderId);
    return { ok: true, ...result };
  } catch (error) {
    return { ok: false, error: errorMessage(error, 'The extraction result could not be saved.') };
  }
}

/**
 * Records a document that failed before any model call — spec §8 step 3. The
 * message is stored verbatim on `tender_documents.extraction_error` and shown
 * in full in the Documents tab.
 */
export async function saveExtractionFailureAction(
  input: FailExtractionInput,
): Promise<ExtractionRecordResult> {
  const { orgId } = await getOrgContext();
  const parsed = failedSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'The extraction failure was not understood and has not been saved.' };
  }
  try {
    const result = await persistFailedExtraction(orgId, parsed.data);
    revalidate(parsed.data.tenderId);
    return { ok: true, ...result };
  } catch (error) {
    return { ok: false, error: errorMessage(error, 'The extraction failure could not be saved.') };
  }
}
