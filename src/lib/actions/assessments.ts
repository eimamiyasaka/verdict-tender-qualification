"use server";

import { revalidatePath } from "next/cache";
import { getOrgContext } from "@/lib/auth/session";
import { runAssessment } from "@/lib/db/assessments";
import { errorMessage, fail, ok, str, type ActionState } from "./shared";

export async function runAssessmentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const tenderId = str(formData, "tenderId");
  if (!tenderId) return fail("No tender was given to assess.");
  const { orgId, userId } = await getOrgContext();
  try {
    const assessment = await runAssessment(orgId, userId, tenderId);
    revalidatePath(`/tenders/${tenderId}`);
    revalidatePath("/");
    revalidatePath("/profile");
    return ok(`Assessment complete — version ${assessment.version}.`);
  } catch (error) {
    return fail(errorMessage(error, "The assessment could not be run. Try again in a moment."));
  }
}
