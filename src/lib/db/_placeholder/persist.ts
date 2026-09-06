/**
 * PLACEHOLDER for `src/lib/ingest/persist.ts` (§8 step 7).
 *
 * Validates each draft with Zod, holds low-confidence drafts for review,
 * deduplicates on (kind + normalised constraint) against both the batch and
 * the tender's existing requirements, keeps the highest-confidence draft as
 * the Requirement and writes every loser's provenance to RequirementCitation.
 */
import { z } from "zod";
import {
  OBLIGATIONS,
  REQUIREMENT_KINDS,
  type Requirement,
  type RequirementConstraint,
  type RequirementDraft,
} from "@/lib/types";
import { newId, type Store } from "./store";

export const CONFIDENCE_THRESHOLD = 0.6;

const draftSchema = z.object({
  kind: z.enum(REQUIREMENT_KINDS),
  obligation: z.enum(OBLIGATIONS),
  summary: z.string().trim().min(1).max(240),
  constraint: z.record(z.string(), z.unknown()),
  pageNumber: z.number().int().positive(),
  quotedClause: z.string().trim().min(1).max(1200),
  clauseReference: z.string().trim().max(80).nullable(),
  questionRef: z.string().trim().max(120).nullable(),
  wordLimit: z.number().int().positive().nullable(),
  weighting: z.number().min(0).max(100).nullable(),
  extractionConfidence: z.number().min(0).max(1),
});

/** Invariant 2 — constraint shape by kind (§7.8). */
function constraintShapeValid(kind: string, c: Record<string, unknown>): boolean {
  switch (kind) {
    case "certification":
      return typeof c.credential_code === "string";
    case "financial":
      return "metric" in c && "operator" in c && "value" in c;
    case "insurance":
      return "insurance_kind" in c && "min_cover" in c;
    case "experience":
      return "min_count" in c;
    case "policy":
      return typeof c.policy_type === "string";
    default:
      return true;
  }
}

function normaliseConstraint(kind: string, c: Record<string, unknown>): string {
  const entries = Object.entries(c)
    .filter(([k]) => k !== "kind")
    .map(([k, v]) => [k, typeof v === "string" ? v.trim().toLowerCase() : v] as const)
    .sort(([a], [b]) => a.localeCompare(b));
  return `${kind}:${JSON.stringify(entries)}`;
}

export interface PersistOutcome {
  created: number;
  citationsAdded: number;
  heldForReview: number;
  rejected: number;
}

export function persistDrafts(
  store: Store,
  params: { orgId: string; tenderId: string; documentId: string; drafts: RequirementDraft[] },
): PersistOutcome {
  const outcome: PersistOutcome = { created: 0, citationsAdded: 0, heldForReview: 0, rejected: 0 };
  const existingByKey = new Map<string, Requirement>();
  for (const r of store.requirements) {
    if (r.tenderId !== params.tenderId) continue;
    existingByKey.set(normaliseConstraint(r.kind, r.constraintJson as Record<string, unknown>), r);
  }

  // Highest confidence first so the survivor of each key is decided on first sight.
  const sorted = [...params.drafts].sort((a, b) => b.extractionConfidence - a.extractionConfidence);
  const now = new Date();

  for (const raw of sorted) {
    const parsed = draftSchema.safeParse(raw);
    if (!parsed.success) {
      outcome.rejected += 1;
      continue;
    }
    const draft = parsed.data;
    if (draft.extractionConfidence < CONFIDENCE_THRESHOLD) {
      outcome.heldForReview += 1;
      continue;
    }
    let kind = draft.kind;
    let constraint = { ...draft.constraint } as Record<string, unknown>;
    if (!constraintShapeValid(kind, constraint)) {
      outcome.rejected += 1;
      continue;
    }
    // A credential code the reference table does not know is kept as `other` with the raw string (§14).
    if (kind === "certification") {
      const code = String(constraint.credential_code);
      if (!store.credentialTypes.some((t) => t.code === code)) {
        kind = "other";
        constraint = { credential_code: code, unrecognised: true };
      }
    }
    const key = normaliseConstraint(kind, constraint);
    const existing = existingByKey.get(key);
    if (existing) {
      store.citations.push({
        id: newId(),
        requirementId: existing.id,
        orgId: params.orgId,
        documentId: params.documentId,
        pageNumber: draft.pageNumber,
        quotedClause: draft.quotedClause,
        clauseReference: draft.clauseReference,
        createdAt: now,
      });
      outcome.citationsAdded += 1;
      continue;
    }
    const requirement: Requirement = {
      id: newId(),
      tenderId: params.tenderId,
      orgId: params.orgId,
      kind,
      obligation: draft.obligation,
      summary: draft.summary,
      constraintJson: { kind, ...constraint } as RequirementConstraint,
      documentId: params.documentId,
      pageNumber: draft.pageNumber,
      quotedClause: draft.quotedClause,
      clauseReference: draft.clauseReference,
      questionRef: draft.questionRef,
      wordLimit: draft.wordLimit,
      weighting: draft.weighting,
      extractionConfidence: draft.extractionConfidence,
      createdAt: now,
    };
    store.requirements.push(requirement);
    existingByKey.set(key, requirement);
    outcome.created += 1;
  }
  return outcome;
}
