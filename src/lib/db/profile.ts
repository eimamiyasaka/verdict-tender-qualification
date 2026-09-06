/**
 * The company profile (§7.4) — the five capability tables plus organisation
 * details, and `getCapabilitySnapshot`, which is the **entire** evidence surface
 * `evaluate()` reads. If the evaluator needs a fact that is not in the snapshot,
 * the answer is `unknown`, not a new field.
 *
 * Every write appends one `profile.updated` event in the same transaction as the
 * change. That event is what tells a tender its assessment may be stale (§14)
 * and what the profile screen reads to list the tenders worth re-running.
 */

import type { CapabilitySnapshot, InsuranceType as ContractInsuranceType } from "../../../contracts";
import { INSURANCE_TYPE_LABEL, policyTypeLabel } from "@/lib/labels";
import type {
  Credential,
  CredentialType,
  FinancialYear,
  Insurance,
  InsuranceType,
  Organisation,
  PastProject,
  Policy,
  ProfileGap,
  ProfileView,
  UsageCount,
} from "@/lib/types";
import { asJsonArray, prisma, toDecimal, toDecimalRequired, toNumber, toNumberRequired, type Db, type Tx } from "./client";
import { appendEvent, getLastProfileChangeAt } from "./events";
import { getOrganisation, toOrganisation } from "./org";

/* ---------------------------------------------------------------------------
 * Mappers
 * ------------------------------------------------------------------------- */

type Decimalish = { toNumber(): number };

function toCredential(row: {
  id: string;
  orgId: string;
  code: string;
  reference: string | null;
  issuedOn: Date | null;
  expiresOn: Date | null;
  evidenceUrl: string | null;
  createdAt: Date;
}): Credential {
  return { ...row };
}

function toFinancialYear(row: {
  id: string;
  orgId: string;
  yearEnding: Date;
  turnover: Decimalish | null;
  netAssets: Decimalish | null;
  profitBeforeTax: Decimalish | null;
  currency: string;
  createdAt: Date;
}): FinancialYear {
  return {
    id: row.id,
    orgId: row.orgId,
    yearEnding: row.yearEnding,
    // A null metric is the `unknown` case (§9) — never coerced to zero.
    turnover: toNumber(row.turnover as never),
    netAssets: toNumber(row.netAssets as never),
    profitBeforeTax: toNumber(row.profitBeforeTax as never),
    currency: row.currency,
    createdAt: row.createdAt,
  };
}

function toInsurance(row: {
  id: string;
  orgId: string;
  kind: string;
  coverAmount: Decimalish;
  currency: string;
  insurer: string | null;
  expiresOn: Date | null;
  createdAt: Date;
}): Insurance {
  return {
    id: row.id,
    orgId: row.orgId,
    kind: row.kind as InsuranceType,
    coverAmount: toNumberRequired(row.coverAmount as never),
    currency: row.currency,
    insurer: row.insurer,
    expiresOn: row.expiresOn,
    createdAt: row.createdAt,
  };
}

function toPastProject(row: {
  id: string;
  orgId: string;
  clientName: string;
  title: string;
  description: string | null;
  contractValue: Decimalish | null;
  currency: string;
  sector: string | null;
  startedOn: Date | null;
  endedOn: Date | null;
  isPublicSector: boolean;
  refereeContactable: boolean;
  createdAt: Date;
}): PastProject {
  return {
    id: row.id,
    orgId: row.orgId,
    clientName: row.clientName,
    title: row.title,
    description: row.description,
    contractValue: toNumber(row.contractValue as never),
    currency: row.currency,
    sector: row.sector,
    startedOn: row.startedOn,
    endedOn: row.endedOn,
    isPublicSector: row.isPublicSector,
    refereeContactable: row.refereeContactable,
    createdAt: row.createdAt,
  };
}

function toPolicy(row: {
  id: string;
  orgId: string;
  policyType: string;
  title: string | null;
  lastReviewed: Date | null;
  documentUrl: string | null;
  createdAt: Date;
}): Policy {
  return { ...row };
}

function toCredentialType(row: { code: string; label: string; category: string | null }): CredentialType {
  return { code: row.code, label: row.label, category: row.category as CredentialType["category"] };
}

/* ---------------------------------------------------------------------------
 * The evidence surface
 * ------------------------------------------------------------------------- */

/**
 * Spec §7.4: these five tables plus `headcount` and `registeredRegion` are the
 * whole of what the evaluator may see. Loaded in one round trip so a run is a
 * consistent picture of the profile rather than five reads that could interleave
 * with an edit.
 */
export async function getCapabilitySnapshot(
  orgId: string,
  db: Db = prisma,
): Promise<CapabilitySnapshot> {
  const organisation = await db.organisation.findUnique({
    where: { id: orgId },
    include: {
      credentials: { orderBy: { code: "asc" } },
      financialYears: { orderBy: { yearEnding: "desc" } },
      insurances: { orderBy: { kind: "asc" } },
      pastProjects: { orderBy: { endedOn: "desc" } },
      policies: { orderBy: { policyType: "asc" } },
    },
  });
  if (!organisation) throw new Error("Organisation not found");

  return {
    orgId,
    headcount: organisation.headcount,
    registeredRegion: organisation.registeredRegion,
    credentials: organisation.credentials.map((row) => ({
      id: row.id,
      code: row.code,
      reference: row.reference,
      issuedOn: row.issuedOn,
      // Null means DOES NOT EXPIRE. It never means missing (§7.4, §9, §14).
      expiresOn: row.expiresOn,
    })),
    financialYears: organisation.financialYears.map((row) => ({
      id: row.id,
      yearEnding: row.yearEnding,
      turnover: toNumber(row.turnover),
      netAssets: toNumber(row.netAssets),
      profitBeforeTax: toNumber(row.profitBeforeTax),
      currency: row.currency,
    })),
    insurances: organisation.insurances.map((row) => ({
      id: row.id,
      kind: row.kind as ContractInsuranceType,
      coverAmount: toNumberRequired(row.coverAmount),
      currency: row.currency,
      insurer: row.insurer,
      expiresOn: row.expiresOn,
    })),
    pastProjects: organisation.pastProjects.map((row) => ({
      id: row.id,
      clientName: row.clientName,
      title: row.title,
      contractValue: toNumber(row.contractValue),
      currency: row.currency,
      sector: row.sector,
      startedOn: row.startedOn,
      // Null means ongoing.
      endedOn: row.endedOn,
      isPublicSector: row.isPublicSector,
      refereeContactable: row.refereeContactable,
    })),
    policies: organisation.policies.map((row) => ({
      id: row.id,
      policyType: row.policyType,
      title: row.title,
      lastReviewed: row.lastReviewed,
    })),
  };
}

/** Reference data (§7.4): seeded, not user-editable, and not org-scoped. */
export async function listCredentialTypes(): Promise<CredentialType[]> {
  const rows = await prisma.credentialType.findMany({ orderBy: { label: "asc" } });
  return rows.map(toCredentialType);
}

/* ---------------------------------------------------------------------------
 * The profile screen (§10.3)
 * ------------------------------------------------------------------------- */

const EMPTY_USAGE: UsageCount = { requirements: 0, tenders: 0 };

/**
 * "Used by N requirements across M tenders" (§10.3) — what makes filling the
 * profile in feel worth doing rather than like a form. Counted from the org's
 * requirements in one pass rather than one query per row.
 */
function countUsage(
  requirements: Array<{ tenderId: string; kind: string; constraint: Record<string, unknown> }>,
  predicate: (constraint: Record<string, unknown>, kind: string) => boolean,
): UsageCount {
  const tenders = new Set<string>();
  let count = 0;
  for (const requirement of requirements) {
    if (!predicate(requirement.constraint, requirement.kind)) continue;
    count += 1;
    tenders.add(requirement.tenderId);
  }
  return { requirements: count, tenders: tenders.size };
}

export async function getProfile(orgId: string): Promise<ProfileView | null> {
  const organisation = await prisma.organisation.findUnique({
    where: { id: orgId },
    include: {
      credentials: true,
      financialYears: { orderBy: { yearEnding: "desc" } },
      insurances: true,
      pastProjects: true,
      policies: true,
    },
  });
  if (!organisation) return null;

  const [credentialTypeRows, requirementRows, lastProfileChange] = await Promise.all([
    prisma.credentialType.findMany({ orderBy: { label: "asc" } }),
    prisma.requirement.findMany({
      where: { orgId },
      select: { tenderId: true, kind: true, constraintJson: true },
    }),
    getLastProfileChangeAt(orgId),
  ]);

  const credentialTypes = credentialTypeRows.map(toCredentialType);
  const requirements = requirementRows.map((row) => ({
    tenderId: row.tenderId,
    kind: row.kind as string,
    constraint: (row.constraintJson ?? {}) as Record<string, unknown>,
  }));

  /* --- Which past projects an assessment actually counted --- */

  const latestAssessments = await prisma.assessment.findMany({
    where: { orgId },
    orderBy: [{ tenderId: "asc" }, { version: "desc" }],
    distinct: ["tenderId"],
    select: { id: true, tenderId: true, createdAt: true },
  });
  const assessmentTender = new Map(latestAssessments.map((a) => [a.id, a.tenderId]));
  const resultRows = latestAssessments.length
    ? await prisma.assessmentResult.findMany({
        where: { orgId, assessmentId: { in: latestAssessments.map((a) => a.id) } },
        select: { assessmentId: true, evidence: true },
      })
    : [];

  const projectUsage = new Map<string, { requirements: number; tenders: Set<string> }>();
  for (const result of resultRows) {
    const tenderId = assessmentTender.get(result.assessmentId);
    if (!tenderId) continue;
    for (const entry of asJsonArray(result.evidence as never)) {
      const ref = entry as { source?: string; table?: string; id?: string; counted?: boolean; matched?: boolean };
      const isProject = ref.source === "past_project" || ref.table === "past_projects";
      const counted = ref.counted ?? ref.matched ?? false;
      if (!isProject || !counted || !ref.id) continue;
      const usage = projectUsage.get(ref.id) ?? { requirements: 0, tenders: new Set<string>() };
      usage.requirements += 1;
      usage.tenders.add(tenderId);
      projectUsage.set(ref.id, usage);
    }
  }

  /* --- Tenders whose latest assessment predates the last profile change --- */

  const staleAssessments: ProfileView["staleAssessments"] = [];
  if (lastProfileChange) {
    const staleTenderIds = latestAssessments
      .filter((assessment) => assessment.createdAt < lastProfileChange)
      .map((assessment) => assessment.tenderId);
    if (staleTenderIds.length > 0) {
      const tenders = await prisma.tender.findMany({
        where: { orgId, id: { in: staleTenderIds } },
        select: { id: true, title: true },
        orderBy: { title: "asc" },
      });
      staleAssessments.push(...tenders);
    }
  }

  /* --- Gaps: what requirements ask for that the profile does not hold --- */

  const heldCodes = new Set(organisation.credentials.map((c) => c.code));
  const heldKinds = new Set(organisation.insurances.map((i) => i.kind as string));
  const heldPolicies = new Set(organisation.policies.map((p) => p.policyType));
  const gapBuckets = {
    credentials: new Map<string, ProfileGap & { tenders: Set<string> }>(),
    insurances: new Map<string, ProfileGap & { tenders: Set<string> }>(),
    policies: new Map<string, ProfileGap & { tenders: Set<string> }>(),
  };

  for (const requirement of requirements) {
    const constraint = requirement.constraint;
    let bucket: keyof typeof gapBuckets | null = null;
    let key = "";
    let label = "";
    if (
      requirement.kind === "certification" &&
      typeof constraint.credential_code === "string" &&
      !heldCodes.has(constraint.credential_code)
    ) {
      bucket = "credentials";
      key = constraint.credential_code;
      label = credentialTypes.find((type) => type.code === key)?.label ?? key;
    } else if (
      requirement.kind === "insurance" &&
      typeof constraint.insurance_kind === "string" &&
      !heldKinds.has(constraint.insurance_kind)
    ) {
      bucket = "insurances";
      key = constraint.insurance_kind;
      label = INSURANCE_TYPE_LABEL[key as InsuranceType] ?? key;
    } else if (
      requirement.kind === "policy" &&
      typeof constraint.policy_type === "string" &&
      !heldPolicies.has(constraint.policy_type)
    ) {
      bucket = "policies";
      key = constraint.policy_type;
      label = policyTypeLabel(key);
    }
    if (!bucket) continue;
    const gap =
      gapBuckets[bucket].get(key) ??
      ({ key, label, usage: { requirements: 0, tenders: 0 }, tenders: new Set<string>() } as ProfileGap & {
        tenders: Set<string>;
      });
    gap.usage.requirements += 1;
    gap.tenders.add(requirement.tenderId);
    gap.usage.tenders = gap.tenders.size;
    gapBuckets[bucket].set(key, gap);
  }

  const sortGaps = (bucket: Map<string, ProfileGap & { tenders: Set<string> }>): ProfileGap[] =>
    Array.from(bucket.values())
      .map(({ key, label, usage }) => ({ key, label, usage }))
      .sort((a, b) => b.usage.requirements - a.usage.requirements || a.label.localeCompare(b.label));

  const credentialTypeByCode = new Map(credentialTypes.map((type) => [type.code, type]));

  return {
    organisation: toOrganisation(organisation),
    credentialTypes,
    gaps: {
      credentials: sortGaps(gapBuckets.credentials),
      insurances: sortGaps(gapBuckets.insurances),
      policies: sortGaps(gapBuckets.policies),
    },
    credentials: organisation.credentials
      .map((row) => ({
        ...toCredential(row),
        type: credentialTypeByCode.get(row.code) ?? { code: row.code, label: row.code, category: null },
        usage: countUsage(
          requirements,
          (constraint, kind) => kind === "certification" && constraint.credential_code === row.code,
        ),
      }))
      .sort((a, b) => a.type.label.localeCompare(b.type.label)),
    financialYears: organisation.financialYears.map((row, rank) => ({
      ...toFinancialYear(row),
      // A financial requirement over N years reads the N most recent filed years.
      usage: countUsage(requirements, (constraint, kind) => {
        if (kind !== "financial") return false;
        const years = Number(constraint.years_required ?? constraint.years ?? 1);
        return rank < Math.max(1, Number.isFinite(years) ? years : 1);
      }),
    })),
    insurances: organisation.insurances
      .map((row) => ({
        ...toInsurance(row),
        usage: countUsage(
          requirements,
          (constraint, kind) => kind === "insurance" && constraint.insurance_kind === row.kind,
        ),
      }))
      .sort((a, b) => a.kind.localeCompare(b.kind)),
    pastProjects: organisation.pastProjects
      .map((row) => {
        const usage = projectUsage.get(row.id);
        return {
          ...toPastProject(row),
          usage: usage ? { requirements: usage.requirements, tenders: usage.tenders.size } : { ...EMPTY_USAGE },
        };
      })
      .sort(
        (a, b) =>
          (b.endedOn?.getTime() ?? Number.MAX_SAFE_INTEGER) -
          (a.endedOn?.getTime() ?? Number.MAX_SAFE_INTEGER),
      ),
    policies: organisation.policies
      .map((row) => ({
        ...toPolicy(row),
        usage: countUsage(
          requirements,
          (constraint, kind) => kind === "policy" && constraint.policy_type === row.policyType,
        ),
      }))
      .sort((a, b) => a.policyType.localeCompare(b.policyType)),
    staleAssessments,
  };
}

/* ---------------------------------------------------------------------------
 * Writes. One transaction, one event, each time (§7.7).
 * ------------------------------------------------------------------------- */

async function recordChange(
  tx: Tx,
  orgId: string,
  userId: string,
  section: string,
  change: "added" | "updated" | "removed",
  label: string,
  subjectId: string,
): Promise<void> {
  await appendEvent(tx, {
    orgId,
    actorId: userId,
    actorKind: "user",
    action: "profile.updated",
    subjectTable: section,
    subjectId,
    payload: { section, change, label },
  });
}

export async function updateOrganisation(
  orgId: string,
  userId: string,
  input: Pick<
    Organisation,
    "name" | "companiesHouseNumber" | "headcount" | "registeredRegion" | "sicCodes"
  >,
): Promise<Organisation> {
  return prisma.$transaction(async (tx) => {
    const row = await tx.organisation.update({ where: { id: orgId }, data: input });
    await recordChange(tx, orgId, userId, "organisations", "updated", row.name, row.id);
    return toOrganisation(row);
  });
}

export type CredentialInput = Pick<
  Credential,
  "code" | "reference" | "issuedOn" | "expiresOn" | "evidenceUrl"
>;

export async function upsertCredential(
  orgId: string,
  userId: string,
  input: CredentialInput,
  id?: string,
): Promise<Credential> {
  return prisma.$transaction(async (tx) => {
    const type = await tx.credentialType.findUnique({ where: { code: input.code } });
    if (!type) throw new Error("Choose a certification from the list.");
    const duplicate = await tx.credential.findFirst({
      where: { orgId, code: input.code, ...(id ? { NOT: { id } } : {}) },
    });
    if (duplicate) {
      throw new Error(`${type.label} is already on your profile. Edit the existing entry instead.`);
    }
    const existing = id ? await tx.credential.findFirst({ where: { id, orgId } }) : null;
    const row = existing
      ? await tx.credential.update({ where: { id: existing.id }, data: input })
      : await tx.credential.create({ data: { orgId, ...input } });
    await recordChange(
      tx,
      orgId,
      userId,
      "credentials",
      existing ? "updated" : "added",
      type.label,
      row.id,
    );
    return toCredential(row);
  });
}

export async function deleteCredential(orgId: string, userId: string, id: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.credential.findFirst({ where: { id, orgId } });
    if (!existing) return;
    const type = await tx.credentialType.findUnique({ where: { code: existing.code } });
    await tx.credential.delete({ where: { id } });
    await recordChange(tx, orgId, userId, "credentials", "removed", type?.label ?? existing.code, id);
  });
}

export type FinancialYearInput = Pick<
  FinancialYear,
  "yearEnding" | "turnover" | "netAssets" | "profitBeforeTax" | "currency"
>;

export async function upsertFinancialYear(
  orgId: string,
  userId: string,
  input: FinancialYearInput,
  id?: string,
): Promise<FinancialYear> {
  return prisma.$transaction(async (tx) => {
    const duplicate = await tx.financialYear.findFirst({
      where: { orgId, yearEnding: input.yearEnding, ...(id ? { NOT: { id } } : {}) },
    });
    if (duplicate) {
      throw new Error("A financial year ending on that date is already on your profile.");
    }
    const data = {
      yearEnding: input.yearEnding,
      turnover: toDecimal(input.turnover),
      netAssets: toDecimal(input.netAssets),
      profitBeforeTax: toDecimal(input.profitBeforeTax),
      currency: input.currency,
    };
    const existing = id ? await tx.financialYear.findFirst({ where: { id, orgId } }) : null;
    const row = existing
      ? await tx.financialYear.update({ where: { id: existing.id }, data })
      : await tx.financialYear.create({ data: { orgId, ...data } });
    const label = `FY${input.yearEnding.getUTCFullYear()}`;
    await recordChange(
      tx,
      orgId,
      userId,
      "financial_years",
      existing ? "updated" : "added",
      label,
      row.id,
    );
    return toFinancialYear(row);
  });
}

export async function deleteFinancialYear(orgId: string, userId: string, id: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.financialYear.findFirst({ where: { id, orgId } });
    if (!existing) return;
    await tx.financialYear.delete({ where: { id } });
    await recordChange(
      tx,
      orgId,
      userId,
      "financial_years",
      "removed",
      `FY${existing.yearEnding.getUTCFullYear()}`,
      id,
    );
  });
}

export type InsuranceInput = Pick<
  Insurance,
  "kind" | "coverAmount" | "currency" | "insurer" | "expiresOn"
>;

export async function upsertInsurance(
  orgId: string,
  userId: string,
  input: InsuranceInput,
  id?: string,
): Promise<Insurance> {
  return prisma.$transaction(async (tx) => {
    const duplicate = await tx.insurance.findFirst({
      where: { orgId, kind: input.kind, ...(id ? { NOT: { id } } : {}) },
    });
    if (duplicate) {
      throw new Error(
        "A policy of that kind is already on your profile. Edit the existing entry instead.",
      );
    }
    const data = {
      kind: input.kind,
      coverAmount: toDecimalRequired(input.coverAmount),
      currency: input.currency,
      insurer: input.insurer,
      expiresOn: input.expiresOn,
    };
    const existing = id ? await tx.insurance.findFirst({ where: { id, orgId } }) : null;
    const row = existing
      ? await tx.insurance.update({ where: { id: existing.id }, data })
      : await tx.insurance.create({ data: { orgId, ...data } });
    await recordChange(
      tx,
      orgId,
      userId,
      "insurances",
      existing ? "updated" : "added",
      INSURANCE_TYPE_LABEL[input.kind],
      row.id,
    );
    return toInsurance(row);
  });
}

export async function deleteInsurance(orgId: string, userId: string, id: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.insurance.findFirst({ where: { id, orgId } });
    if (!existing) return;
    await tx.insurance.delete({ where: { id } });
    await recordChange(
      tx,
      orgId,
      userId,
      "insurances",
      "removed",
      INSURANCE_TYPE_LABEL[existing.kind as InsuranceType],
      id,
    );
  });
}

export type PastProjectInput = Omit<PastProject, "id" | "orgId" | "createdAt">;

export async function upsertPastProject(
  orgId: string,
  userId: string,
  input: PastProjectInput,
  id?: string,
): Promise<PastProject> {
  return prisma.$transaction(async (tx) => {
    const data = {
      clientName: input.clientName,
      title: input.title,
      description: input.description,
      contractValue: toDecimal(input.contractValue),
      currency: input.currency,
      sector: input.sector,
      startedOn: input.startedOn,
      endedOn: input.endedOn,
      isPublicSector: input.isPublicSector,
      refereeContactable: input.refereeContactable,
    };
    const existing = id ? await tx.pastProject.findFirst({ where: { id, orgId } }) : null;
    const row = existing
      ? await tx.pastProject.update({ where: { id: existing.id }, data })
      : await tx.pastProject.create({ data: { orgId, ...data } });
    await recordChange(
      tx,
      orgId,
      userId,
      "past_projects",
      existing ? "updated" : "added",
      `${input.clientName} — ${input.title}`,
      row.id,
    );
    return toPastProject(row);
  });
}

export async function deletePastProject(orgId: string, userId: string, id: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.pastProject.findFirst({ where: { id, orgId } });
    if (!existing) return;
    await tx.pastProject.delete({ where: { id } });
    await recordChange(
      tx,
      orgId,
      userId,
      "past_projects",
      "removed",
      `${existing.clientName} — ${existing.title}`,
      id,
    );
  });
}

export type PolicyInput = Pick<Policy, "policyType" | "title" | "lastReviewed" | "documentUrl">;

export async function upsertPolicy(
  orgId: string,
  userId: string,
  input: PolicyInput,
  id?: string,
): Promise<Policy> {
  return prisma.$transaction(async (tx) => {
    const duplicate = await tx.policy.findFirst({
      where: { orgId, policyType: input.policyType, ...(id ? { NOT: { id } } : {}) },
    });
    if (duplicate) {
      throw new Error(
        "A policy of that type is already on your profile. Edit the existing entry instead.",
      );
    }
    const existing = id ? await tx.policy.findFirst({ where: { id, orgId } }) : null;
    const row = existing
      ? await tx.policy.update({ where: { id: existing.id }, data: input })
      : await tx.policy.create({ data: { orgId, ...input } });
    await recordChange(
      tx,
      orgId,
      userId,
      "policies",
      existing ? "updated" : "added",
      policyTypeLabel(input.policyType),
      row.id,
    );
    return toPolicy(row);
  });
}

export async function deletePolicy(orgId: string, userId: string, id: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.policy.findFirst({ where: { id, orgId } });
    if (!existing) return;
    await tx.policy.delete({ where: { id } });
    await recordChange(
      tx,
      orgId,
      userId,
      "policies",
      "removed",
      policyTypeLabel(existing.policyType),
      id,
    );
  });
}

export { getOrganisation };
