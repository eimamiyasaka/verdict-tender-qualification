/**
 * Drafted responses (§7.7). One row per ITT question, created on first save.
 *
 * **Word count is not stored.** Spec §7.7 names the generated column that used
 * to compute it as the old schema's only real bug — `regexp_split_to_array('',
 * '\s+')` yields `{''}`, so every empty draft claimed one word. `countWords` in
 * `src/lib/text.ts` is the one definition, it returns 0 for the empty string,
 * and the number that goes on the event comes from it.
 */

import { countWords } from "@/lib/text";
import type { Response } from "@/lib/types";
import { prisma, type Db } from "./client";
import { appendEvent } from "./events";

interface ResponseRow {
  id: string;
  requirementId: string;
  orgId: string;
  body: string;
  sourceAnswerId: string | null;
  updatedById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toResponse(row: ResponseRow): Response {
  return {
    id: row.id,
    requirementId: row.requirementId,
    orgId: row.orgId,
    body: row.body,
    sourceAnswerId: row.sourceAnswerId,
    updatedById: row.updatedById,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function getResponse(
  orgId: string,
  requirementId: string,
  db: Db = prisma,
): Promise<Response | null> {
  const row = await db.response.findFirst({ where: { requirementId, orgId } });
  return row ? toResponse(row) : null;
}

export async function listResponses(orgId: string, tenderId: string): Promise<Response[]> {
  const rows = await prisma.response.findMany({
    where: { orgId, requirement: { tenderId } },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map(toResponse);
}

/**
 * Creates or updates the draft for one question, and moves its task off
 * `not_started` the first time real text arrives — one state change, one event,
 * one transaction.
 *
 * Nothing is blocked when the draft is over its word limit: bid managers
 * overwrite and then cut, so the count turns `--flag` and the save still lands
 * (§14).
 */
export async function saveResponse(
  orgId: string,
  userId: string,
  requirementId: string,
  body: string,
  sourceAnswerId?: string | null,
): Promise<Response> {
  return prisma.$transaction(async (tx) => {
    const requirement = await tx.requirement.findFirst({
      where: { id: requirementId, orgId },
      select: { id: true, tenderId: true, summary: true, questionRef: true, wordLimit: true },
    });
    if (!requirement) throw new Error("Requirement not found");

    const row = await tx.response.upsert({
      where: { requirementId },
      create: {
        requirementId,
        orgId,
        body,
        sourceAnswerId: sourceAnswerId ?? null,
        updatedById: userId,
      },
      update: {
        body,
        ...(sourceAnswerId !== undefined ? { sourceAnswerId } : {}),
        updatedById: userId,
      },
    });

    if (body.trim().length > 0) {
      await tx.bidTask.updateMany({
        where: { orgId, requirementId, status: "not_started" },
        data: { status: "in_progress" },
      });
    }

    await appendEvent(tx, {
      orgId,
      actorId: userId,
      actorKind: "user",
      action: "response.updated",
      subjectTable: "responses",
      subjectId: row.id,
      payload: {
        tenderId: requirement.tenderId,
        requirementId,
        requirementSummary: requirement.summary,
        questionRef: requirement.questionRef ?? requirement.summary,
        wordCount: countWords(body),
        wordLimit: requirement.wordLimit,
      },
    });
    return toResponse(row);
  });
}
