/**
 * Requirements (§7.5) — the core table, and the reads behind the matrix and the
 * citation drawer (§10.2, §12.6).
 *
 * Invariant 1 is why every read here can assume a document: `documentId`,
 * `pageNumber` and `quotedClause` are NOT NULL at the database level, so a
 * requirement that cannot be pointed at does not exist and the drawer never has
 * to render a missing source.
 *
 * `constraintJson` is stored in the `contracts.ts` shape with snake_case keys,
 * because spec §7.8's CHECK constraint queries those exact keys. The cast to the
 * UI's mirror type happens here, once.
 */

import type { EvaluableRequirement } from "../../../contracts";
import type {
  Obligation,
  Requirement,
  RequirementConstraint,
  RequirementKind,
  RequirementWithSources,
} from "@/lib/types";
import { prisma, toNumber, type Db } from "./client";
import { toDocument } from "./documents";

/** The include every requirement read shares: its citation, and its extras. */
export const requirementSources = {
  document: true,
  citations: { include: { document: true }, orderBy: { createdAt: "asc" } },
} as const;

type RequirementRow = {
  id: string;
  tenderId: string;
  orgId: string;
  kind: string;
  obligation: string;
  summary: string;
  constraintJson: unknown;
  documentId: string;
  pageNumber: number;
  quotedClause: string;
  clauseReference: string | null;
  questionRef: string | null;
  wordLimit: number | null;
  weighting: { toNumber(): number } | null;
  extractionConfidence: { toNumber(): number } | null;
  createdAt: Date;
};

export function toRequirement(row: RequirementRow): Requirement {
  return {
    id: row.id,
    tenderId: row.tenderId,
    orgId: row.orgId,
    kind: row.kind as RequirementKind,
    obligation: row.obligation as Obligation,
    summary: row.summary,
    constraintJson: row.constraintJson as RequirementConstraint,
    documentId: row.documentId,
    pageNumber: row.pageNumber,
    quotedClause: row.quotedClause,
    clauseReference: row.clauseReference,
    questionRef: row.questionRef,
    wordLimit: row.wordLimit,
    weighting: toNumber(row.weighting as never),
    extractionConfidence: toNumber(row.extractionConfidence as never),
    createdAt: row.createdAt,
  };
}

type SourcedRow = RequirementRow & {
  document: Parameters<typeof toDocument>[0];
  citations: Array<{
    id: string;
    requirementId: string;
    orgId: string;
    documentId: string;
    pageNumber: number;
    quotedClause: string;
    clauseReference: string | null;
    createdAt: Date;
    document: Parameters<typeof toDocument>[0];
  }>;
};

/** A requirement with everything the citation drawer renders (§12.6). */
export function toRequirementWithSources(row: SourcedRow): RequirementWithSources {
  return {
    ...toRequirement(row),
    document: toDocument(row.document),
    citations: row.citations.map((citation) => ({
      id: citation.id,
      requirementId: citation.requirementId,
      orgId: citation.orgId,
      documentId: citation.documentId,
      pageNumber: citation.pageNumber,
      quotedClause: citation.quotedClause,
      clauseReference: citation.clauseReference,
      createdAt: citation.createdAt,
      document: toDocument(citation.document),
    })),
  };
}

/**
 * The matrix, in the order the tabs read it: the tender's requirements with
 * their primary citation and any additional ones. Filtering by kind, obligation
 * and verdict is a client concern (§10.2) — it happens over this one result, not
 * over one query per filter.
 */
export async function listRequirements(
  orgId: string,
  tenderId: string,
  db: Db = prisma,
): Promise<RequirementWithSources[]> {
  const rows = await db.requirement.findMany({
    where: { orgId, tenderId },
    include: requirementSources,
    orderBy: [{ obligation: "asc" }, { createdAt: "asc" }],
  });
  return rows.map((row) => toRequirementWithSources(row as unknown as SourcedRow));
}

export async function getRequirement(
  orgId: string,
  requirementId: string,
): Promise<RequirementWithSources | null> {
  const row = await prisma.requirement.findFirst({
    where: { id: requirementId, orgId },
    include: requirementSources,
  });
  return row ? toRequirementWithSources(row as unknown as SourcedRow) : null;
}

/**
 * What the evaluator is allowed to see (§9): id, kind, obligation, summary and
 * the typed constraint. Nothing about the citation, because a page number
 * cannot change a verdict.
 */
export async function listEvaluableRequirements(
  orgId: string,
  tenderId: string,
  db: Db = prisma,
): Promise<EvaluableRequirement[]> {
  const rows = await db.requirement.findMany({
    where: { orgId, tenderId },
    select: { id: true, kind: true, obligation: true, summary: true, constraintJson: true },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind as EvaluableRequirement["kind"],
    obligation: row.obligation as EvaluableRequirement["obligation"],
    summary: row.summary,
    // Stored in the `contracts.ts` shape, which is what the evaluator reads.
    constraint: row.constraintJson as EvaluableRequirement["constraint"],
  }));
}

/** "N requirements found" per document, for the Documents tab (§10.2). */
export async function countRequirementsByDocument(
  orgId: string,
  tenderId: string,
  db: Db = prisma,
): Promise<Record<string, number>> {
  const grouped = await db.requirement.groupBy({
    by: ["documentId"],
    where: { orgId, tenderId },
    _count: { _all: true },
  });
  const counts: Record<string, number> = {};
  for (const row of grouped) counts[row.documentId] = row._count._all;
  return counts;
}
