"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getOrgContext } from "@/lib/auth/session";
import {
  addDocument,
  deleteDocument,
  markExtractionRunning,
  recordExtractionOutcome,
  type ExtractionFailure,
  type ExtractionSuccess,
} from "@/lib/db/documents";
import { DOCUMENT_TYPES, type RequirementDraft } from "@/lib/types";
import { errorMessage, fail, ok, str, type ActionState } from "./shared";

/**
 * The browser side of the extraction pipeline (§8) calls these three in
 * order for each file: register → running → outcome. The file itself never
 * reaches the server (§6.4); only its name, page count and the drafts the
 * extraction route returned.
 */

const registerSchema = z.object({
  tenderId: z.string().min(1),
  filename: z.string().trim().min(1).max(200),
  docType: z.enum(DOCUMENT_TYPES),
  pageCount: z.number().int().positive().nullable(),
});

export async function registerDocumentAction(input: {
  tenderId: string;
  filename: string;
  docType: string;
  pageCount: number | null;
}): Promise<{ ok: true; documentId: string } | { ok: false; error: string }> {
  const { orgId, userId } = await getOrgContext();
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "The document details were not understood. Check the type tag and try again." };
  try {
    const doc = await addDocument(orgId, userId, parsed.data.tenderId, parsed.data);
    revalidatePath(`/tenders/${parsed.data.tenderId}`);
    return { ok: true, documentId: doc.id };
  } catch (error) {
    return { ok: false, error: errorMessage(error, "The document could not be added to the tender.") };
  }
}

export async function markExtractionRunningAction(documentId: string): Promise<void> {
  const { orgId } = await getOrgContext();
  await markExtractionRunning(orgId, documentId);
}

export async function recordExtractionAction(input: {
  tenderId: string;
  documentId: string;
  outcome:
    | { status: "failed"; error: string; pageCount: number | null }
    | {
        status: "complete";
        pageCount: number | null;
        model: string;
        chunkCount: number;
        failedChunks: number;
        drafts: RequirementDraft[];
      };
}): Promise<{ ok: true; requirementsFound: number; citationsAdded: number; heldForReview: number } | { ok: false; error: string }> {
  const { orgId, userId } = await getOrgContext();
  try {
    const outcome: ExtractionFailure | ExtractionSuccess = input.outcome;
    const result = await recordExtractionOutcome(orgId, userId, input.documentId, outcome);
    revalidatePath(`/tenders/${input.tenderId}`);
    revalidatePath("/");
    return {
      ok: true,
      requirementsFound: result.persisted?.created ?? 0,
      citationsAdded: result.persisted?.citationsAdded ?? 0,
      heldForReview: result.persisted?.heldForReview ?? 0,
    };
  } catch (error) {
    return { ok: false, error: errorMessage(error, "The extraction result could not be recorded.") };
  }
}

export async function deleteDocumentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { orgId, userId } = await getOrgContext();
  const tenderId = str(formData, "tenderId");
  const documentId = str(formData, "documentId");
  if (!tenderId || !documentId) return fail("No document was given to remove.");
  try {
    await deleteDocument(orgId, userId, documentId);
  } catch (error) {
    return fail(errorMessage(error, "The document could not be removed."));
  }
  revalidatePath(`/tenders/${tenderId}`);
  revalidatePath("/");
  return ok("Document removed, along with the requirements cited from it.");
}
