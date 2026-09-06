"use server";

import { revalidatePath } from "next/cache";
import {
  CREDENTIAL_TYPES,
  desirableCoverage,
  recommend,
  tallyMandatory,
  type Evaluate,
  type EvaluationInput,
  type EvaluationResult,
  type RequirementEvaluation,
} from "../../../contracts";
import { getOrgContext } from "@/lib/auth/session";
import { runAssessment } from "@/lib/db/assessments";
import { evaluateRequirement, type ProfileSnapshot } from "@/lib/db/_placeholder/evaluate";
import type { Credential, EvidenceRef, FinancialYear, Insurance, PastProject, Policy, Requirement } from "@/lib/types";
import { errorMessage, fail, ok, str, type ActionState } from "./shared";

/**
 * TEMPORARY WIRING — one import, and it goes.
 *
 * `runAssessment` takes the evaluator as an injected dependency (§9: the engine
 * is pure TypeScript in `src/lib/qualify/`, owned by `feat/qualify-engine`).
 * Until that branch lands there is nothing to inject, so the placeholder
 * evaluator is adapted to the frozen `Evaluate` signature here, at the call site
 * where the dependency belongs. When the real engine arrives, delete everything
 * between here and `runAssessmentAction` and write:
 *
 *   import { evaluate } from "@/lib/qualify/evaluate";
 */
const FILLER_DATE = new Date(0);

function snapshotFor(input: EvaluationInput): ProfileSnapshot {
  const { snapshot } = input;
  const orgId = snapshot.orgId;
  return {
    organisation: {
      id: orgId,
      name: "",
      companiesHouseNumber: null,
      headcount: snapshot.headcount,
      registeredRegion: snapshot.registeredRegion,
      sicCodes: [],
      createdAt: FILLER_DATE,
    },
    credentialTypes: CREDENTIAL_TYPES.map((type) => ({
      code: type.code,
      label: type.label,
      category: type.category as "quality" | "security" | "hs" | "environmental",
    })),
    credentials: snapshot.credentials.map((c): Credential => ({
      id: c.id,
      orgId,
      code: c.code,
      reference: c.reference,
      issuedOn: c.issuedOn,
      expiresOn: c.expiresOn,
      evidenceUrl: null,
      createdAt: FILLER_DATE,
    })),
    financialYears: snapshot.financialYears.map((f): FinancialYear => ({
      id: f.id,
      orgId,
      yearEnding: f.yearEnding,
      turnover: f.turnover,
      netAssets: f.netAssets,
      profitBeforeTax: f.profitBeforeTax,
      currency: f.currency,
      createdAt: FILLER_DATE,
    })),
    insurances: snapshot.insurances.map((i): Insurance => ({
      id: i.id,
      orgId,
      kind: i.kind,
      coverAmount: i.coverAmount,
      currency: i.currency,
      insurer: i.insurer,
      expiresOn: i.expiresOn,
      createdAt: FILLER_DATE,
    })),
    pastProjects: snapshot.pastProjects.map((p): PastProject => ({
      id: p.id,
      orgId,
      clientName: p.clientName,
      title: p.title,
      description: null,
      contractValue: p.contractValue,
      currency: p.currency,
      sector: p.sector,
      startedOn: p.startedOn,
      endedOn: p.endedOn,
      isPublicSector: p.isPublicSector,
      refereeContactable: p.refereeContactable,
      createdAt: FILLER_DATE,
    })),
    policies: snapshot.policies.map((p): Policy => ({
      id: p.id,
      orgId,
      policyType: p.policyType,
      title: p.title,
      lastReviewed: p.lastReviewed,
      documentUrl: null,
      createdAt: FILLER_DATE,
    })),
  };
}

const evaluate: Evaluate = (input: EvaluationInput): EvaluationResult => {
  const profile = snapshotFor(input);
  const clock = { asOf: input.asOf, deadline: input.submissionDeadline };
  const results: RequirementEvaluation[] = input.requirements.map((requirement) => {
    const outcome = evaluateRequirement(
      {
        id: requirement.id,
        kind: requirement.kind,
        obligation: requirement.obligation,
        summary: requirement.summary,
        constraintJson: requirement.constraint,
      } as unknown as Requirement,
      profile,
      clock,
    );
    return {
      requirementId: requirement.id,
      verdict: outcome.verdict,
      rationale: outcome.rationale,
      // The placeholder emits the UI's evidence shape; `toEvidence` in
      // src/lib/db/assessments.ts reads either.
      evidence: outcome.evidence as unknown as EvidenceRef[] as never,
      warning: outcome.warning,
    };
  });

  const rows = input.requirements.map((requirement, index) => ({
    obligation: requirement.obligation,
    verdict: results[index].verdict,
  }));
  const counts = tallyMandatory(rows);
  return {
    ...counts,
    recommendation: recommend(counts),
    desirableScore: desirableCoverage(rows),
    results,
    deadlineUsed: input.submissionDeadline,
    asOfUsed: input.asOf,
  };
};

export async function runAssessmentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const tenderId = str(formData, "tenderId");
  if (!tenderId) return fail("No tender was given to assess.");
  const { orgId, userId } = await getOrgContext();
  try {
    const assessment = await runAssessment(orgId, tenderId, {
      evaluate,
      asOf: new Date(),
      runById: userId,
    });
    revalidatePath(`/tenders/${tenderId}`);
    revalidatePath("/");
    revalidatePath("/profile");
    return ok(`Assessment complete — version ${assessment.version}.`);
  } catch (error) {
    return fail(errorMessage(error, "The assessment could not be run. Try again in a moment."));
  }
}
