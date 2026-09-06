/**
 * Company profile (§7.4) — the five capability tables plus organisation
 * details. Every write appends one `profile.updated` event, which is what
 * tells a tender its assessment may be stale (§14).
 *
 * Prisma seam: each upsert becomes `prisma.<model>.upsert` inside a
 * transaction with the event insert.
 */
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
import { appendEvent, clone, getStore, newId } from "./_placeholder/store";

function usage(orgId: string, predicate: (constraint: Record<string, unknown>, kind: string) => boolean): UsageCount {
  const store = getStore();
  const tenders = new Set<string>();
  let requirements = 0;
  for (const r of store.requirements) {
    if (r.orgId !== orgId) continue;
    if (predicate(r.constraintJson as Record<string, unknown>, r.kind)) {
      requirements += 1;
      tenders.add(r.tenderId);
    }
  }
  return { requirements, tenders: tenders.size };
}

/** Projects are "used" where the latest assessment of a tender counted them as evidence. */
function projectUsage(orgId: string, projectId: string): UsageCount {
  const store = getStore();
  const latestByTender = new Map<string, string>();
  for (const a of store.assessments) {
    if (a.orgId !== orgId) continue;
    const current = latestByTender.get(a.tenderId);
    const currentVersion = current ? store.assessments.find((x) => x.id === current)!.version : -1;
    if (a.version > currentVersion) latestByTender.set(a.tenderId, a.id);
  }
  const latestIds = new Set(latestByTender.values());
  const tenders = new Set<string>();
  let requirements = 0;
  for (const r of store.results) {
    if (!latestIds.has(r.assessmentId)) continue;
    if (r.evidence.some((e) => e.table === "past_projects" && e.id === projectId && e.matched)) {
      requirements += 1;
      const a = store.assessments.find((x) => x.id === r.assessmentId)!;
      tenders.add(a.tenderId);
    }
  }
  return { requirements, tenders: tenders.size };
}

export async function listCredentialTypes(): Promise<CredentialType[]> {
  return clone(getStore().credentialTypes);
}

export async function getProfile(orgId: string): Promise<ProfileView | null> {
  const store = getStore();
  const organisation = store.organisations.find((o) => o.id === orgId);
  if (!organisation) return null;

  const years = store.financialYears
    .filter((f) => f.orgId === orgId)
    .sort((a, b) => b.yearEnding.getTime() - a.yearEnding.getTime());

  const profileEvents = store.events.filter((e) => e.orgId === orgId && e.action === "profile.updated");
  const lastChange = profileEvents.reduce<Date | null>((max, e) => (!max || e.createdAt > max ? e.createdAt : max), null);
  const staleAssessments: ProfileView["staleAssessments"] = [];
  if (lastChange) {
    for (const tender of store.tenders.filter((t) => t.orgId === orgId)) {
      const latest = store.assessments.filter((a) => a.tenderId === tender.id).sort((a, b) => b.version - a.version)[0];
      if (latest && latest.createdAt < lastChange) staleAssessments.push({ id: tender.id, title: tender.title });
    }
  }

  // Gaps: what requirements ask for that the profile lacks. This is what makes
  // profile completion feel worth doing rather than like a form (§10.3).
  const heldCodes = new Set(store.credentials.filter((c) => c.orgId === orgId).map((c) => c.code));
  const heldKinds = new Set(store.insurances.filter((i) => i.orgId === orgId).map((i) => i.kind));
  const heldPolicies = new Set(store.policies.filter((p) => p.orgId === orgId).map((p) => p.policyType));
  const gapMap = { credentials: new Map<string, ProfileGap>(), insurances: new Map<string, ProfileGap>(), policies: new Map<string, ProfileGap>() };
  const tendersByGap = new Map<string, Set<string>>();
  for (const r of store.requirements) {
    if (r.orgId !== orgId) continue;
    const c = r.constraintJson as Record<string, unknown>;
    let bucket: keyof typeof gapMap | null = null;
    let key = "";
    let label = "";
    if (r.kind === "certification" && typeof c.credential_code === "string" && !heldCodes.has(c.credential_code)) {
      bucket = "credentials";
      key = c.credential_code;
      label = store.credentialTypes.find((t) => t.code === key)?.label ?? key;
    } else if (r.kind === "insurance" && typeof c.insurance_kind === "string" && !heldKinds.has(c.insurance_kind as InsuranceType)) {
      bucket = "insurances";
      key = c.insurance_kind;
      label = INSURANCE_TYPE_LABEL[key as InsuranceType] ?? key;
    } else if (r.kind === "policy" && typeof c.policy_type === "string" && !heldPolicies.has(c.policy_type)) {
      bucket = "policies";
      key = c.policy_type;
      label = policyTypeLabel(key);
    }
    if (!bucket) continue;
    const gap = gapMap[bucket].get(key) ?? { key, label, usage: { requirements: 0, tenders: 0 } };
    gap.usage.requirements += 1;
    const set = tendersByGap.get(`${bucket}:${key}`) ?? new Set<string>();
    set.add(r.tenderId);
    tendersByGap.set(`${bucket}:${key}`, set);
    gap.usage.tenders = set.size;
    gapMap[bucket].set(key, gap);
  }
  const sortGaps = (m: Map<string, ProfileGap>) => Array.from(m.values()).sort((a, b) => b.usage.requirements - a.usage.requirements);

  return {
    organisation: clone(organisation),
    gaps: { credentials: sortGaps(gapMap.credentials), insurances: sortGaps(gapMap.insurances), policies: sortGaps(gapMap.policies) },
    credentialTypes: clone(store.credentialTypes),
    credentials: store.credentials
      .filter((c) => c.orgId === orgId)
      .map((c) => ({
        ...clone(c),
        type: clone(store.credentialTypes.find((t) => t.code === c.code) ?? { code: c.code, label: c.code, category: null }),
        usage: usage(orgId, (k, kind) => kind === "certification" && k.credential_code === c.code),
      }))
      .sort((a, b) => a.type.label.localeCompare(b.type.label)),
    financialYears: years.map((f, rank) => ({
      ...clone(f),
      // A financial requirement over N years reads the N most recent years.
      usage: usage(orgId, (k, kind) => kind === "financial" && rank < Math.max(1, Number(k.years ?? 1))),
    })),
    insurances: store.insurances
      .filter((i) => i.orgId === orgId)
      .map((i) => ({ ...clone(i), usage: usage(orgId, (k, kind) => kind === "insurance" && k.insurance_kind === i.kind) }))
      .sort((a, b) => a.kind.localeCompare(b.kind)),
    pastProjects: store.pastProjects
      .filter((p) => p.orgId === orgId)
      .map((p) => ({ ...clone(p), usage: projectUsage(orgId, p.id) }))
      .sort((a, b) => (b.endedOn?.getTime() ?? Number.MAX_SAFE_INTEGER) - (a.endedOn?.getTime() ?? Number.MAX_SAFE_INTEGER)),
    policies: store.policies
      .filter((p) => p.orgId === orgId)
      .map((p) => ({ ...clone(p), usage: usage(orgId, (k, kind) => kind === "policy" && k.policy_type === p.policyType) }))
      .sort((a, b) => a.policyType.localeCompare(b.policyType)),
    staleAssessments,
  };
}

function recordChange(orgId: string, userId: string, section: string, change: "added" | "updated" | "removed", label: string, subjectId: string) {
  appendEvent(getStore(), {
    orgId,
    actorId: userId,
    actorKind: "user",
    action: "profile.updated",
    subjectTable: section,
    subjectId,
    payload: { section, change, label },
  });
}

// ---------------------------------------------------------------------------
// Organisation
// ---------------------------------------------------------------------------

export async function updateOrganisation(
  orgId: string,
  userId: string,
  input: Pick<Organisation, "name" | "companiesHouseNumber" | "headcount" | "registeredRegion" | "sicCodes">,
): Promise<Organisation> {
  const store = getStore();
  const org = store.organisations.find((o) => o.id === orgId);
  if (!org) throw new Error("Organisation not found");
  Object.assign(org, input);
  recordChange(orgId, userId, "organisations", "updated", org.name, org.id);
  return clone(org);
}

// ---------------------------------------------------------------------------
// Credentials
// ---------------------------------------------------------------------------

export type CredentialInput = Pick<Credential, "code" | "reference" | "issuedOn" | "expiresOn" | "evidenceUrl">;

export async function upsertCredential(orgId: string, userId: string, input: CredentialInput, id?: string): Promise<Credential> {
  const store = getStore();
  const type = store.credentialTypes.find((t) => t.code === input.code);
  if (!type) throw new Error("Choose a certification from the list.");
  const duplicate = store.credentials.find((c) => c.orgId === orgId && c.code === input.code && c.id !== id);
  if (duplicate) throw new Error(`${type.label} is already on your profile. Edit the existing entry instead.`);
  const existing = id ? store.credentials.find((c) => c.id === id && c.orgId === orgId) : undefined;
  if (existing) {
    Object.assign(existing, input);
    recordChange(orgId, userId, "credentials", "updated", type.label, existing.id);
    return clone(existing);
  }
  const row: Credential = { id: newId(), orgId, ...input, createdAt: new Date() };
  store.credentials.push(row);
  recordChange(orgId, userId, "credentials", "added", type.label, row.id);
  return clone(row);
}

export async function deleteCredential(orgId: string, userId: string, id: string): Promise<void> {
  const store = getStore();
  const index = store.credentials.findIndex((c) => c.id === id && c.orgId === orgId);
  if (index === -1) return;
  const [removed] = store.credentials.splice(index, 1);
  const label = store.credentialTypes.find((t) => t.code === removed.code)?.label ?? removed.code;
  recordChange(orgId, userId, "credentials", "removed", label, id);
}

// ---------------------------------------------------------------------------
// Financial years
// ---------------------------------------------------------------------------

export type FinancialYearInput = Pick<FinancialYear, "yearEnding" | "turnover" | "netAssets" | "profitBeforeTax" | "currency">;

export async function upsertFinancialYear(orgId: string, userId: string, input: FinancialYearInput, id?: string): Promise<FinancialYear> {
  const store = getStore();
  const sameYear = store.financialYears.find(
    (f) => f.orgId === orgId && f.id !== id && f.yearEnding.getTime() === input.yearEnding.getTime(),
  );
  if (sameYear) throw new Error("A financial year ending on that date is already on your profile.");
  const existing = id ? store.financialYears.find((f) => f.id === id && f.orgId === orgId) : undefined;
  const label = `FY${input.yearEnding.getFullYear()}`;
  if (existing) {
    Object.assign(existing, input);
    recordChange(orgId, userId, "financial_years", "updated", label, existing.id);
    return clone(existing);
  }
  const row: FinancialYear = { id: newId(), orgId, ...input, createdAt: new Date() };
  store.financialYears.push(row);
  recordChange(orgId, userId, "financial_years", "added", label, row.id);
  return clone(row);
}

export async function deleteFinancialYear(orgId: string, userId: string, id: string): Promise<void> {
  const store = getStore();
  const index = store.financialYears.findIndex((f) => f.id === id && f.orgId === orgId);
  if (index === -1) return;
  const [removed] = store.financialYears.splice(index, 1);
  recordChange(orgId, userId, "financial_years", "removed", `FY${removed.yearEnding.getFullYear()}`, id);
}

// ---------------------------------------------------------------------------
// Insurance
// ---------------------------------------------------------------------------

export type InsuranceInput = Pick<Insurance, "kind" | "coverAmount" | "currency" | "insurer" | "expiresOn">;

export async function upsertInsurance(orgId: string, userId: string, input: InsuranceInput, id?: string): Promise<Insurance> {
  const store = getStore();
  const duplicate = store.insurances.find((i) => i.orgId === orgId && i.kind === input.kind && i.id !== id);
  if (duplicate) throw new Error("A policy of that kind is already on your profile. Edit the existing entry instead.");
  const existing = id ? store.insurances.find((i) => i.id === id && i.orgId === orgId) : undefined;
  if (existing) {
    Object.assign(existing, input);
    recordChange(orgId, userId, "insurances", "updated", INSURANCE_TYPE_LABEL[input.kind], existing.id);
    return clone(existing);
  }
  const row: Insurance = { id: newId(), orgId, ...input, createdAt: new Date() };
  store.insurances.push(row);
  recordChange(orgId, userId, "insurances", "added", INSURANCE_TYPE_LABEL[input.kind], row.id);
  return clone(row);
}

export async function deleteInsurance(orgId: string, userId: string, id: string): Promise<void> {
  const store = getStore();
  const index = store.insurances.findIndex((i) => i.id === id && i.orgId === orgId);
  if (index === -1) return;
  const [removed] = store.insurances.splice(index, 1);
  recordChange(orgId, userId, "insurances", "removed", INSURANCE_TYPE_LABEL[removed.kind], id);
}

// ---------------------------------------------------------------------------
// Past projects
// ---------------------------------------------------------------------------

export type PastProjectInput = Omit<PastProject, "id" | "orgId" | "createdAt">;

export async function upsertPastProject(orgId: string, userId: string, input: PastProjectInput, id?: string): Promise<PastProject> {
  const store = getStore();
  const existing = id ? store.pastProjects.find((p) => p.id === id && p.orgId === orgId) : undefined;
  if (existing) {
    Object.assign(existing, input);
    recordChange(orgId, userId, "past_projects", "updated", `${input.clientName} — ${input.title}`, existing.id);
    return clone(existing);
  }
  const row: PastProject = { id: newId(), orgId, ...input, createdAt: new Date() };
  store.pastProjects.push(row);
  recordChange(orgId, userId, "past_projects", "added", `${input.clientName} — ${input.title}`, row.id);
  return clone(row);
}

export async function deletePastProject(orgId: string, userId: string, id: string): Promise<void> {
  const store = getStore();
  const index = store.pastProjects.findIndex((p) => p.id === id && p.orgId === orgId);
  if (index === -1) return;
  const [removed] = store.pastProjects.splice(index, 1);
  recordChange(orgId, userId, "past_projects", "removed", `${removed.clientName} — ${removed.title}`, id);
}

// ---------------------------------------------------------------------------
// Policies
// ---------------------------------------------------------------------------

export type PolicyInput = Pick<Policy, "policyType" | "title" | "lastReviewed" | "documentUrl">;

export async function upsertPolicy(orgId: string, userId: string, input: PolicyInput, id?: string): Promise<Policy> {
  const store = getStore();
  const duplicate = store.policies.find((p) => p.orgId === orgId && p.policyType === input.policyType && p.id !== id);
  if (duplicate) throw new Error("A policy of that type is already on your profile. Edit the existing entry instead.");
  const existing = id ? store.policies.find((p) => p.id === id && p.orgId === orgId) : undefined;
  if (existing) {
    Object.assign(existing, input);
    recordChange(orgId, userId, "policies", "updated", policyTypeLabel(input.policyType), existing.id);
    return clone(existing);
  }
  const row: Policy = { id: newId(), orgId, ...input, createdAt: new Date() };
  store.policies.push(row);
  recordChange(orgId, userId, "policies", "added", policyTypeLabel(input.policyType), row.id);
  return clone(row);
}

export async function deletePolicy(orgId: string, userId: string, id: string): Promise<void> {
  const store = getStore();
  const index = store.policies.findIndex((p) => p.id === id && p.orgId === orgId);
  if (index === -1) return;
  const [removed] = store.policies.splice(index, 1);
  recordChange(orgId, userId, "policies", "removed", policyTypeLabel(removed.policyType), id);
}
