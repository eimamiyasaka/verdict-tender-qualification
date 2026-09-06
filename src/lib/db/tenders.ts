/**
 * Tenders (§7.5), the pipeline (§10.1) and the tender-detail view model (§10.2).
 *
 * Every function takes `orgId` from the session (§6.3), never from a URL, a form
 * field or a request body — including `getTenderDetail`, which is reached from a
 * route parameter and therefore returns null rather than another organisation's
 * tender when the two disagree.
 */

import type {
  Assessment,
  AssessmentWithResults,
  KeyDate,
  KeyDateKind,
  PipelineRow,
  Tender,
  TenderDetail,
  TenderSource,
  TenderStatus,
} from "@/lib/types";
import { asJsonObject, prisma, toDecimal, toNumber, type Db, type Tx } from "./client";
import { toAssessment, toAssessmentResult } from "./assessments";
import { toDocument } from "./documents";
import { appendEvent, getLastProfileChangeAt } from "./events";
import { requirementSources, toRequirementWithSources } from "./requirements";

/* ---------------------------------------------------------------------------
 * The submission deadline — spec §7.5, and the one rule everything else reads.
 *
 * "The submission deadline the evaluator uses is the earliest KeyDate with
 * kind = submission_deadline for that tender. That resolution lives in exactly
 * one function, and nothing re-derives it."
 *
 * `pickSubmissionDeadline` is that function. `getSubmissionDeadline` is its
 * database-backed entry point; the pipeline and the detail view already hold the
 * tender's key dates and call the same picker over them rather than restating
 * the rule as a second query.
 * ------------------------------------------------------------------------- */

const SUBMISSION_DEADLINE_KIND = "submission_deadline" as const;

export function pickSubmissionDeadline(
  keyDates: ReadonlyArray<{ kind: string; occursAt: Date }>,
): Date | null {
  let earliest: Date | null = null;
  for (const keyDate of keyDates) {
    if (keyDate.kind !== SUBMISSION_DEADLINE_KIND) continue;
    if (earliest === null || keyDate.occursAt.getTime() < earliest.getTime()) {
      earliest = keyDate.occursAt;
    }
  }
  return earliest;
}

/** The deadline `runAssessment` evaluates against, and the one the UI shows. */
export async function getSubmissionDeadline(
  orgId: string,
  tenderId: string,
  db: Db = prisma,
): Promise<Date | null> {
  const rows = await db.keyDate.findMany({
    where: { orgId, tenderId, kind: SUBMISSION_DEADLINE_KIND },
    select: { kind: true, occursAt: true },
  });
  return pickSubmissionDeadline(rows);
}

/* ---------------------------------------------------------------------------
 * Mappers
 * ------------------------------------------------------------------------- */

interface TenderRow {
  id: string;
  orgId: string;
  title: string;
  buyerName: string | null;
  source: string | null;
  noticeReference: string | null;
  sourceUrl: string | null;
  contractValue: { toNumber(): number } | null;
  currency: string | null;
  durationMonths: number | null;
  lotReference: string | null;
  status: string;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toTender(row: TenderRow): Tender {
  return {
    id: row.id,
    orgId: row.orgId,
    title: row.title,
    buyerName: row.buyerName,
    source: row.source as TenderSource | null,
    noticeReference: row.noticeReference,
    sourceUrl: row.sourceUrl,
    // Decimal(14,2) → number in major units. Read the seam in client.ts.
    contractValue: toNumber(row.contractValue as never),
    currency: row.currency,
    durationMonths: row.durationMonths,
    lotReference: row.lotReference,
    status: row.status as TenderStatus,
    createdById: row.createdById,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toKeyDate(row: {
  id: string;
  tenderId: string;
  orgId: string;
  kind: string;
  occursAt: Date;
  documentId: string | null;
  pageNumber: number | null;
  quotedClause: string | null;
  createdAt: Date;
}): KeyDate {
  return {
    id: row.id,
    tenderId: row.tenderId,
    orgId: row.orgId,
    kind: row.kind as KeyDateKind,
    occursAt: row.occursAt,
    documentId: row.documentId,
    pageNumber: row.pageNumber,
    quotedClause: row.quotedClause,
    createdAt: row.createdAt,
  };
}

/* ---------------------------------------------------------------------------
 * Reads
 * ------------------------------------------------------------------------- */

/**
 * The pipeline (§10.1). **One query**, with the latest assessment, the earliest
 * submission deadline and the requirement count included — no N+1, and no view.
 * Sorted by submission deadline ascending; a tender with no deadline yet sorts
 * last rather than first, because an unknown date is not an urgent one.
 */
export async function listPipeline(orgId: string): Promise<PipelineRow[]> {
  const rows = await prisma.tender.findMany({
    where: { orgId },
    include: {
      assessments: { orderBy: { version: "desc" }, take: 1 },
      keyDates: {
        where: { kind: SUBMISSION_DEADLINE_KIND },
        orderBy: { occursAt: "asc" },
        take: 1,
      },
      _count: { select: { requirements: true } },
    },
  });

  return rows
    .map((row) => ({
      tender: toTender(row),
      latestAssessment: row.assessments[0] ? toAssessment(row.assessments[0]) : null,
      submissionDeadline: pickSubmissionDeadline(row.keyDates),
      requirementCount: row._count.requirements,
    }))
    .sort((a, b) => {
      if (!a.submissionDeadline && !b.submissionDeadline) {
        return b.tender.createdAt.getTime() - a.tender.createdAt.getTime();
      }
      if (!a.submissionDeadline) return 1;
      if (!b.submissionDeadline) return -1;
      return a.submissionDeadline.getTime() - b.submissionDeadline.getTime();
    });
}

export async function listTenderSummaries(
  orgId: string,
): Promise<Array<Pick<Tender, "id" | "title" | "status">>> {
  const rows = await prisma.tender.findMany({
    where: { orgId },
    select: { id: true, title: true, status: true },
    orderBy: { title: "asc" },
  });
  return rows.map((row) => ({ id: row.id, title: row.title, status: row.status as TenderStatus }));
}

export async function getTender(orgId: string, tenderId: string): Promise<Tender | null> {
  const row = await prisma.tender.findFirst({ where: { id: tenderId, orgId } });
  return row ? toTender(row) : null;
}

/**
 * Everything the four tabs render (§10.2). The requirements arrive with their
 * citations, so the drawer never queries; the results arrive for the latest
 * assessment only, because older versions are read one at a time from the audit
 * tab and loading every result of every version would grow with history.
 */
export async function getTenderDetail(orgId: string, tenderId: string): Promise<TenderDetail | null> {
  const row = await prisma.tender.findFirst({
    where: { id: tenderId, orgId },
    include: {
      documents: { orderBy: { uploadedAt: "asc" } },
      keyDates: { orderBy: { occursAt: "asc" } },
      requirements: { include: requirementSources, orderBy: { createdAt: "asc" } },
      assessments: { orderBy: { version: "desc" } },
    },
  });
  if (!row) return null;

  const versions = row.assessments.map(toAssessment);
  const latest = row.assessments[0] ?? null;
  const results = latest
    ? await prisma.assessmentResult.findMany({
        where: { assessmentId: latest.id, orgId },
        orderBy: { createdAt: "asc" },
      })
    : [];
  const latestAssessment: AssessmentWithResults | null = latest
    ? { ...toAssessment(latest), results: results.map(toAssessmentResult) }
    : null;

  const requirements = row.requirements.map((requirement) =>
    toRequirementWithSources(requirement as never),
  );

  const requirementCountByDocument: Record<string, number> = {};
  for (const requirement of requirements) {
    requirementCountByDocument[requirement.documentId] =
      (requirementCountByDocument[requirement.documentId] ?? 0) + 1;
  }

  // Failed chunks are on the extraction event, never on the document row: a
  // document that completed with one chunk missing is still complete (§8).
  const documentIds = row.documents.map((document) => document.id);
  const extractionEvents = documentIds.length
    ? await prisma.event.findMany({
        where: { orgId, action: "extraction.completed", subjectId: { in: documentIds } },
        orderBy: { createdAt: "desc" },
        select: { subjectId: true, payload: true },
      })
    : [];
  const failedChunksByDocument: Record<string, number> = {};
  for (const event of extractionEvents) {
    if (!event.subjectId || event.subjectId in failedChunksByDocument) continue;
    const payload = asJsonObject(event.payload as never);
    failedChunksByDocument[event.subjectId] = Number(
      payload.chunksFailed ?? payload.failedChunks ?? 0,
    );
  }

  const profileChangedAt = await getLastProfileChangeAt(orgId);
  const keyDates = row.keyDates.map(toKeyDate);

  return {
    tender: toTender(row),
    documents: row.documents.map(toDocument),
    keyDates,
    requirements,
    latestAssessment,
    assessmentVersions: versions,
    submissionDeadline: pickSubmissionDeadline(keyDates),
    clarificationDeadline:
      keyDates.find((keyDate) => keyDate.kind === "clarification_deadline")?.occursAt ?? null,
    profileChangedSinceAssessment: Boolean(
      latest && profileChangedAt && profileChangedAt > latest.createdAt,
    ),
    requirementCountByDocument,
    failedChunksByDocument,
  };
}

/* ---------------------------------------------------------------------------
 * Writes — each one transaction, each one event (§7.7).
 * ------------------------------------------------------------------------- */

export interface NewTenderInput {
  title: string;
  buyerName: string | null;
  source: TenderSource | null;
  noticeReference: string | null;
  sourceUrl: string | null;
  contractValue: number | null;
  currency: string | null;
  durationMonths: number | null;
  lotReference: string | null;
  submissionDeadline: Date | null;
  clarificationDeadline: Date | null;
}

export async function createTender(
  orgId: string,
  userId: string,
  input: NewTenderInput,
): Promise<Tender> {
  return prisma.$transaction(async (tx) => {
    const keyDates: Array<{ kind: KeyDateKind; occursAt: Date }> = [];
    if (input.submissionDeadline) {
      keyDates.push({ kind: "submission_deadline", occursAt: input.submissionDeadline });
    }
    if (input.clarificationDeadline) {
      keyDates.push({ kind: "clarification_deadline", occursAt: input.clarificationDeadline });
    }

    const tender = await tx.tender.create({
      data: {
        orgId,
        title: input.title,
        buyerName: input.buyerName,
        source: input.source,
        noticeReference: input.noticeReference,
        sourceUrl: input.sourceUrl,
        contractValue: toDecimal(input.contractValue),
        currency: input.currency ?? "GBP",
        durationMonths: input.durationMonths,
        lotReference: input.lotReference,
        status: "draft",
        createdById: userId,
        keyDates: { create: keyDates.map((keyDate) => ({ ...keyDate, orgId })) },
      },
    });

    await appendEvent(tx, {
      orgId,
      actorId: userId,
      actorKind: "user",
      action: "tender.created",
      subjectTable: "tenders",
      subjectId: tender.id,
      payload: { tenderId: tender.id, title: tender.title, source: tender.source },
    });
    return toTender(tender);
  });
}

/**
 * Marking a tender as a bid turns its ITT questions into workspace tasks (§10.2)
 * — one state change, one event, one transaction. The tasks are part of the
 * status change rather than N separate writes, and the count goes on the event
 * so the audit log explains where they came from.
 */
export async function updateTenderStatus(
  orgId: string,
  userId: string,
  tenderId: string,
  status: TenderStatus,
): Promise<Tender> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.tender.findFirst({ where: { id: tenderId, orgId } });
    if (!existing) throw new Error("Tender not found");
    const from = existing.status;

    const tender = await tx.tender.update({ where: { id: tenderId }, data: { status } });
    const tasksCreated = status === "bidding" ? await createTasksForQuestions(tx, orgId, tenderId) : 0;

    await appendEvent(tx, {
      orgId,
      actorId: userId,
      actorKind: "user",
      action: "tender.status_changed",
      subjectTable: "tenders",
      subjectId: tenderId,
      payload: {
        tenderId,
        from,
        to: status,
        ...(tasksCreated > 0 ? { tasksCreated } : {}),
      },
    });
    return toTender(tender);
  });
}

/** One task per ITT question that does not have one yet. Idempotent. */
async function createTasksForQuestions(tx: Tx, orgId: string, tenderId: string): Promise<number> {
  const questions = await tx.requirement.findMany({
    where: { orgId, tenderId, kind: "question", bidTasks: { none: {} } },
    select: { id: true, summary: true },
    orderBy: { createdAt: "asc" },
  });
  if (questions.length === 0) return 0;
  const created = await tx.bidTask.createMany({
    data: questions.map((question) => ({
      tenderId,
      orgId,
      requirementId: question.id,
      title: question.summary,
      status: "not_started" as const,
    })),
  });
  return created.count;
}

/** Kept for the assessment path, which sets `assessed` without a user action. */
export async function markAssessed(tx: Tx, orgId: string, tenderId: string): Promise<void> {
  const tender = await tx.tender.findFirst({ where: { id: tenderId, orgId }, select: { status: true } });
  if (!tender) return;
  if (tender.status === "draft" || tender.status === "extracted" || tender.status === "assessed") {
    await tx.tender.update({ where: { id: tenderId }, data: { status: "assessed" } });
  }
}

export type { Assessment };
