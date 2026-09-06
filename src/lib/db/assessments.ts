/**
 * Assessments (§7.6) — immutable, versioned. Running one never mutates a
 * previous version; it appends version n+1 and one event.
 *
 * Prisma seam: `runAssessment` becomes an interactive transaction that takes
 * an advisory lock on hashtext(tenderId), computes max(version)+1, calls the
 * pure `evaluate()` from src/lib/qualify, and writes assessment + results +
 * event together. The placeholder evaluator here is deleted at that point.
 */
import type { Assessment } from "@/lib/types";
import { buildAssessment, type ProfileSnapshot } from "./_placeholder/evaluate";
import { appendEvent, clone, getStore, newId } from "./_placeholder/store";
import { getSubmissionDeadline } from "./tenders";

function snapshot(orgId: string): ProfileSnapshot {
  const store = getStore();
  const organisation = store.organisations.find((o) => o.id === orgId);
  if (!organisation) throw new Error("Organisation not found");
  return {
    organisation,
    credentials: store.credentials.filter((c) => c.orgId === orgId),
    credentialTypes: store.credentialTypes,
    financialYears: store.financialYears.filter((f) => f.orgId === orgId),
    insurances: store.insurances.filter((i) => i.orgId === orgId),
    pastProjects: store.pastProjects.filter((p) => p.orgId === orgId),
    policies: store.policies.filter((p) => p.orgId === orgId),
  };
}

export async function runAssessment(orgId: string, userId: string, tenderId: string): Promise<Assessment> {
  const store = getStore();
  const tender = store.tenders.find((t) => t.id === tenderId && t.orgId === orgId);
  if (!tender) throw new Error("Tender not found");
  const requirements = store.requirements.filter((r) => r.tenderId === tenderId);
  if (requirements.length === 0) {
    throw new Error("This tender has no requirements yet. Upload its pack and extract requirements first.");
  }
  const previous = store.assessments.filter((a) => a.tenderId === tenderId);
  const version = previous.reduce((max, a) => Math.max(max, a.version), 0) + 1;
  const asOf = new Date();
  const deadline = await getSubmissionDeadline(orgId, tenderId);

  const { assessment, results } = buildAssessment({
    tenderId,
    orgId,
    version,
    requirements,
    profile: snapshot(orgId),
    asOf,
    deadline,
    runById: userId,
    newId,
  });
  store.assessments.push(assessment);
  store.results.push(...results);

  if (tender.status === "draft" || tender.status === "extracted" || tender.status === "assessed") {
    tender.status = "assessed";
    tender.updatedAt = asOf;
  }
  appendEvent(store, {
    orgId,
    actorId: userId,
    actorKind: "user",
    action: "assessment.run",
    subjectTable: "assessments",
    subjectId: assessment.id,
    payload: {
      tenderId,
      version,
      recommendation: assessment.recommendation,
      mandatoryPassed: assessment.mandatoryPassed,
      mandatoryFailed: assessment.mandatoryFailed,
      mandatoryUnknown: assessment.mandatoryUnknown,
      deadlineUsed: deadline?.toISOString() ?? null,
      asOfUsed: asOf.toISOString(),
    },
  });
  return clone(assessment);
}
