/**
 * Assessments (§7.6) — immutable, versioned, and the only place a verdict is
 * written.
 *
 * **Invariant 3: an assessment is never updated after insert.** Editing the
 * profile does not rewrite version *n*; it produces version *n+1*, and the audit
 * tab can show both. The only row an override touches is one
 * `assessment_results` row (§10.5), which is why the counts on the assessment
 * stay exactly what the engine computed.
 *
 * **Version allocation.** `runAssessment` opens an interactive transaction,
 * takes `pg_advisory_xact_lock(hashtext(tenderId))`, computes `max(version) + 1`
 * and writes the assessment, its results and the event before committing. Two
 * concurrent runs serialise on the lock, so neither can claim a version the
 * other is about to take — and the `@@unique([tenderId, version])` constraint is
 * the backstop if one ever escaped.
 *
 * `evaluate` is injected rather than imported. The engine is pure TypeScript
 * owned by `src/lib/qualify/` (§9); taking it as a dependency keeps this layer
 * testable with a fake and keeps the data layer out of the decision path.
 */

import {
  type AssessmentRunPayload,
  type BidRecommendation,
  type EvidenceRef as ContractEvidenceRef,
  type Evaluate,
  type EvaluationInput,
  type Verdict,
} from "../../../contracts";
import type { Assessment, AssessmentResult, AssessmentWithResults, EvidenceRef } from "@/lib/types";
import { asJsonArray, prisma, toDecimal, toNumber, type Db } from "./client";
import { appendEvent } from "./events";
import { getCapabilitySnapshot } from "./profile";
import { listEvaluableRequirements } from "./requirements";
import { getSubmissionDeadline, markAssessed } from "./tenders";

/* ---------------------------------------------------------------------------
 * Mappers
 * ------------------------------------------------------------------------- */

interface AssessmentRow {
  id: string;
  tenderId: string;
  orgId: string;
  version: number;
  recommendation: string;
  mandatoryTotal: number;
  mandatoryPassed: number;
  mandatoryFailed: number;
  mandatoryUnknown: number;
  desirableScore: { toNumber(): number } | null;
  rationale: string | null;
  deadlineUsed: Date | null;
  asOfUsed: Date;
  runById: string | null;
  createdAt: Date;
}

export function toAssessment(row: AssessmentRow): Assessment {
  return {
    id: row.id,
    tenderId: row.tenderId,
    orgId: row.orgId,
    version: row.version,
    recommendation: row.recommendation as BidRecommendation,
    mandatoryTotal: row.mandatoryTotal,
    mandatoryPassed: row.mandatoryPassed,
    mandatoryFailed: row.mandatoryFailed,
    mandatoryUnknown: row.mandatoryUnknown,
    desirableScore: toNumber(row.desirableScore as never),
    rationale: row.rationale,
    deadlineUsed: row.deadlineUsed,
    asOfUsed: row.asOfUsed,
    runById: row.runById,
    createdAt: row.createdAt,
  };
}

/**
 * `contracts.EvidenceRef` → the shape the result row renders (`src/lib/types`).
 * The engine writes `source`/`detail`/`counted`; the screens on `main` read
 * `table`/`note`/`matched`. One translation, here, so neither side has two.
 */
const EVIDENCE_TABLE: Record<ContractEvidenceRef["source"], EvidenceRef["table"]> = {
  credential: "credentials",
  financial_year: "financial_years",
  insurance: "insurances",
  past_project: "past_projects",
  policy: "policies",
  organisation: "organisations",
};

function toEvidence(value: unknown): EvidenceRef[] {
  return asJsonArray(value as never).map((entry) => {
    const ref = entry as Partial<ContractEvidenceRef> & Partial<EvidenceRef>;
    const source = ref.source as ContractEvidenceRef["source"] | undefined;
    return {
      table: ref.table ?? (source ? EVIDENCE_TABLE[source] : "organisations"),
      id: ref.id ?? "",
      label: ref.label ?? "",
      note: ref.note ?? ref.detail,
      matched: ref.matched ?? ref.counted,
    };
  });
}

interface AssessmentResultRow {
  id: string;
  assessmentId: string;
  requirementId: string;
  orgId: string;
  verdict: string;
  rationale: string;
  evidence: unknown;
  warning: string | null;
  overriddenById: string | null;
  overrideNote: string | null;
  createdAt: Date;
}

export function toAssessmentResult(row: AssessmentResultRow): AssessmentResult {
  return {
    id: row.id,
    assessmentId: row.assessmentId,
    requirementId: row.requirementId,
    orgId: row.orgId,
    verdict: row.verdict as Verdict,
    rationale: row.rationale,
    evidence: toEvidence(row.evidence),
    warning: row.warning,
    overriddenById: row.overriddenById,
    overrideNote: row.overrideNote,
    createdAt: row.createdAt,
  };
}

/* ---------------------------------------------------------------------------
 * Reads
 * ------------------------------------------------------------------------- */

/** Every version, newest first — the audit tab's version list (§10.5). */
export async function listAssessments(orgId: string, tenderId: string): Promise<Assessment[]> {
  const rows = await prisma.assessment.findMany({
    where: { orgId, tenderId },
    orderBy: { version: "desc" },
  });
  return rows.map(toAssessment);
}

export async function getLatestAssessment(
  orgId: string,
  tenderId: string,
  db: Db = prisma,
): Promise<Assessment | null> {
  const row = await db.assessment.findFirst({
    where: { orgId, tenderId },
    orderBy: { version: "desc" },
  });
  return row ? toAssessment(row) : null;
}

export async function getAssessment(
  orgId: string,
  assessmentId: string,
): Promise<AssessmentWithResults | null> {
  const row = await prisma.assessment.findFirst({
    where: { id: assessmentId, orgId },
    include: { results: { orderBy: { createdAt: "asc" } } },
  });
  if (!row) return null;
  return { ...toAssessment(row), results: row.results.map(toAssessmentResult) };
}

/* ---------------------------------------------------------------------------
 * runAssessment
 * ------------------------------------------------------------------------- */

export interface RunAssessmentDeps {
  /** The pure engine, §9. Injected so this layer never imports src/lib/qualify. */
  evaluate: Evaluate;
  /** The clock the run is answerable to. Recorded on the row (§7.6). */
  asOf: Date;
  /** The user who pressed Re-run, or null for a system run. */
  runById: string | null;
}

export async function runAssessment(
  orgId: string,
  tenderId: string,
  deps: RunAssessmentDeps,
): Promise<Assessment> {
  return prisma.$transaction(
    async (tx) => {
      // Serialise concurrent runs for this tender. The lock is held until the
      // transaction ends, so version allocation and the insert are atomic
      // together — two runs cannot both compute max(version) + 1 = n.
      // `$executeRaw`, not `$queryRaw`: pg_advisory_xact_lock returns void and
      // there is no column to deserialise.
      await tx.$executeRaw`select pg_advisory_xact_lock(hashtext(${tenderId}))`;

      const tender = await tx.tender.findFirst({
        where: { id: tenderId, orgId },
        select: { id: true },
      });
      if (!tender) throw new Error("Tender not found");

      const requirements = await listEvaluableRequirements(orgId, tenderId, tx);
      if (requirements.length === 0) {
        throw new Error(
          "This tender has no requirements yet. Upload its pack and extract requirements first.",
        );
      }

      const snapshot = await getCapabilitySnapshot(orgId, tx);
      const submissionDeadline = await getSubmissionDeadline(orgId, tenderId, tx);

      const input: EvaluationInput = {
        asOf: deps.asOf,
        submissionDeadline,
        snapshot,
        requirements,
      };
      const evaluation = deps.evaluate(input);

      const highest = await tx.assessment.aggregate({
        where: { tenderId, orgId },
        _max: { version: true },
      });
      const version = (highest._max.version ?? 0) + 1;

      const assessment = await tx.assessment.create({
        data: {
          tenderId,
          orgId,
          version,
          recommendation: evaluation.recommendation,
          mandatoryTotal: evaluation.mandatoryTotal,
          mandatoryPassed: evaluation.mandatoryPassed,
          mandatoryFailed: evaluation.mandatoryFailed,
          mandatoryUnknown: evaluation.mandatoryUnknown,
          desirableScore: toDecimal(evaluation.desirableScore),
          rationale: null,
          deadlineUsed: evaluation.deadlineUsed,
          asOfUsed: evaluation.asOfUsed,
          runById: deps.runById,
        },
      });

      if (evaluation.results.length > 0) {
        await tx.assessmentResult.createMany({
          data: evaluation.results.map((result) => ({
            assessmentId: assessment.id,
            requirementId: result.requirementId,
            orgId,
            verdict: result.verdict,
            rationale: result.rationale,
            evidence: (result.evidence ?? []) as never,
            warning: result.warning ?? null,
          })),
        });
      }

      await markAssessed(tx, orgId, tenderId);

      const payload: AssessmentRunPayload = {
        version,
        recommendation: evaluation.recommendation,
        mandatoryTotal: evaluation.mandatoryTotal,
        mandatoryPassed: evaluation.mandatoryPassed,
        mandatoryFailed: evaluation.mandatoryFailed,
        mandatoryUnknown: evaluation.mandatoryUnknown,
        desirableScore: evaluation.desirableScore,
        deadlineUsed: evaluation.deadlineUsed ? evaluation.deadlineUsed.toISOString() : null,
        asOfUsed: evaluation.asOfUsed.toISOString(),
      };
      await appendEvent(tx, {
        orgId,
        actorId: deps.runById,
        actorKind: deps.runById ? "user" : "system",
        action: "assessment.run",
        subjectTable: "assessments",
        subjectId: assessment.id,
        payload: payload as unknown as Record<string, unknown>,
      });

      return toAssessment(assessment);
    },
    { timeout: 30_000, maxWait: 15_000 },
  );
}

/**
 * A human overriding one verdict (§10.5). Writes the result row, records who and
 * why, and appends one `result.overridden` event in the same transaction.
 *
 * It does **not** touch the assessment's counts. Those record what the engine
 * computed; rewriting them would make the stored verdict unexplainable later,
 * which is the whole point of Invariant 3.
 */
export async function overrideResult(
  orgId: string,
  userId: string,
  resultId: string,
  input: { verdict: Verdict; note: string },
): Promise<AssessmentResult> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.assessmentResult.findFirst({
      where: { id: resultId, orgId },
      include: { requirement: { select: { summary: true, tenderId: true } } },
    });
    if (!existing) throw new Error("Result not found");

    const updated = await tx.assessmentResult.update({
      where: { id: resultId },
      data: {
        verdict: input.verdict,
        overriddenById: userId,
        overrideNote: input.note,
      },
    });

    await appendEvent(tx, {
      orgId,
      actorId: userId,
      actorKind: "user",
      action: "result.overridden",
      subjectTable: "assessment_results",
      subjectId: resultId,
      payload: {
        tenderId: existing.requirement.tenderId,
        requirementId: existing.requirementId,
        requirementSummary: existing.requirement.summary,
        from: existing.verdict,
        to: input.verdict,
        note: input.note,
      },
    });
    return toAssessmentResult(updated);
  });
}
