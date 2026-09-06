"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getOrgContext } from "@/lib/auth/session";
import { createTender, updateTenderStatus } from "@/lib/db/tenders";
import { TENDER_SOURCES, type TenderStatus } from "@/lib/types";
import { errorMessage, fail, fieldErrorsFrom, ok, optDate, optNum, optStr, str, type ActionState } from "./shared";

const newTenderSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Give the tender a title. The buyer and the service is usually enough.")
    .max(160, "Keep the title under 160 characters."),
  buyerName: z.string().trim().max(120).nullable(),
  source: z.enum(TENDER_SOURCES).nullable(),
  noticeReference: z.string().trim().max(80).nullable(),
  sourceUrl: z.string().trim().url("Enter a full link, starting with https://").nullable(),
  contractValue: z.number().nonnegative("Contract value can't be negative.").nullable(),
  currency: z.string().trim().length(3, "Use a three-letter currency code such as GBP.").nullable(),
  durationMonths: z.number().int().positive("Duration is a whole number of months.").nullable(),
  lotReference: z.string().trim().max(40).nullable(),
  submissionDeadline: z.date().nullable(),
  clarificationDeadline: z.date().nullable(),
});

export async function createTenderAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { orgId, userId } = await getOrgContext();
  const contractValue = optNum(formData, "contractValue");
  const durationMonths = optNum(formData, "durationMonths");
  if (Number.isNaN(contractValue)) {
    return fail("Check the contract value.", { contractValue: "Enter a number, such as 2400000." });
  }
  if (Number.isNaN(durationMonths)) {
    return fail("Check the duration.", { durationMonths: "Enter a whole number of months." });
  }

  const parsed = newTenderSchema.safeParse({
    title: str(formData, "title"),
    buyerName: optStr(formData, "buyerName"),
    source: optStr(formData, "source"),
    noticeReference: optStr(formData, "noticeReference"),
    sourceUrl: optStr(formData, "sourceUrl"),
    contractValue,
    currency: optStr(formData, "currency")?.toUpperCase() ?? "GBP",
    durationMonths,
    lotReference: optStr(formData, "lotReference"),
    submissionDeadline: optDate(formData, "submissionDeadline"),
    clarificationDeadline: optDate(formData, "clarificationDeadline"),
  });
  if (!parsed.success) return fail("Check the highlighted fields.", fieldErrorsFrom(parsed.error));
  const { submissionDeadline, clarificationDeadline } = parsed.data;
  if (submissionDeadline && clarificationDeadline && clarificationDeadline > submissionDeadline) {
    return fail("Check the dates.", {
      clarificationDeadline: "The clarification deadline is normally before the submission deadline.",
    });
  }

  let tenderId: string;
  try {
    const tender = await createTender(orgId, userId, parsed.data);
    tenderId = tender.id;
  } catch (error) {
    return fail(errorMessage(error, "The tender could not be created. Try again."));
  }
  revalidatePath("/");
  redirect(`/tenders/${tenderId}?tab=documents`);
}

const ALLOWED: TenderStatus[] = ["bidding", "assessed", "submitted", "abandoned", "won", "lost"];

const STATUS_MESSAGE: Partial<Record<TenderStatus, string>> = {
  bidding: "Marked as a bid. The workspace is open.",
  assessed: "Moved back to assessed.",
  submitted: "Marked as submitted.",
  abandoned: "Marked as abandoned.",
  won: "Marked as won.",
  lost: "Marked as lost.",
};

export async function setTenderStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const tenderId = str(formData, "tenderId");
  const status = str(formData, "status") as TenderStatus;
  if (!tenderId || !ALLOWED.includes(status)) return fail("That status change isn't available.");
  const { orgId, userId } = await getOrgContext();
  try {
    await updateTenderStatus(orgId, userId, tenderId, status);
  } catch (error) {
    return fail(errorMessage(error, "The status could not be changed."));
  }
  revalidatePath(`/tenders/${tenderId}`);
  revalidatePath("/");
  return ok(STATUS_MESSAGE[status] ?? "Status updated.");
}
