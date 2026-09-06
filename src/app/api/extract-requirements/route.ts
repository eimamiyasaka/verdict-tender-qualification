import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import type { RequirementDraft } from "@/lib/types";

/**
 * PLACEHOLDER for the one hand-written HTTP endpoint in the app (§6.1, §8).
 *
 * The real route holds ANTHROPIC_API_KEY, sends each 5-page chunk to the
 * model with EXTRACTION_RULES from contracts.ts, and returns structured
 * `RequirementDraft[]`. This stub returns drafts derived from binding
 * language in the chunk text so the browser-side pipeline — pdf.js, the
 * no-text-layer check, chunking, concurrency, per-chunk progress, dedupe and
 * the Documents tab — can be exercised end to end without a model.
 *
 * Every draft it emits is `kind: "other"`, so nothing here ever produces a
 * pass or fail; the evaluator marks them not applicable.
 */

interface ChunkRequest {
  documentName: string;
  docType: string;
  pages: Array<{ pageNumber: number; text: string }>;
}

const BINDING = /\b(must|shall|will be excluded|is a condition of participation|pass\/fail|mandatory)\b/i;
const CLAUSE_REF = /(?:^|\s)((?:§\s?)?\d+(?:\.\d+){1,3}|[A-Z]{1,3}\d+(?:\.\d+)*|Appendix [A-Z]|Schedule \d+)(?=\s|$|[:.)])/;

function sentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.;])\s+(?=[A-Z(])/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 40 && s.length <= 600);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in to extract requirements." }, { status: 401 });
  }
  let body: ChunkRequest;
  try {
    body = (await request.json()) as ChunkRequest;
  } catch {
    return NextResponse.json({ error: "The chunk could not be read." }, { status: 400 });
  }
  if (!Array.isArray(body.pages)) {
    return NextResponse.json({ error: "The chunk had no pages." }, { status: 400 });
  }

  const drafts: RequirementDraft[] = [];
  for (const page of body.pages) {
    for (const sentence of sentences(page.text)) {
      if (!BINDING.test(sentence)) continue;
      const strong = /\b(must|shall|will be excluded|pass\/fail)\b/i.test(sentence);
      const clause = CLAUSE_REF.exec(sentence)?.[1]?.trim() ?? null;
      drafts.push({
        kind: "other",
        obligation: strong ? "mandatory" : "desirable",
        summary: sentence.length > 110 ? `${sentence.slice(0, 107).trimEnd()}…` : sentence,
        // Distinct per sentence so two different clauses are not deduplicated as one obligation.
        constraint: { kind: "other", extracted_by: "placeholder-route", clause_key: sentence.toLowerCase().slice(0, 96) },
        pageNumber: page.pageNumber,
        quotedClause: sentence.slice(0, 1200),
        clauseReference: clause,
        questionRef: null,
        wordLimit: null,
        weighting: null,
        // Honest confidence: this is a regex, not a model. A handful clears the
        // review threshold so the matrix shows something; most are held for review.
        extractionConfidence: strong ? 0.66 : 0.45,
      });
      if (drafts.length >= 12) break;
    }
  }

  return NextResponse.json({
    model: "placeholder-regex (no model call on this branch)",
    drafts,
  });
}
