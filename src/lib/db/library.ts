/**
 * The answer library (§7.7, §10.4) and its retrieval.
 *
 * v1 retrieval is `ILIKE` over title and body plus tag overlap, ranked by
 * matched-term count then `timesUsed`, top `LIBRARY_SUGGESTION_LIMIT`. No
 * tsvector index, no embeddings — spec §4 cuts the vector store explicitly, and
 * at six seeded answers this is indistinguishable from anything cleverer.
 *
 * The rule is written once, as SQL: one lateral join collects the terms each
 * answer matched, and the same array both filters and orders the result. The
 * matched terms the UI shows are the ones that did the ranking, not a second
 * opinion computed in TypeScript.
 */

import { LIBRARY_SUGGESTION_LIMIT } from "../../../contracts";
import { Prisma } from "@prisma/client";
import { searchTerms } from "@/lib/text";
import type { LibraryAnswer, LibraryAnswerWithSource } from "@/lib/types";
import { prisma } from "./client";
import { appendEvent } from "./events";

interface LibraryAnswerRow {
  id: string;
  orgId: string;
  title: string;
  body: string;
  tags: string[];
  sourceTenderId: string | null;
  timesUsed: number;
  createdAt: Date;
}

function toLibraryAnswer(row: LibraryAnswerRow): LibraryAnswer {
  return {
    id: row.id,
    orgId: row.orgId,
    title: row.title,
    body: row.body,
    tags: row.tags,
    sourceTenderId: row.sourceTenderId,
    timesUsed: row.timesUsed,
    createdAt: row.createdAt,
  };
}

export async function listLibraryAnswers(orgId: string): Promise<LibraryAnswerWithSource[]> {
  const rows = await prisma.libraryAnswer.findMany({
    where: { orgId },
    include: { sourceTender: { select: { id: true, title: true } } },
    orderBy: [{ timesUsed: "desc" }, { title: "asc" }],
  });
  return rows.map((row) => ({
    ...toLibraryAnswer(row),
    sourceTender: row.sourceTender ?? null,
  }));
}

export async function getLibraryAnswer(orgId: string, id: string): Promise<LibraryAnswer | null> {
  const row = await prisma.libraryAnswer.findFirst({ where: { id, orgId } });
  return row ? toLibraryAnswer(row) : null;
}

export interface Suggestion {
  answer: LibraryAnswer;
  matchedTerms: string[];
}

/**
 * "Suggest from library" (§10.2). Returns nothing rather than something
 * irrelevant: an answer must match at least one term to appear at all.
 */
export async function suggestLibraryAnswers(
  orgId: string,
  query: string,
  limit: number = LIBRARY_SUGGESTION_LIMIT,
): Promise<Suggestion[]> {
  const terms = searchTerms(query);
  if (terms.length === 0) return [];

  const termValues = Prisma.join(terms.map((term) => Prisma.sql`${term}`));
  const rows = await prisma.$queryRaw<Array<LibraryAnswerRow & { matchedTerms: string[] }>>`
    select
      a.id,
      a.org_id            as "orgId",
      a.title,
      a.body,
      a.tags,
      a.source_tender_id  as "sourceTenderId",
      a.times_used        as "timesUsed",
      a.created_at        as "createdAt",
      m.matched           as "matchedTerms"
    from library_answers a
    cross join lateral (
      select coalesce(array_agg(t), '{}'::text[]) as matched
      from unnest(array[${termValues}]::text[]) as t
      where a.title ilike '%' || t || '%'
         or a.body  ilike '%' || t || '%'
         or array_to_string(a.tags, ' ') ilike '%' || t || '%'
    ) m
    where a.org_id = ${orgId}::uuid
      and cardinality(m.matched) > 0
    order by cardinality(m.matched) desc, a.times_used desc, a.title asc
    limit ${limit}
  `;

  return rows.map((row) => ({
    answer: toLibraryAnswer(row),
    matchedTerms: row.matchedTerms,
  }));
}

/* ---------------------------------------------------------------------------
 * Writes
 * ------------------------------------------------------------------------- */

export type LibraryAnswerInput = Pick<
  LibraryAnswer,
  "title" | "body" | "tags" | "sourceTenderId"
>;

export async function createLibraryAnswer(
  orgId: string,
  userId: string,
  input: LibraryAnswerInput,
): Promise<LibraryAnswer> {
  return prisma.$transaction(async (tx) => {
    if (input.sourceTenderId) {
      const tender = await tx.tender.findFirst({
        where: { id: input.sourceTenderId, orgId },
        select: { id: true },
      });
      if (!tender) throw new Error("Tender not found");
    }
    const row = await tx.libraryAnswer.create({ data: { orgId, ...input, timesUsed: 0 } });
    await appendEvent(tx, {
      orgId,
      actorId: userId,
      actorKind: "user",
      action: "library.updated",
      subjectTable: "library_answers",
      subjectId: row.id,
      payload: { section: "library", change: "added", label: row.title },
    });
    return toLibraryAnswer(row);
  });
}

export async function updateLibraryAnswer(
  orgId: string,
  userId: string,
  id: string,
  input: LibraryAnswerInput,
): Promise<LibraryAnswer> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.libraryAnswer.findFirst({ where: { id, orgId } });
    if (!existing) throw new Error("Answer not found");
    const row = await tx.libraryAnswer.update({ where: { id }, data: input });
    await appendEvent(tx, {
      orgId,
      actorId: userId,
      actorKind: "user",
      action: "library.updated",
      subjectTable: "library_answers",
      subjectId: row.id,
      payload: { section: "library", change: "updated", label: row.title },
    });
    return toLibraryAnswer(row);
  });
}

export async function deleteLibraryAnswer(orgId: string, userId: string, id: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.libraryAnswer.findFirst({ where: { id, orgId } });
    if (!existing) return;
    await tx.libraryAnswer.delete({ where: { id } });
    await appendEvent(tx, {
      orgId,
      actorId: userId,
      actorKind: "user",
      action: "library.updated",
      subjectTable: "library_answers",
      subjectId: id,
      payload: { section: "library", change: "removed", label: existing.title },
    });
  });
}

/**
 * Increments `timesUsed` and records which question the answer seeded — the
 * count that makes the library compound, and the reason the ranking prefers an
 * answer that has already earned its place.
 */
export async function markLibraryAnswerUsed(
  orgId: string,
  userId: string,
  answerId: string,
  requirementId: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const answer = await tx.libraryAnswer.findFirst({ where: { id: answerId, orgId } });
    if (!answer) return;
    const requirement = await tx.requirement.findFirst({
      where: { id: requirementId, orgId },
      select: { id: true, tenderId: true, summary: true, questionRef: true },
    });
    if (!requirement) throw new Error("Requirement not found");

    await tx.libraryAnswer.update({
      where: { id: answerId },
      data: { timesUsed: { increment: 1 } },
    });
    await appendEvent(tx, {
      orgId,
      actorId: userId,
      actorKind: "user",
      action: "library.answer_used",
      subjectTable: "responses",
      subjectId: requirement.id,
      payload: {
        tenderId: requirement.tenderId,
        questionRef: requirement.questionRef ?? requirement.summary,
        answerId,
        answerTitle: answer.title,
      },
    });
  });
}
