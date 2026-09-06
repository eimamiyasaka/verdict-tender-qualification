/**
 * Bid workspace (§7.7, §10.2): tasks per ITT question, assignment, drafted
 * responses. Word counts are computed in TypeScript (src/lib/text.ts), never
 * stored.
 */
import type { BidTask, Response, TaskStatus, WorkspaceTask } from "@/lib/types";
import { appendEvent, clone, getStore, newId } from "./_placeholder/store";

export async function listWorkspaceTasks(orgId: string, tenderId: string): Promise<WorkspaceTask[]> {
  const store = getStore();
  const docById = new Map(store.documents.map((d) => [d.id, d]));
  return store.tasks
    .filter((t) => t.orgId === orgId && t.tenderId === tenderId)
    .map((task) => {
      const requirement = task.requirementId ? store.requirements.find((r) => r.id === task.requirementId) : null;
      const response = task.requirementId ? store.responses.find((r) => r.requirementId === task.requirementId) : null;
      const assignee = task.assigneeId ? store.users.find((u) => u.id === task.assigneeId) : null;
      return {
        ...clone(task),
        requirement: requirement
          ? {
              ...clone(requirement),
              document: clone(docById.get(requirement.documentId)!),
              citations: store.citations
                .filter((c) => c.requirementId === requirement.id)
                .map((c) => ({ ...clone(c), document: clone(docById.get(c.documentId)!) })),
            }
          : null,
        response: response ? clone(response) : null,
        assignee: assignee ? clone(assignee) : null,
      };
    })
    .sort((a, b) => {
      const refA = a.requirement?.questionRef ?? a.title;
      const refB = b.requirement?.questionRef ?? b.title;
      return refA.localeCompare(refB, undefined, { numeric: true });
    });
}

export interface TaskPatch {
  assigneeId?: string | null;
  status?: TaskStatus;
  dueOn?: Date | null;
  title?: string;
}

export async function updateTask(orgId: string, userId: string, taskId: string, patch: TaskPatch): Promise<BidTask> {
  const store = getStore();
  const task = store.tasks.find((t) => t.id === taskId && t.orgId === orgId);
  if (!task) throw new Error("Task not found");
  const before = { assigneeId: task.assigneeId, status: task.status, dueOn: task.dueOn };
  if (patch.assigneeId !== undefined) task.assigneeId = patch.assigneeId;
  if (patch.status !== undefined) task.status = patch.status;
  if (patch.dueOn !== undefined) task.dueOn = patch.dueOn;
  if (patch.title !== undefined) task.title = patch.title;
  task.updatedAt = new Date();
  appendEvent(store, {
    orgId,
    actorId: userId,
    actorKind: "user",
    action: "task.updated",
    subjectTable: "bid_tasks",
    subjectId: task.id,
    payload: {
      tenderId: task.tenderId,
      title: task.title,
      from: { ...before, dueOn: before.dueOn?.toISOString() ?? null },
      to: { assigneeId: task.assigneeId, status: task.status, dueOn: task.dueOn?.toISOString() ?? null },
    },
  });
  return clone(task);
}

export async function createTask(
  orgId: string,
  userId: string,
  tenderId: string,
  input: { title: string; requirementId: string | null; assigneeId: string | null; dueOn: Date | null },
): Promise<BidTask> {
  const store = getStore();
  const now = new Date();
  const task: BidTask = {
    id: newId(),
    tenderId,
    orgId,
    requirementId: input.requirementId,
    title: input.title,
    assigneeId: input.assigneeId,
    status: "not_started",
    dueOn: input.dueOn,
    createdAt: now,
    updatedAt: now,
  };
  store.tasks.push(task);
  appendEvent(store, {
    orgId,
    actorId: userId,
    actorKind: "user",
    action: "task.updated",
    subjectTable: "bid_tasks",
    subjectId: task.id,
    payload: { tenderId, title: task.title, change: "created" },
  });
  return clone(task);
}

export async function saveResponse(
  orgId: string,
  userId: string,
  requirementId: string,
  body: string,
  sourceAnswerId: string | null | undefined,
): Promise<Response> {
  const store = getStore();
  const requirement = store.requirements.find((r) => r.id === requirementId && r.orgId === orgId);
  if (!requirement) throw new Error("Requirement not found");
  const now = new Date();
  let response = store.responses.find((r) => r.requirementId === requirementId);
  if (!response) {
    response = {
      id: newId(),
      requirementId,
      orgId,
      body,
      sourceAnswerId: sourceAnswerId ?? null,
      updatedById: userId,
      createdAt: now,
      updatedAt: now,
    };
    store.responses.push(response);
  } else {
    response.body = body;
    if (sourceAnswerId !== undefined) response.sourceAnswerId = sourceAnswerId;
    response.updatedById = userId;
    response.updatedAt = now;
  }
  const task = store.tasks.find((t) => t.requirementId === requirementId);
  if (task && task.status === "not_started" && body.trim().length > 0) {
    task.status = "in_progress";
    task.updatedAt = now;
  }
  appendEvent(store, {
    orgId,
    actorId: userId,
    actorKind: "user",
    action: "response.saved",
    subjectTable: "responses",
    subjectId: requirementId,
    payload: {
      tenderId: requirement.tenderId,
      questionRef: requirement.questionRef ?? requirement.summary,
      words: body.trim() === "" ? 0 : body.trim().split(/\s+/).length,
    },
  });
  return clone(response);
}
