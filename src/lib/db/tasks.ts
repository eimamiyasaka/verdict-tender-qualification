/**
 * The bid workspace's tasks (§7.7, §10.2). One task per ITT question, with an
 * assignee, a status and a due date; the Workspace tab renders them only when
 * the tender is `bidding`.
 *
 * Word counts are computed in TypeScript by `countWords` (§7.7) and never
 * stored, so nothing here maintains a denormalised count that could drift from
 * the body it describes.
 */

import type { BidTask, Response, TaskStatus, WorkspaceTask } from "@/lib/types";
import { prisma, type Db } from "./client";
import { appendEvent } from "./events";
import { toUser } from "./org";
import { requirementSources, toRequirementWithSources } from "./requirements";
import { toResponse } from "./responses";

interface BidTaskRow {
  id: string;
  tenderId: string;
  orgId: string;
  requirementId: string | null;
  title: string;
  assigneeId: string | null;
  status: string;
  dueOn: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toBidTask(row: BidTaskRow): BidTask {
  return {
    id: row.id,
    tenderId: row.tenderId,
    orgId: row.orgId,
    requirementId: row.requirementId,
    title: row.title,
    assigneeId: row.assigneeId,
    status: row.status as TaskStatus,
    dueOn: row.dueOn,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Every task for a tender with the question it answers, the draft against it and
 * the person it belongs to. One query with three includes — the workspace is a
 * page of cards, not a list that then fetches each card.
 *
 * Ordered by question reference so "Method Statement 2" follows "Method
 * Statement 1" rather than sorting lexically after "Method Statement 10".
 */
export async function listWorkspaceTasks(
  orgId: string,
  tenderId: string,
  db: Db = prisma,
): Promise<WorkspaceTask[]> {
  const rows = await db.bidTask.findMany({
    where: { orgId, tenderId },
    include: {
      assignee: true,
      requirement: { include: { ...requirementSources, response: true } },
    },
  });

  return rows
    .map((row) => {
      const requirement = row.requirement
        ? toRequirementWithSources(row.requirement as never)
        : null;
      const response: Response | null =
        row.requirement && row.requirement.response ? toResponse(row.requirement.response) : null;
      return {
        ...toBidTask(row),
        requirement,
        response,
        assignee: row.assignee ? toUser(row.assignee) : null,
      };
    })
    .sort((a, b) => {
      const refA = a.requirement?.questionRef ?? a.title;
      const refB = b.requirement?.questionRef ?? b.title;
      return refA.localeCompare(refB, undefined, { numeric: true });
    });
}

export async function getTask(orgId: string, taskId: string): Promise<BidTask | null> {
  const row = await prisma.bidTask.findFirst({ where: { id: taskId, orgId } });
  return row ? toBidTask(row) : null;
}

/* ---------------------------------------------------------------------------
 * Writes
 * ------------------------------------------------------------------------- */

export interface NewTaskInput {
  title: string;
  requirementId: string | null;
  assigneeId: string | null;
  dueOn: Date | null;
}

export async function createTask(
  orgId: string,
  userId: string,
  tenderId: string,
  input: NewTaskInput,
): Promise<BidTask> {
  return prisma.$transaction(async (tx) => {
    const tender = await tx.tender.findFirst({ where: { id: tenderId, orgId }, select: { id: true } });
    if (!tender) throw new Error("Tender not found");
    if (input.requirementId) {
      const requirement = await tx.requirement.findFirst({
        where: { id: input.requirementId, orgId, tenderId },
        select: { id: true },
      });
      // A requirement id arriving from a form is not taken on trust (§6.3).
      if (!requirement) throw new Error("Requirement not found");
    }

    const task = await tx.bidTask.create({
      data: {
        tenderId,
        orgId,
        requirementId: input.requirementId,
        title: input.title,
        assigneeId: input.assigneeId,
        status: "not_started",
        dueOn: input.dueOn,
      },
    });
    await appendEvent(tx, {
      orgId,
      actorId: userId,
      actorKind: "user",
      action: "task.created",
      subjectTable: "bid_tasks",
      subjectId: task.id,
      payload: { tenderId, title: task.title, change: "created" },
    });
    return toBidTask(task);
  });
}

export interface TaskPatch {
  assigneeId?: string | null;
  status?: TaskStatus;
  dueOn?: Date | null;
  title?: string;
}

export async function updateTask(
  orgId: string,
  userId: string,
  taskId: string,
  patch: TaskPatch,
): Promise<BidTask> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.bidTask.findFirst({ where: { id: taskId, orgId } });
    if (!existing) throw new Error("Task not found");

    const task = await tx.bidTask.update({
      where: { id: taskId },
      data: {
        ...(patch.assigneeId !== undefined ? { assigneeId: patch.assigneeId } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.dueOn !== undefined ? { dueOn: patch.dueOn } : {}),
        ...(patch.title !== undefined ? { title: patch.title } : {}),
      },
    });

    await appendEvent(tx, {
      orgId,
      actorId: userId,
      actorKind: "user",
      action: "task.updated",
      subjectTable: "bid_tasks",
      subjectId: task.id,
      payload: {
        tenderId: task.tenderId,
        title: task.title,
        from: {
          assigneeId: existing.assigneeId,
          status: existing.status,
          dueOn: existing.dueOn?.toISOString() ?? null,
        },
        to: {
          assigneeId: task.assigneeId,
          status: task.status,
          dueOn: task.dueOn?.toISOString() ?? null,
        },
      },
    });
    return toBidTask(task);
  });
}
