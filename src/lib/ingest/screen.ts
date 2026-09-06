/**
 * Step 1 of the pipeline — rejection before anything is parsed (spec §8 step 1,
 * §14). Nothing here reads a file: an oversized pack costs the browser nothing
 * but the size of its `File` handle, and the user is told the number that made
 * it fail.
 */

import {
  MAX_DOCUMENTS_PER_TENDER,
  MAX_UPLOAD_BYTES,
  tooManyDocumentsMessage,
  uploadTooLargeMessage,
  type DocumentType,
} from '../../../contracts';

/** Just enough of `File` to screen it, so the rule is testable without a DOM. */
export interface ScreenableFile {
  name: string;
  size: number;
  type: string;
}

export interface ScreenedFile<F extends ScreenableFile> {
  file: F;
  /** Null when the file may be read. Otherwise the message the user sees. */
  error: string | null;
}

export interface ScreenedSelection<F extends ScreenableFile> {
  files: ScreenedFile<F>[];
  /** Applies to the selection as a whole rather than to any one file. */
  selectionError: string | null;
}

function isPdf(file: ScreenableFile): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

/**
 * Spec §14: an upload over 20MB is rejected client-side before parsing with the
 * size named, and a pack over six documents is rejected with the count named.
 * Both messages come from `contracts.ts`, so there is one copy of each.
 */
export function screenSelection<F extends ScreenableFile>(
  files: readonly F[],
  existingCount = 0,
): ScreenedSelection<F> {
  const total = existingCount + files.length;
  return {
    selectionError: total > MAX_DOCUMENTS_PER_TENDER ? tooManyDocumentsMessage(total) : null,
    files: files.map((file) => ({
      file,
      error: !isPdf(file)
        ? 'This is not a PDF. Verdict reads the buyer’s PDF pack.'
        : file.size > MAX_UPLOAD_BYTES
          ? uploadTooLargeMessage(file.size)
          : null,
    })),
  };
}

/** Guesses a document's role from its filename so most uploads need no re-tagging. */
export function guessDocType(filename: string): DocumentType {
  const name = filename.toLowerCase();
  if (/\bpsq\b|questionnaire|selection/.test(name)) return 'psq';
  if (/\bitt\b|invitation to tender/.test(name)) return 'itt';
  if (/pricing|price schedule|schedule of rates|\bboq\b/.test(name)) return 'pricing_schedule';
  if (/evaluation|methodology|award criteria|scoring/.test(name)) return 'evaluation_methodology';
  if (/terms|conditions|\bt&cs?\b/.test(name)) return 'terms_and_conditions';
  if (/clarification|q&a|questions and answers/.test(name)) return 'clarification_log';
  if (/notice/.test(name)) return 'contract_notice';
  if (/spec/.test(name)) return 'specification';
  return 'other';
}
