/**
 * Word count is computed here, not by the database (§7.7). The empty string
 * returns 0 — the generated column in the old schema claimed one word for an
 * empty draft, and that is the first test case.
 */
export function countWords(body: string): number {
  const trimmed = body.trim();
  if (trimmed === "") return 0;
  return trimmed.split(/\s+/).length;
}

/** First ~N characters on a word boundary, for previews. Never used on rationale text. */
export function excerpt(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 40 ? lastSpace : max)}…`;
}

/** Keyword terms for library matching: lower-cased, 3+ chars, de-duplicated. */
export function searchTerms(query: string): string[] {
  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9']+/)
    .map((t) => t.replace(/'/g, ""))
    .filter((t) => t.length >= 3);
  return Array.from(new Set(terms));
}
