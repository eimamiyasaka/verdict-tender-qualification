"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getOrgContext } from "@/lib/auth/session";
import {
  deleteCredential,
  deleteFinancialYear,
  deleteInsurance,
  deletePastProject,
  deletePolicy,
  updateOrganisation,
  upsertCredential,
  upsertFinancialYear,
  upsertInsurance,
  upsertPastProject,
  upsertPolicy,
} from "@/lib/db/profile";
import { INSURANCE_TYPES } from "@/lib/types";
import { bool, errorMessage, fail, fieldErrorsFrom, ok, optDate, optNum, optStr, str, type ActionState } from "./shared";

function revalidateProfile() {
  // Profile changes alter what every tender's next assessment would say (§14),
  // so the tender pages and pipeline are revalidated along with the profile.
  revalidatePath("/profile");
  revalidatePath("/");
  revalidatePath("/tenders/[id]", "page");
}

const currencySchema = z.string().trim().length(3, "Use a three-letter code such as GBP.").transform((s) => s.toUpperCase());

// ---------------------------------------------------------------------------
// Organisation
// ---------------------------------------------------------------------------

const organisationSchema = z.object({
  name: z.string().trim().min(2, "Enter the organisation's registered name.").max(120),
  companiesHouseNumber: z.string().trim().max(12).nullable(),
  headcount: z.number().int().nonnegative("Headcount is a whole number.").nullable(),
  registeredRegion: z.string().trim().max(40).nullable(),
  sicCodes: z.array(z.string().trim().regex(/^\d{4,5}$/, "SIC codes are four or five digits.")),
});

export async function saveOrganisationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { orgId, userId } = await getOrgContext();
  const headcount = optNum(formData, "headcount");
  if (Number.isNaN(headcount)) return fail("Check the headcount.", { headcount: "Enter a whole number." });
  const parsed = organisationSchema.safeParse({
    name: str(formData, "name"),
    companiesHouseNumber: optStr(formData, "companiesHouseNumber"),
    headcount,
    registeredRegion: optStr(formData, "registeredRegion"),
    sicCodes: str(formData, "sicCodes")
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean),
  });
  if (!parsed.success) return fail("Check the highlighted fields.", fieldErrorsFrom(parsed.error));
  try {
    await updateOrganisation(orgId, userId, parsed.data);
  } catch (error) {
    return fail(errorMessage(error, "The organisation details could not be saved."));
  }
  revalidateProfile();
  return ok("Organisation details saved.");
}

// ---------------------------------------------------------------------------
// Credentials
// ---------------------------------------------------------------------------

const credentialSchema = z.object({
  code: z.string().trim().min(1, "Choose a certification."),
  reference: z.string().trim().max(60).nullable(),
  issuedOn: z.date().nullable(),
  expiresOn: z.date().nullable(),
  evidenceUrl: z.string().trim().url("Enter a full link, starting with https://").nullable(),
});

export async function saveCredentialAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { orgId, userId } = await getOrgContext();
  const parsed = credentialSchema.safeParse({
    code: str(formData, "code"),
    reference: optStr(formData, "reference"),
    issuedOn: optDate(formData, "issuedOn"),
    expiresOn: optDate(formData, "expiresOn"),
    evidenceUrl: optStr(formData, "evidenceUrl"),
  });
  if (!parsed.success) return fail("Check the highlighted fields.", fieldErrorsFrom(parsed.error));
  if (parsed.data.issuedOn && parsed.data.expiresOn && parsed.data.expiresOn < parsed.data.issuedOn) {
    return fail("Check the dates.", { expiresOn: "Expiry is before the issue date." });
  }
  try {
    await upsertCredential(orgId, userId, parsed.data, optStr(formData, "id") ?? undefined);
  } catch (error) {
    return fail(errorMessage(error, "The certification could not be saved."));
  }
  revalidateProfile();
  return ok("Certification saved.");
}

export async function deleteCredentialAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { orgId, userId } = await getOrgContext();
  await deleteCredential(orgId, userId, str(formData, "id"));
  revalidateProfile();
  return ok("Certification removed.");
}

// ---------------------------------------------------------------------------
// Financial years
// ---------------------------------------------------------------------------

const financialYearSchema = z.object({
  yearEnding: z.date({ error: "Enter the year-end date." }),
  turnover: z.number().nonnegative().nullable(),
  netAssets: z.number().nullable(),
  profitBeforeTax: z.number().nullable(),
  currency: currencySchema,
});

export async function saveFinancialYearAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { orgId, userId } = await getOrgContext();
  const numbers = {
    turnover: optNum(formData, "turnover"),
    netAssets: optNum(formData, "netAssets"),
    profitBeforeTax: optNum(formData, "profitBeforeTax"),
  };
  for (const [key, value] of Object.entries(numbers)) {
    if (Number.isNaN(value)) return fail("Check the figures.", { [key]: "Enter a number, such as 4120000. Leave blank if not yet filed." });
  }
  const parsed = financialYearSchema.safeParse({
    yearEnding: optDate(formData, "yearEnding"),
    ...numbers,
    currency: str(formData, "currency") || "GBP",
  });
  if (!parsed.success) return fail("Check the highlighted fields.", fieldErrorsFrom(parsed.error));
  try {
    await upsertFinancialYear(orgId, userId, parsed.data, optStr(formData, "id") ?? undefined);
  } catch (error) {
    return fail(errorMessage(error, "The financial year could not be saved."));
  }
  revalidateProfile();
  return ok("Financial year saved.");
}

export async function deleteFinancialYearAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { orgId, userId } = await getOrgContext();
  await deleteFinancialYear(orgId, userId, str(formData, "id"));
  revalidateProfile();
  return ok("Financial year removed.");
}

// ---------------------------------------------------------------------------
// Insurance
// ---------------------------------------------------------------------------

const insuranceSchema = z.object({
  kind: z.enum(INSURANCE_TYPES, { error: "Choose the type of cover." }),
  coverAmount: z.number({ error: "Enter the cover amount." }).positive("Cover must be more than zero."),
  currency: currencySchema,
  insurer: z.string().trim().max(80).nullable(),
  expiresOn: z.date().nullable(),
});

export async function saveInsuranceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { orgId, userId } = await getOrgContext();
  const coverAmount = optNum(formData, "coverAmount");
  if (Number.isNaN(coverAmount)) return fail("Check the cover amount.", { coverAmount: "Enter a number, such as 10000000." });
  const parsed = insuranceSchema.safeParse({
    kind: str(formData, "kind"),
    coverAmount,
    currency: str(formData, "currency") || "GBP",
    insurer: optStr(formData, "insurer"),
    expiresOn: optDate(formData, "expiresOn"),
  });
  if (!parsed.success) return fail("Check the highlighted fields.", fieldErrorsFrom(parsed.error));
  try {
    await upsertInsurance(orgId, userId, parsed.data, optStr(formData, "id") ?? undefined);
  } catch (error) {
    return fail(errorMessage(error, "The policy could not be saved."));
  }
  revalidateProfile();
  return ok("Insurance policy saved.");
}

export async function deleteInsuranceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { orgId, userId } = await getOrgContext();
  await deleteInsurance(orgId, userId, str(formData, "id"));
  revalidateProfile();
  return ok("Insurance policy removed.");
}

// ---------------------------------------------------------------------------
// Past projects
// ---------------------------------------------------------------------------

const projectSchema = z.object({
  clientName: z.string().trim().min(2, "Enter the client's name.").max(120),
  title: z.string().trim().min(2, "Give the contract a short title.").max(160),
  description: z.string().trim().max(1000).nullable(),
  contractValue: z.number().nonnegative().nullable(),
  currency: currencySchema,
  sector: z.string().trim().max(40).nullable(),
  startedOn: z.date().nullable(),
  endedOn: z.date().nullable(),
  isPublicSector: z.boolean(),
  refereeContactable: z.boolean(),
});

export async function savePastProjectAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { orgId, userId } = await getOrgContext();
  const contractValue = optNum(formData, "contractValue");
  if (Number.isNaN(contractValue)) return fail("Check the contract value.", { contractValue: "Enter a number, such as 480000." });
  const parsed = projectSchema.safeParse({
    clientName: str(formData, "clientName"),
    title: str(formData, "title"),
    description: optStr(formData, "description"),
    contractValue,
    currency: str(formData, "currency") || "GBP",
    sector: optStr(formData, "sector"),
    startedOn: optDate(formData, "startedOn"),
    endedOn: optDate(formData, "endedOn"),
    isPublicSector: bool(formData, "isPublicSector"),
    refereeContactable: bool(formData, "refereeContactable"),
  });
  if (!parsed.success) return fail("Check the highlighted fields.", fieldErrorsFrom(parsed.error));
  if (parsed.data.startedOn && parsed.data.endedOn && parsed.data.endedOn < parsed.data.startedOn) {
    return fail("Check the dates.", { endedOn: "The end date is before the start date." });
  }
  try {
    await upsertPastProject(orgId, userId, parsed.data, optStr(formData, "id") ?? undefined);
  } catch (error) {
    return fail(errorMessage(error, "The project could not be saved."));
  }
  revalidateProfile();
  return ok("Project saved.");
}

export async function deletePastProjectAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { orgId, userId } = await getOrgContext();
  await deletePastProject(orgId, userId, str(formData, "id"));
  revalidateProfile();
  return ok("Project removed.");
}

// ---------------------------------------------------------------------------
// Policies
// ---------------------------------------------------------------------------

const policySchema = z.object({
  policyType: z
    .string()
    .trim()
    .min(2, "Choose or enter a policy type.")
    .max(40)
    .transform((s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")),
  title: z.string().trim().max(120).nullable(),
  lastReviewed: z.date().nullable(),
  documentUrl: z.string().trim().url("Enter a full link, starting with https://").nullable(),
});

export async function savePolicyAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { orgId, userId } = await getOrgContext();
  const parsed = policySchema.safeParse({
    policyType: optStr(formData, "policyTypeOther") ?? str(formData, "policyType"),
    title: optStr(formData, "title"),
    lastReviewed: optDate(formData, "lastReviewed"),
    documentUrl: optStr(formData, "documentUrl"),
  });
  if (!parsed.success) return fail("Check the highlighted fields.", fieldErrorsFrom(parsed.error));
  try {
    await upsertPolicy(orgId, userId, parsed.data, optStr(formData, "id") ?? undefined);
  } catch (error) {
    return fail(errorMessage(error, "The policy could not be saved."));
  }
  revalidateProfile();
  return ok("Policy saved.");
}

export async function deletePolicyAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { orgId, userId } = await getOrgContext();
  await deletePolicy(orgId, userId, str(formData, "id"));
  revalidateProfile();
  return ok("Policy removed.");
}
