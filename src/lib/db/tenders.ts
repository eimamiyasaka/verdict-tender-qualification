/**
 * Tenders (§7.5) and the pipeline / tender-detail view models.
 *
 * Every function takes `orgId` from the session (§6.3), never from a URL or
 * form field. Prisma seam: each body becomes one query with the relations
 * included — the pipeline is one query with the latest assessment, no N+1.
 */
import type {
  AssessmentWithResults,
  PipelineRow,
  Tender,
  TenderDetail,
  TenderSource,
  TenderStatus,
} from "@/lib/types";
import { appendEvent, clone, getStore, newId } from "./_placeholder/store";

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

/**
 * The submission deadline the evaluator uses: the earliest KeyDate of kind
 * submission_deadline. This is the only place that resolution lives (§7.5).
 */
export async function getSubmissionDeadline(orgId: string, tenderId: string): Promise<Date | null> {
  const store = getStore();
  const dates = store.keyDates
    .filter((k) => k.orgId === orgId && k.tenderId === tenderId && k.kind === "submission_deadline")
    .sort((a, b) => a.occursAt.getTime() - b.occursAt.getTime());
  return dates[0] ? new Date(dates[0].occursAt) : null;
}

function latestAssessmentFor(orgId: string, tenderId: string) {
  const store = getStore();
  return store.assessments
    .filter((a) => a.orgId === orgId && a.tenderId === tenderId)
    .sort((a, b) => b.version - a.version)[0];
}

function lastProfileChangeAt(orgId: string): Date | null {
  const store = getStore();
  const events = store.events.filter((e) => e.orgId === orgId && e.action === "profile.updated");
  if (events.length === 0) return null;
  return events.reduce((max, e) => (e.createdAt > max ? e.createdAt : max), events[0].createdAt);
}

export async function listPipeline(orgId: string): Promise<PipelineRow[]> {
  const store = getStore();
  const rows: PipelineRow[] = [];
  for (const tender of store.tenders) {
    if (tender.orgId !== orgId) continue;
    const latest = latestAssessmentFor(orgId, tender.id);
    rows.push({
      tender: clone(tender),
      latestAssessment: latest ? clone(latest) : null,
      submissionDeadline: await getSubmissionDeadline(orgId, tender.id),
      requirementCount: store.requirements.filter((r) => r.tenderId === tender.id).length,
    });
  }
  // Sorted by submission deadline ascending; tenders without a deadline last.
  return rows.sort((a, b) => {
    if (!a.submissionDeadline && !b.submissionDeadline) return b.tender.createdAt.getTime() - a.tender.createdAt.getTime();
    if (!a.submissionDeadline) return 1;
    if (!b.submissionDeadline) return -1;
    return a.submissionDeadline.getTime() - b.submissionDeadline.getTime();
  });
}

export async function getTenderDetail(orgId: string, tenderId: string): Promise<TenderDetail | null> {
  const store = getStore();
  const tender = store.tenders.find((t) => t.id === tenderId && t.orgId === orgId);
  if (!tender) return null;

  const documents = store.documents.filter((d) => d.tenderId === tenderId).sort((a, b) => a.uploadedAt.getTime() - b.uploadedAt.getTime());
  const docById = new Map(documents.map((d) => [d.id, d]));
  const requirements = store.requirements
    .filter((r) => r.tenderId === tenderId)
    .map((r) => ({
      ...clone(r),
      document: clone(docById.get(r.documentId)!),
      citations: store.citations
        .filter((c) => c.requirementId === r.id)
        .map((c) => ({ ...clone(c), document: clone(docById.get(c.documentId)!) })),
    }));

  const versions = store.assessments
    .filter((a) => a.tenderId === tenderId && a.orgId === orgId)
    .sort((a, b) => b.version - a.version);
  const latest = versions[0];
  const latestAssessment: AssessmentWithResults | null = latest
    ? { ...clone(latest), results: clone(store.results.filter((r) => r.assessmentId === latest.id)) }
    : null;

  const keyDates = store.keyDates.filter((k) => k.tenderId === tenderId).sort((a, b) => a.occursAt.getTime() - b.occursAt.getTime());
  const clarification = keyDates.find((k) => k.kind === "clarification_deadline");

  const requirementCountByDocument: Record<string, number> = {};
  for (const r of requirements) {
    requirementCountByDocument[r.documentId] = (requirementCountByDocument[r.documentId] ?? 0) + 1;
  }
  const failedChunksByDocument: Record<string, number> = {};
  for (const e of store.events) {
    if (e.action === "extraction.completed" && e.subjectTable === "tender_documents" && e.subjectId && docById.has(e.subjectId)) {
      failedChunksByDocument[e.subjectId] = Number(e.payload.failedChunks ?? 0);
    }
  }

  const profileChangedAt = lastProfileChangeAt(orgId);
  return {
    tender: clone(tender),
    documents: clone(documents),
    keyDates: clone(keyDates),
    requirements,
    latestAssessment,
    assessmentVersions: clone(versions),
    submissionDeadline: await getSubmissionDeadline(orgId, tenderId),
    clarificationDeadline: clarification ? new Date(clarification.occursAt) : null,
    profileChangedSinceAssessment: Boolean(latest && profileChangedAt && profileChangedAt > latest.createdAt),
    requirementCountByDocument,
    failedChunksByDocument,
  };
}

export async function listTenderSummaries(orgId: string): Promise<Array<Pick<Tender, "id" | "title" | "status">>> {
  return getStore()
    .tenders.filter((t) => t.orgId === orgId)
    .map((t) => ({ id: t.id, title: t.title, status: t.status }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

export async function createTender(orgId: string, userId: string, input: NewTenderInput): Promise<Tender> {
  const store = getStore();
  const now = new Date();
  const tender: Tender = {
    id: newId(),
    orgId,
    title: input.title,
    buyerName: input.buyerName,
    source: input.source,
    noticeReference: input.noticeReference,
    sourceUrl: input.sourceUrl,
    contractValue: input.contractValue,
    currency: input.currency ?? "GBP",
    durationMonths: input.durationMonths,
    lotReference: input.lotReference,
    status: "draft",
    createdById: userId,
    createdAt: now,
    updatedAt: now,
  };
  store.tenders.push(tender);
  if (input.submissionDeadline) {
    store.keyDates.push({
      id: newId(),
      tenderId: tender.id,
      orgId,
      kind: "submission_deadline",
      occursAt: input.submissionDeadline,
      documentId: null,
      pageNumber: null,
      quotedClause: null,
      createdAt: now,
    });
  }
  if (input.clarificationDeadline) {
    store.keyDates.push({
      id: newId(),
      tenderId: tender.id,
      orgId,
      kind: "clarification_deadline",
      occursAt: input.clarificationDeadline,
      documentId: null,
      pageNumber: null,
      quotedClause: null,
      createdAt: now,
    });
  }
  appendEvent(store, {
    orgId,
    actorId: userId,
    actorKind: "user",
    action: "tender.created",
    subjectTable: "tenders",
    subjectId: tender.id,
    payload: { tenderId: tender.id, title: tender.title, source: tender.source },
  });
  return clone(tender);
}

export async function updateTenderStatus(
  orgId: string,
  userId: string,
  tenderId: string,
  status: TenderStatus,
): Promise<Tender> {
  const store = getStore();
  const tender = store.tenders.find((t) => t.id === tenderId && t.orgId === orgId);
  if (!tender) throw new Error("Tender not found");
  const from = tender.status;
  tender.status = status;
  tender.updatedAt = new Date();

  // Marking a tender as a bid turns its ITT questions into workspace tasks.
  if (status === "bidding") {
    for (const req of store.requirements.filter((r) => r.tenderId === tenderId && r.kind === "question")) {
      const exists = store.tasks.some((t) => t.requirementId === req.id);
      if (!exists) {
        const now = new Date();
        store.tasks.push({
          id: newId(),
          tenderId,
          orgId,
          requirementId: req.id,
          title: req.summary,
          assigneeId: null,
          status: "not_started",
          dueOn: null,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  }
  appendEvent(store, {
    orgId,
    actorId: userId,
    actorKind: "user",
    action: "tender.status_changed",
    subjectTable: "tenders",
    subjectId: tenderId,
    payload: { tenderId, from, to: status },
  });
  return clone(tender);
}
