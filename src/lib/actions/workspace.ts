"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getOrgContext } from "@/lib/auth/session";
import { getLibraryAnswer, markLibraryAnswerUsed, suggestLibraryAnswers, type Suggestion } from "@/lib/db/library";
import { createTask, saveResponse, updateTask } from "@/lib/db/workspace";
import { TASK_STATUSES } from "@/lib/types";
import { errorMessage, fail, fieldErrorsFrom, ok, optDate, optStr, str, type ActionState } from "./shared";

const taskPatchSchema = z.object({
  taskId: z.string().min(1),
  tenderId: z.string().min(1),
  assigneeId: z.string().nullable(),
  status: z.enum(TASK_STATUSES),
  dueOn: z.date().nullable(),
});

export async function updateTaskAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { orgId, userId } = await getOrgContext();
  const parsed = taskPatchSchema.safeParse({
    taskId: str(formData, "taskId"),
    tenderId: str(formData, "tenderId"),
    assigneeId: optStr(formData, "assigneeId"),
    status: str(formData, "status"),
    dueOn: optDate(formData, "dueOn"),
  });
  if (!parsed.success) return fail("Check the task details.", fieldErrorsFrom(parsed.error));
  try {
    await updateTask(orgId, userId, parsed.data.taskId, {
      assigneeId: parsed.data.assigneeId,
      status: parsed.data.status,
      dueOn: parsed.data.dueOn,
    });
  } catch (error) {
    return fail(errorMessage(error, "The task could not be updated."));
  }
  revalidatePath(`/tenders/${parsed.data.tenderId}`);
  return ok("Task updated.");
}

export async function createTaskAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { orgId, userId } = await getOrgContext();
  const tenderId = str(formData, "tenderId");
  const title = str(formData, "title");
  if (!tenderId) return fail("No tender was given.");
  if (title.length < 2) return fail("Give the task a title.", { title: "Give the task a title." });
  try {
    await createTask(orgId, userId, tenderId, {
      title,
      requirementId: optStr(formData, "requirementId"),
      assigneeId: optStr(formData, "assigneeId"),
      dueOn: optDate(formData, "dueOn"),
    });
  } catch (error) {
    return fail(errorMessage(error, "The task could not be created."));
  }
  revalidatePath(`/tenders/${tenderId}`);
  return ok("Task added.");
}

export async function saveResponseAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { orgId, userId } = await getOrgContext();
  const requirementId = str(formData, "requirementId");
  const tenderId = str(formData, "tenderId");
  const body = typeof formData.get("body") === "string" ? (formData.get("body") as string) : "";
  if (!requirementId) return fail("No question was given to save against.");
  try {
    await saveResponse(orgId, userId, requirementId, body, optStr(formData, "sourceAnswerId") ?? undefined);
  } catch (error) {
    return fail(errorMessage(error, "The draft could not be saved."));
  }
  revalidatePath(`/tenders/${tenderId}`);
  return ok("Draft saved.");
}

/** Called from the workspace's Suggest from library control. */
export async function suggestFromLibraryAction(query: string): Promise<Suggestion[]> {
  const { orgId } = await getOrgContext();
  return suggestLibraryAnswers(orgId, query, 3);
}

/** Records the reuse and returns the answer body so the editor can insert it. */
export async function applyLibraryAnswerAction(
  answerId: string,
  requirementId: string,
  tenderId: string,
): Promise<{ ok: true; body: string; title: string } | { ok: false; error: string }> {
  const { orgId, userId } = await getOrgContext();
  const answer = await getLibraryAnswer(orgId, answerId);
  if (!answer) return { ok: false, error: "That library answer no longer exists." };
  await markLibraryAnswerUsed(orgId, userId, answerId, requirementId);
  revalidatePath(`/tenders/${tenderId}`);
  revalidatePath("/library");
  return { ok: true, body: answer.body, title: answer.title };
}
