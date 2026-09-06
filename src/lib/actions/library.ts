"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getOrgContext } from "@/lib/auth/session";
import { createLibraryAnswer, deleteLibraryAnswer, updateLibraryAnswer } from "@/lib/db/library";
import { errorMessage, fail, fieldErrorsFrom, ok, optStr, str, type ActionState } from "./shared";

const answerSchema = z.object({
  title: z.string().trim().min(3, "Give the answer a title you'd search for.").max(140),
  body: z.string().trim().min(20, "Paste the answer text. Twenty characters is the minimum."),
  tags: z.array(z.string().trim().toLowerCase().max(40)).max(12, "Twelve tags is plenty."),
  sourceTenderId: z.string().nullable(),
});

export async function saveLibraryAnswerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { orgId, userId } = await getOrgContext();
  const parsed = answerSchema.safeParse({
    title: str(formData, "title"),
    body: typeof formData.get("body") === "string" ? (formData.get("body") as string) : "",
    tags: str(formData, "tags")
      .split(/[,\n]+/)
      .map((t) => t.trim().replace(/\s+/g, "-"))
      .filter(Boolean),
    sourceTenderId: optStr(formData, "sourceTenderId"),
  });
  if (!parsed.success) return fail("Check the highlighted fields.", fieldErrorsFrom(parsed.error));
  const id = optStr(formData, "id");
  try {
    if (id) await updateLibraryAnswer(orgId, userId, id, parsed.data);
    else await createLibraryAnswer(orgId, userId, parsed.data);
  } catch (error) {
    return fail(errorMessage(error, "The answer could not be saved."));
  }
  revalidatePath("/library");
  return ok(id ? "Answer updated." : "Answer added to the library.");
}

export async function deleteLibraryAnswerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { orgId, userId } = await getOrgContext();
  await deleteLibraryAnswer(orgId, userId, str(formData, "id"));
  revalidatePath("/library");
  return ok("Answer removed.");
}
