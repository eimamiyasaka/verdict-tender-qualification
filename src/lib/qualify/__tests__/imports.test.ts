/**
 * Spec §6.6, made mechanical: the engine imports `contracts.ts` and its own
 * siblings, and nothing else. No Prisma, no Next, no database, no clock.
 *
 * This is the test that keeps "the evaluator is pure" true after the branch that
 * adds a convenience helper somewhere in `src/lib/`.
 */

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ENGINE_DIR = path.join(import.meta.dirname, '..');
const ALLOWED_EXTERNAL = '../../../contracts';
/** `new Date(x)` derives a value from an input; `new Date()` reads the wall clock. */
const FORBIDDEN = /new Date\(\s*\)|Date\.now\(|Math\.random\(|process\.env|\bfetch\(/;

function sourceFiles(): string[] {
  return readdirSync(ENGINE_DIR)
    .filter((entry) => entry.endsWith('.ts'))
    .sort();
}

function importSpecifiers(source: string): string[] {
  return Array.from(source.matchAll(/from\s+'([^']+)'/g)).map((match) => match[1]);
}

/** The rules are about code, not about the comments that explain them. */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

describe('the engine imports nothing but contracts.ts', () => {
  const files = sourceFiles();

  it('has the modules the entry point is built from', () => {
    expect(files).toEqual([
      'certification.ts',
      'evaluate.ts',
      'experience.ts',
      'financial.ts',
      'insurance.ts',
      'not-applicable.ts',
      'policy.ts',
      'rationale.ts',
    ]);
  });

  for (const file of files) {
    it(`${file} imports only contracts.ts and its siblings`, () => {
      const source = readFileSync(path.join(ENGINE_DIR, file), 'utf8');
      for (const specifier of importSpecifiers(source)) {
        const isSibling = /^\.\/[a-z-]+$/.test(specifier);
        expect(isSibling || specifier === ALLOWED_EXTERNAL, `${file} imports ${specifier}`).toBe(
          true,
        );
      }
    });

    it(`${file} reads no clock but the injected asOf`, () => {
      const source = withoutComments(readFileSync(path.join(ENGINE_DIR, file), 'utf8'));
      expect(FORBIDDEN.test(source), `${file} reaches outside its input`).toBe(false);
    });
  }
});
