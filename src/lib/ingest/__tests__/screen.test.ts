/**
 * Step 1 — what is rejected before a single page is parsed (spec §8 step 1, §14).
 */

import { describe, expect, it } from 'vitest';
import { MAX_DOCUMENTS_PER_TENDER, MAX_UPLOAD_BYTES } from '../../../../contracts';
import { guessDocType, screenSelection } from '../screen';

const pdf = (name: string, size = 1024) => ({ name, size, type: 'application/pdf' });

describe('screenSelection', () => {
  it('lets an ordinary pack through', () => {
    const screened = screenSelection([pdf('PSQ.pdf'), pdf('ITT.pdf')]);
    expect(screened.selectionError).toBeNull();
    expect(screened.files.map((f) => f.error)).toEqual([null, null]);
  });

  it('rejects a file over the limit and names its size', () => {
    const oversized = pdf('Specification.pdf', MAX_UPLOAD_BYTES + 1);
    const [screened] = screenSelection([oversized]).files;
    expect(screened.error).toContain('20MB');
    expect(screened.error).toContain('20.0MB');
  });

  it('accepts a file exactly on the limit', () => {
    const [screened] = screenSelection([pdf('PSQ.pdf', MAX_UPLOAD_BYTES)]).files;
    expect(screened.error).toBeNull();
  });

  it('rejects a pack over the document limit and names the count', () => {
    const files = Array.from({ length: MAX_DOCUMENTS_PER_TENDER + 2 }, (_, i) =>
      pdf('doc-' + i + '.pdf'),
    );
    const screened = screenSelection(files);
    expect(screened.selectionError).toContain('You selected 8');
    expect(screened.selectionError).toContain('remove 2');
  });

  it('counts documents already on the tender toward the limit', () => {
    const screened = screenSelection([pdf('a.pdf'), pdf('b.pdf')], 5);
    expect(screened.selectionError).toContain('You selected 7');
    expect(screened.selectionError).toContain('remove 1');
  });

  it('rejects something that is not a PDF', () => {
    const [screened] = screenSelection([
      { name: 'Pricing.xlsx', size: 4096, type: 'application/vnd.ms-excel' },
    ]).files;
    expect(screened.error).toContain('not a PDF');
  });

  it('accepts a PDF whose MIME type the browser did not set', () => {
    const [screened] = screenSelection([{ name: 'PSQ.PDF', size: 4096, type: '' }]).files;
    expect(screened.error).toBeNull();
  });
});

describe('guessDocType', () => {
  it('reads the pack’s usual filenames', () => {
    expect(guessDocType('PSQ.pdf')).toBe('psq');
    expect(guessDocType('02 - ITT.pdf')).toBe('itt');
    expect(guessDocType('Specification v3.pdf')).toBe('specification');
    expect(guessDocType('Evaluation Methodology.pdf')).toBe('evaluation_methodology');
    expect(guessDocType('Contract Notice.pdf')).toBe('contract_notice');
    expect(guessDocType('Pricing Schedule.pdf')).toBe('pricing_schedule');
    expect(guessDocType('Clarification Log.pdf')).toBe('clarification_log');
    expect(guessDocType('Appendix C.pdf')).toBe('other');
  });
});
