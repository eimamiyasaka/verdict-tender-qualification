/**
 * The insert boundary — spec §8 step 7, §7.8.
 *
 * Spec §6.3 allows no Prisma call outside `src/lib/db/`, so the division is:
 * this module validates, deduplicates and shapes (all of it in `prepare.ts`,
 * which stays pure and testable), then hands ONE payload to the data layer,
 * which owns the transaction and the event written inside it.
 *
 * `persistExtraction` is owned by the Prisma data-layer session. It writes the
 * requirements, their additional citations, the key dates and the document's
 * status and `extraction.completed` / `extraction.failed` event together, and
 * returns what it actually created.
 */

import 'server-only';

// Owned by feat/prisma-data-layer — imported, never defined here.
import { persistExtraction } from '@/lib/db/ingest';
import { NO_REQUIREMENTS_MESSAGE, type DocumentExtractionOutcome } from '../../../contracts';
import {
  prepareExtraction,
  prepareFailedExtraction,
  type PersistExtractionInput,
  type PrepareExtractionInput,
} from './prepare';

export {
  prepareExtraction,
  prepareFailedExtraction,
  type PersistExtractionInput,
  type PrepareExtractionInput,
  type PreparedCitation,
  type PreparedExtraction,
  type PreparedKeyDate,
  type PreparedRequirement,
} from './prepare';

/** What the data layer actually wrote. The UI counts these, not the intent. */
export interface PersistExtractionResult {
  requirementsCreated: number;
  citationsCreated: number;
  keyDatesCreated: number;
  /** `failed` for a scan, an unreadable file, or a document where no chunk landed. */
  status: 'complete' | 'failed';
  /** The message stored verbatim on the document, when there is one. */
  extractionError: string | null;
  outcome: DocumentExtractionOutcome;
  /**
   * Spec §14: a document that parsed fine and yielded nothing is not an empty
   * matrix, it is a message. Null whenever there is something to show.
   */
  message: string | null;
}

function resultFrom(
  input: PersistExtractionInput,
  written: { requirementsCreated: number; citationsCreated: number; keyDatesCreated: number },
): PersistExtractionResult {
  // The data layer's counts win: it can still collapse a requirement onto one
  // already extracted from another document in this tender, which turns an
  // intended requirement into an extra citation.
  const outcome: DocumentExtractionOutcome = {
    ...input.outcome,
    requirementsCreated: written.requirementsCreated,
    citationsCreated: written.citationsCreated,
  };
  const nothingFound =
    input.status === 'complete' && written.requirementsCreated === 0 && written.citationsCreated === 0;
  return {
    ...written,
    status: input.status,
    extractionError: input.extractionError,
    outcome,
    message: nothingFound ? NO_REQUIREMENTS_MESSAGE : null,
  };
}

/**
 * Persists one document's extraction. Chunk failures are carried on the
 * outcome, not raised: one chunk failing does not fail the document, and the
 * count reaches the event and the Documents tab.
 */
export async function persistDocumentExtraction(
  orgId: string,
  input: PrepareExtractionInput,
): Promise<PersistExtractionResult> {
  const prepared = prepareExtraction(input);
  const written = await persistExtraction(orgId, prepared.input);
  return resultFrom(prepared.input, written);
}

/**
 * The pre-model failure path: no text layer, or a file that would not open.
 * The message is stored verbatim on the document and no model call was made.
 */
export async function persistFailedExtraction(
  orgId: string,
  input: {
    tenderId: string;
    documentId: string;
    filename: string;
    pageCount: number | null;
    message: string;
  },
): Promise<PersistExtractionResult> {
  const payload = prepareFailedExtraction(input);
  const written = await persistExtraction(orgId, payload);
  return resultFrom(payload, written);
}
