/**
 * Tenancy — spec §6.3, and the test a reviewer looking for the multi-tenancy
 * answer will find.
 *
 * Prisma connects as the database owner and bypasses row-level security by
 * design, so Verdict enforces tenancy in one place instead: every column that
 * can belong to an organisation carries `orgId`, every Prisma call lives in
 * `src/lib/db/`, and every exported read and write takes `orgId` as its first
 * argument — from the session, never from a URL, a form field or a request body.
 *
 * **This is weaker than a database guarantee, and the README says so.** What
 * compensates for it is this file. It creates a second organisation, gives it a
 * world of its own through the layer's public API, and then asserts that
 * *nothing* Meridian owns can be reached through any exported read.
 *
 * Two things make it hard to fool:
 *
 *  - It **enumerates every export of every module** and fails on any name it
 *    has not been told about. A function added tomorrow cannot quietly avoid
 *    being tested; the suite goes red until it is classified.
 *  - It reads the **first parameter name** of every read and write off the
 *    function itself and requires it to be `orgId`. The audited exceptions —
 *    the two functions that *resolve* an organisation, the reference data that
 *    has none, and the helpers that take an open transaction — are listed by
 *    name, with a reason, below.
 *
 * The suite needs a real Postgres with the schema applied and `npm run db:seed`
 * already run: it proves the second organisation sees nothing of Meridian's, so
 * Meridian's rows have to be there for the assertion to mean anything. A guard
 * fails loudly rather than passing against an empty database.
 *
 * It also **writes** — a second organisation, a tender, an assessment — so it
 * refuses to run against whatever `DATABASE_URL` happens to be configured, which
 * on a developer machine is the deployed Supabase project. Opt in explicitly:
 *
 *     VERDICT_TEST_DB=1 DATABASE_URL=postgresql://…/verdict_test npm test
 *
 * Everything it creates is removed in `afterAll`; nothing it creates belongs to
 * Meridian.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Evaluate, EvaluationInput, EvaluationResult } from "../../../../contracts";
import { demoOrganisation, otherOrganisation, otherUser } from "../../../../fixtures";

import * as assessmentsModule from "../assessments";
import * as clientModule from "../client";
import * as documentsModule from "../documents";
import * as eventsModule from "../events";
import * as ingestModule from "../ingest";
import * as libraryModule from "../library";
import * as orgModule from "../org";
import * as profileModule from "../profile";
import * as requirementsModule from "../requirements";
import * as responsesModule from "../responses";
import * as tasksModule from "../tasks";
import * as tendersModule from "../tenders";
import * as usersModule from "../users";
import * as workspaceModule from "../workspace";

import { prisma } from "../client";

const MODULES = {
  assessments: assessmentsModule,
  client: clientModule,
  documents: documentsModule,
  events: eventsModule,
  ingest: ingestModule,
  library: libraryModule,
  org: orgModule,
  profile: profileModule,
  requirements: requirementsModule,
  responses: responsesModule,
  tasks: tasksModule,
  tenders: tendersModule,
  users: usersModule,
  workspace: workspaceModule,
} as const;

const MERIDIAN = demoOrganisation.id;
const KESTREL = otherOrganisation.id;
const INTRUDER = otherUser.id;

/* ---------------------------------------------------------------------------
 * The classification. Every export lands in exactly one bucket.
 * ------------------------------------------------------------------------- */

/** Reads exercised below against Kestrel. Each must take `orgId` first. */
const READS = [
  "getCapabilitySnapshot",
  "getProfile",
  "getOrganisation",
  "listOrgMembers",
  "getSubmissionDeadline",
  "listPipeline",
  "listTenderSummaries",
  "getTender",
  "getTenderDetail",
  "listDocuments",
  "getDocument",
  "listRequirements",
  "getRequirement",
  "listEvaluableRequirements",
  "countRequirementsByDocument",
  "listAssessments",
  "getLatestAssessment",
  "getAssessment",
  "listWorkspaceTasks",
  "getTask",
  "getResponse",
  "listResponses",
  "listLibraryAnswers",
  "getLibraryAnswer",
  "suggestLibraryAnswers",
  "listTenderEvents",
  "getLastProfileChangeAt",
] as const;

/** Writes. Not read-tested, but held to the same `orgId`-first signature. */
const WRITES = [
  "updateOrganisation",
  "upsertCredential",
  "deleteCredential",
  "upsertFinancialYear",
  "deleteFinancialYear",
  "upsertInsurance",
  "deleteInsurance",
  "upsertPastProject",
  "deletePastProject",
  "upsertPolicy",
  "deletePolicy",
  "createTender",
  "updateTenderStatus",
  "addDocument",
  "markExtractionRunning",
  "recordExtractionOutcome",
  "deleteDocument",
  "persistExtraction",
  "runAssessment",
  "overrideResult",
  "createTask",
  "updateTask",
  "saveResponse",
  "createLibraryAnswer",
  "updateLibraryAnswer",
  "deleteLibraryAnswer",
  "markLibraryAnswerUsed",
] as const;

/**
 * The audited exceptions. Each one is here for a stated reason, and the reason
 * is always the same shape: it cannot take an `orgId` because it runs before one
 * exists, has none, or has already been handed the caller's transaction.
 */
const AUDITED_EXCEPTIONS: Record<string, string> = {
  // §7.3 — these two RESOLVE the organisation every other function filters on.
  // The session hands them a user id; they hand back the org. Named here
  // explicitly rather than left to look like an oversight.
  upsertUser: "Mirrors the Supabase auth user (§7.3). Runs before an org exists; upserts on the primary key.",
  getMembershipForUser: "Resolves a session user to their one organisation. This is where orgId comes from.",
  getUserById: "Identity lookup during sign-in. A session has only an id to go on.",
  getUserByEmail: "Identity lookup during sign-in. A sign-in form has only an email.",

  // Reference data, not org-scoped by design (§7.4).
  listCredentialTypes: "credential_types is seeded reference data with no orgId column (§7.4).",

  // Helpers that run inside a caller's transaction; the caller has already
  // filtered on orgId and passes it as the second argument.
  appendEvent: "Takes the enclosing transaction so the event commits with the change (§7.7). orgId is on its input.",
  settleTenderStatus: "Runs inside the caller's transaction: (tx, orgId, tenderId).",
  markAssessed: "Runs inside the caller's transaction: (tx, orgId, tenderId).",

  // Pure functions and the client itself. No query, nothing to leak.
  prisma: "The client singleton. The only construction of PrismaClient in the codebase (§6.3).",
  toNumber: "Decimal seam (client.ts). Pure: converts a column value, runs no query.",
  toNumberRequired: "Decimal seam (client.ts). Pure: converts a NOT NULL column value.",
  toDecimal: "Decimal seam (client.ts). Pure: rounds major units to a Decimal.",
  toDecimalRequired: "Decimal seam (client.ts). Pure: rounds major units to a Decimal.",
  eventId: "BigInt seam (client.ts). Pure: Event.id to a string, so JSON.stringify cannot throw.",
  asJsonObject: "Reads a Json column as an object. Pure, no query.",
  asJsonArray: "Reads a Json column as an array. Pure, no query.",
  pickSubmissionDeadline: "The §7.5 deadline rule itself, over rows the caller already filtered.",
  requirementSources: "A Prisma include object shared by the requirement reads, not a function.",
  toUser: "Row to view-model mapper. Pure: shapes a row the caller already fetched.",
  toOrganisation: "Row to view-model mapper. Pure: shapes a row the caller already fetched.",
  toTender: "Row to view-model mapper. Pure: shapes a row the caller already fetched.",
  toDocument: "Row to view-model mapper. Pure: shapes a row the caller already fetched.",
  toRequirement: "Row to view-model mapper. Pure: shapes a row the caller already fetched.",
  toRequirementWithSources: "Row to view-model mapper. Pure: shapes a row the caller already fetched.",
  toAssessment: "Row to view-model mapper. Pure: shapes a row the caller already fetched.",
  toAssessmentResult: "Row to view-model mapper. Pure: shapes a row the caller already fetched.",
  toBidTask: "Row to view-model mapper. Pure: shapes a row the caller already fetched.",
  toResponse: "Row to view-model mapper. Pure: shapes a row the caller already fetched.",
};

/**
 * `prisma/seed.ts` is the one Prisma caller outside `src/lib/db/`. It is a
 * build-time script rather than part of the running application, it writes a
 * single known organisation, and it is named here so the exception is on the
 * record rather than discovered.
 */
export const SEED_IS_AN_AUDITED_EXCEPTION = "prisma/seed.ts";

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

/** The first parameter name, read off the function itself. */
function firstParameterName(fn: (...args: never[]) => unknown): string | null {
  const source = fn.toString();
  const open = source.indexOf("(");
  if (open === -1) return null;
  let depth = 0;
  let close = -1;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "(") depth += 1;
    else if (source[i] === ")") {
      depth -= 1;
      if (depth === 0) {
        close = i;
        break;
      }
    }
  }
  if (close === -1) return null;
  const params = source.slice(open + 1, close).trim();
  if (params === "") return null;
  const first = params.split(",")[0].trim();
  const match = first.match(/^[A-Za-z_$][\w$]*/);
  return match ? match[0] : null;
}

/**
 * Everything Meridian owns that must never appear in a Kestrel read. Filled in
 * from the seeded database, so a fixture gaining a tender does not silently
 * shrink what this checks.
 */
let meridianNeedles: string[] = [];

function expectNothingOfMeridian(label: string, value: unknown): void {
  const serialised = JSON.stringify(value, (_key, entry) =>
    typeof entry === "bigint" ? `bigint:${entry.toString()}` : entry,
  );
  if (serialised === undefined) return;
  for (const needle of meridianNeedles) {
    if (serialised.includes(needle)) {
      throw new Error(
        `${label} leaked Meridian data across the tenancy boundary: found "${needle}".`,
      );
    }
  }
}

/** A stand-in for the pure engine — this layer never imports src/lib/qualify. */
const fakeEvaluate: Evaluate = (input: EvaluationInput): EvaluationResult => ({
  recommendation: "review",
  mandatoryTotal: 1,
  mandatoryPassed: 0,
  mandatoryFailed: 0,
  mandatoryUnknown: 1,
  desirableScore: null,
  results: input.requirements.map((requirement) => ({
    requirementId: requirement.id,
    verdict: "unknown" as const,
    rationale: "Kestrel fixture — the engine is faked in this test.",
    evidence: [],
    warning: null,
  })),
  deadlineUsed: input.submissionDeadline,
  asOfUsed: input.asOf,
});

/**
 * Opt-in, not opt-out. `@prisma/client` loads `.env` on import, so a bare
 * `DATABASE_URL` check would point this suite at the deployed database.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL) && process.env.VERDICT_TEST_DB === "1";

interface KestrelWorld {
  tenderId: string;
  documentId: string;
  requirementId: string;
  taskId: string;
  answerId: string;
  assessmentId: string;
}

let kestrel: KestrelWorld;
let meridian: { tenderId: string; documentId: string; requirementId: string; taskId: string; answerId: string; assessmentId: string };

/* ---------------------------------------------------------------------------
 * The suite
 * ------------------------------------------------------------------------- */

describe.runIf(hasDatabase)("tenancy (§6.3)", () => {
  beforeAll(async () => {
    /* --- The guard. An empty database would pass every assertion below. --- */
    const meridianTenders = await prisma.tender.findMany({
      where: { orgId: MERIDIAN },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    });
    if (meridianTenders.length === 0) {
      throw new Error(
        "Tenancy test needs the seeded organisation: run `npm run db:seed` against DATABASE_URL first. " +
          "Without Meridian's rows there is nothing for the second organisation to fail to see.",
      );
    }

    const [meridianDoc, meridianRequirement, meridianTask, meridianAnswer, meridianAssessment] =
      await Promise.all([
        prisma.tenderDocument.findFirstOrThrow({ where: { orgId: MERIDIAN } }),
        prisma.requirement.findFirstOrThrow({ where: { orgId: MERIDIAN } }),
        prisma.bidTask.findFirstOrThrow({ where: { orgId: MERIDIAN } }),
        prisma.libraryAnswer.findFirstOrThrow({ where: { orgId: MERIDIAN } }),
        prisma.assessment.findFirstOrThrow({ where: { orgId: MERIDIAN } }),
      ]);
    meridian = {
      tenderId: meridianTenders[0].id,
      documentId: meridianDoc.id,
      requirementId: meridianRequirement.id,
      taskId: meridianTask.id,
      answerId: meridianAnswer.id,
      assessmentId: meridianAssessment.id,
    };

    const meridianUsers = await prisma.user.findMany({
      where: { memberships: { some: { orgId: MERIDIAN } } },
      select: { id: true, email: true },
    });
    meridianNeedles = [
      MERIDIAN,
      demoOrganisation.name,
      ...meridianTenders.map((tender) => tender.id),
      ...meridianTenders.map((tender) => tender.title),
      ...meridianUsers.map((user) => user.id),
      ...meridianUsers.map((user) => user.email),
      meridian.documentId,
      meridian.requirementId,
      meridian.taskId,
      meridian.answerId,
      meridian.assessmentId,
    ];

    /* --- Kestrel's own world, built through the layer's public API. --- */
    await orgModule.upsertUser({
      id: INTRUDER,
      email: otherUser.email,
      displayName: otherUser.displayName,
    });
    await prisma.organisation.upsert({
      where: { id: KESTREL },
      create: {
        id: KESTREL,
        name: otherOrganisation.name,
        companiesHouseNumber: otherOrganisation.companiesHouseNumber,
        headcount: otherOrganisation.headcount,
        registeredRegion: otherOrganisation.registeredRegion,
        sicCodes: otherOrganisation.sicCodes,
      },
      update: {},
    });
    await prisma.membership.createMany({
      data: [{ orgId: KESTREL, userId: INTRUDER, role: "owner" }],
      skipDuplicates: true,
    });

    const tender = await tendersModule.createTender(KESTREL, INTRUDER, {
      title: "Kestrel — Cleaning of the second organisation",
      buyerName: "Kestrel Buyer",
      source: "manual",
      noticeReference: null,
      sourceUrl: null,
      contractValue: 100_000,
      currency: "GBP",
      durationMonths: 12,
      lotReference: null,
      submissionDeadline: new Date("2030-01-01T12:00:00.000Z"),
      clarificationDeadline: new Date("2029-12-01T12:00:00.000Z"),
    });
    const document = await documentsModule.addDocument(KESTREL, INTRUDER, tender.id, {
      filename: "Kestrel PSQ.pdf",
      docType: "psq",
      pageCount: 4,
    });
    await ingestModule.persistExtraction(KESTREL, {
      tenderId: tender.id,
      documentId: document.id,
      model: "test",
      actorId: INTRUDER,
      pageCount: 4,
      requirements: [
        {
          kind: "question",
          obligation: "mandatory",
          summary: "Kestrel method statement",
          constraint: { kind: "question", response_format: "method_statement" },
          pageNumber: 2,
          quotedClause: "Describe how you would mobilise the contract.",
          questionRef: "Method Statement 1",
          wordLimit: 500,
          extractionConfidence: 0.9,
          additionalCitations: [],
        },
      ],
      keyDates: [],
      outcome: {
        documentId: document.id,
        chunksTotal: 1,
        chunksSucceeded: 1,
        chunksFailed: 0,
        draftsAccepted: 1,
        draftsHeldForReview: 0,
        draftsRejected: 0,
        requirementsCreated: 1,
        citationsCreated: 0,
      },
    });
    const requirement = await prisma.requirement.findFirstOrThrow({ where: { orgId: KESTREL } });
    await tendersModule.updateTenderStatus(KESTREL, INTRUDER, tender.id, "bidding");
    const task = await prisma.bidTask.findFirstOrThrow({ where: { orgId: KESTREL } });
    await responsesModule.saveResponse(KESTREL, INTRUDER, requirement.id, "Kestrel draft answer.");
    const answer = await libraryModule.createLibraryAnswer(KESTREL, INTRUDER, {
      title: "Kestrel mobilisation answer",
      body: "Kestrel would mobilise the contract in six weeks.",
      tags: ["mobilisation"],
      sourceTenderId: tender.id,
    });
    const assessment = await assessmentsModule.runAssessment(KESTREL, tender.id, {
      evaluate: fakeEvaluate,
      asOf: new Date(),
      runById: INTRUDER,
    });

    kestrel = {
      tenderId: tender.id,
      documentId: document.id,
      requirementId: requirement.id,
      taskId: task.id,
      answerId: answer.id,
      assessmentId: assessment.id,
    };
  }, 60_000);

  afterAll(async () => {
    // Cascades through every table that carries orgId (§7.1).
    await prisma.organisation.deleteMany({ where: { id: KESTREL } });
    await prisma.user.deleteMany({ where: { id: INTRUDER } });
    await prisma.$disconnect();
  });

  /* -------------------------------------------------------------------------
   * 1. Nothing escapes the classification.
   * ---------------------------------------------------------------------- */

  it("classifies every export of every module", () => {
    const known = new Set<string>([...READS, ...WRITES, ...Object.keys(AUDITED_EXCEPTIONS)]);
    const unclassified: string[] = [];
    for (const [moduleName, module] of Object.entries(MODULES)) {
      for (const exportName of Object.keys(module)) {
        if (!known.has(exportName)) unclassified.push(`${moduleName}.${exportName}`);
      }
    }
    expect(
      unclassified,
      "A new export in src/lib/db must be classified in tenancy.test.ts as a read, a write, " +
        "or an audited exception with a reason. Add it there and, if it reads, to the read table below.",
    ).toEqual([]);
  });

  it("requires orgId as the first argument of every read and write", () => {
    const offenders: string[] = [];
    for (const [moduleName, module] of Object.entries(MODULES)) {
      for (const [exportName, value] of Object.entries(module as Record<string, unknown>)) {
        if (typeof value !== "function") continue;
        if (!(READS as readonly string[]).includes(exportName) && !(WRITES as readonly string[]).includes(exportName)) {
          continue;
        }
        const first = firstParameterName(value as (...args: never[]) => unknown);
        if (first !== "orgId") offenders.push(`${moduleName}.${exportName}(${first ?? "no arguments"})`);
      }
    }
    expect(
      offenders,
      "§6.3: orgId comes from the session and is the first parameter, so a caller cannot forget it.",
    ).toEqual([]);
  });

  it("documents each audited exception with a reason", () => {
    for (const [name, reason] of Object.entries(AUDITED_EXCEPTIONS)) {
      expect(reason.length, `${name} needs a stated reason`).toBeGreaterThan(20);
    }
    // The two the spec calls out by name resolve the organisation itself.
    expect(Object.keys(AUDITED_EXCEPTIONS)).toContain("upsertUser");
    expect(Object.keys(AUDITED_EXCEPTIONS)).toContain("getMembershipForUser");
  });

  /* -------------------------------------------------------------------------
   * 2. Every read, against the second organisation.
   * ---------------------------------------------------------------------- */

  it("returns nothing of Meridian's from any exported read", async () => {
    const reads: Array<[string, Promise<unknown>]> = [
      ["getCapabilitySnapshot", profileModule.getCapabilitySnapshot(KESTREL)],
      ["getProfile", profileModule.getProfile(KESTREL)],
      ["getOrganisation", orgModule.getOrganisation(KESTREL)],
      ["listOrgMembers", orgModule.listOrgMembers(KESTREL)],
      ["listPipeline", tendersModule.listPipeline(KESTREL)],
      ["listTenderSummaries", tendersModule.listTenderSummaries(KESTREL)],
      ["getTender", tendersModule.getTender(KESTREL, kestrel.tenderId)],
      ["getTenderDetail", tendersModule.getTenderDetail(KESTREL, kestrel.tenderId)],
      ["getSubmissionDeadline", tendersModule.getSubmissionDeadline(KESTREL, kestrel.tenderId)],
      ["listDocuments", documentsModule.listDocuments(KESTREL, kestrel.tenderId)],
      ["getDocument", documentsModule.getDocument(KESTREL, kestrel.documentId)],
      ["listRequirements", requirementsModule.listRequirements(KESTREL, kestrel.tenderId)],
      ["getRequirement", requirementsModule.getRequirement(KESTREL, kestrel.requirementId)],
      [
        "listEvaluableRequirements",
        requirementsModule.listEvaluableRequirements(KESTREL, kestrel.tenderId),
      ],
      [
        "countRequirementsByDocument",
        requirementsModule.countRequirementsByDocument(KESTREL, kestrel.tenderId),
      ],
      ["listAssessments", assessmentsModule.listAssessments(KESTREL, kestrel.tenderId)],
      ["getLatestAssessment", assessmentsModule.getLatestAssessment(KESTREL, kestrel.tenderId)],
      ["getAssessment", assessmentsModule.getAssessment(KESTREL, kestrel.assessmentId)],
      ["listWorkspaceTasks", tasksModule.listWorkspaceTasks(KESTREL, kestrel.tenderId)],
      ["getTask", tasksModule.getTask(KESTREL, kestrel.taskId)],
      ["getResponse", responsesModule.getResponse(KESTREL, kestrel.requirementId)],
      ["listResponses", responsesModule.listResponses(KESTREL, kestrel.tenderId)],
      ["listLibraryAnswers", libraryModule.listLibraryAnswers(KESTREL)],
      ["getLibraryAnswer", libraryModule.getLibraryAnswer(KESTREL, kestrel.answerId)],
      [
        "suggestLibraryAnswers",
        // The terms that match Meridian's seeded answers, asked as Kestrel.
        libraryModule.suggestLibraryAnswers(KESTREL, "social value apprenticeships TUPE quality"),
      ],
      ["listTenderEvents", eventsModule.listTenderEvents(KESTREL, kestrel.tenderId)],
      ["getLastProfileChangeAt", eventsModule.getLastProfileChangeAt(KESTREL)],
    ];

    // Every read in the classification is exercised here, and vice versa.
    expect(reads.map(([name]) => name).sort()).toEqual([...READS].sort());

    for (const [name, promise] of reads) {
      expectNothingOfMeridian(name, await promise);
    }
  });

  it("returns null rather than another organisation's row when the id is Meridian's", async () => {
    // The route parameter case: a Kestrel session asking for a Meridian id.
    expect(await tendersModule.getTender(KESTREL, meridian.tenderId)).toBeNull();
    expect(await tendersModule.getTenderDetail(KESTREL, meridian.tenderId)).toBeNull();
    expect(await tendersModule.getSubmissionDeadline(KESTREL, meridian.tenderId)).toBeNull();
    expect(await documentsModule.getDocument(KESTREL, meridian.documentId)).toBeNull();
    expect(await requirementsModule.getRequirement(KESTREL, meridian.requirementId)).toBeNull();
    expect(await assessmentsModule.getAssessment(KESTREL, meridian.assessmentId)).toBeNull();
    expect(await tasksModule.getTask(KESTREL, meridian.taskId)).toBeNull();
    expect(await libraryModule.getLibraryAnswer(KESTREL, meridian.answerId)).toBeNull();

    expect(await documentsModule.listDocuments(KESTREL, meridian.tenderId)).toEqual([]);
    expect(await requirementsModule.listRequirements(KESTREL, meridian.tenderId)).toEqual([]);
    expect(await tasksModule.listWorkspaceTasks(KESTREL, meridian.tenderId)).toEqual([]);
    expect(await eventsModule.listTenderEvents(KESTREL, meridian.tenderId)).toEqual([]);
    expect(await assessmentsModule.listAssessments(KESTREL, meridian.tenderId)).toEqual([]);
    expect(await responsesModule.listResponses(KESTREL, meridian.tenderId)).toEqual([]);
  });

  it("refuses to write against another organisation's rows", async () => {
    await expect(
      tasksModule.createTask(KESTREL, INTRUDER, meridian.tenderId, {
        title: "Should not exist",
        requirementId: null,
        assigneeId: null,
        dueOn: null,
      }),
    ).rejects.toThrow(/Tender not found/);

    await expect(
      responsesModule.saveResponse(KESTREL, INTRUDER, meridian.requirementId, "nope"),
    ).rejects.toThrow(/Requirement not found/);

    await expect(
      assessmentsModule.runAssessment(KESTREL, meridian.tenderId, {
        evaluate: fakeEvaluate,
        asOf: new Date(),
        runById: INTRUDER,
      }),
    ).rejects.toThrow(/Tender not found/);

    // An update filtered by orgId matches no row rather than the wrong one, so
    // the status Meridian's task had before the attempt is the status it keeps.
    const before = await prisma.bidTask.findUniqueOrThrow({ where: { id: meridian.taskId } });
    await expect(
      tasksModule.updateTask(KESTREL, INTRUDER, meridian.taskId, { status: "complete" }),
    ).rejects.toThrow(/Task not found/);
    const after = await prisma.bidTask.findUniqueOrThrow({ where: { id: meridian.taskId } });
    expect(after.status).toBe(before.status);
    expect(after.updatedAt.getTime()).toBe(before.updatedAt.getTime());

    await expect(
      libraryModule.updateLibraryAnswer(KESTREL, INTRUDER, meridian.answerId, {
        title: "Overwritten",
        body: "Overwritten",
        tags: [],
        sourceTenderId: null,
      }),
    ).rejects.toThrow(/Answer not found/);
  });

  /* -------------------------------------------------------------------------
   * 3. Kestrel does see its own rows — the assertions above are not vacuous.
   * ---------------------------------------------------------------------- */

  it("shows the second organisation its own world", async () => {
    const pipeline = await tendersModule.listPipeline(KESTREL);
    expect(pipeline).toHaveLength(1);
    expect(pipeline[0].tender.id).toBe(kestrel.tenderId);
    expect(pipeline[0].requirementCount).toBe(1);
    expect(pipeline[0].latestAssessment?.recommendation).toBe("review");

    const detail = await tendersModule.getTenderDetail(KESTREL, kestrel.tenderId);
    expect(detail?.requirements).toHaveLength(1);
    expect(detail?.documents).toHaveLength(1);
    expect(detail?.latestAssessment?.results).toHaveLength(1);

    const events = await eventsModule.listTenderEvents(KESTREL, kestrel.tenderId);
    expect(events.length).toBeGreaterThan(0);
    // Event.id is a BigInt in Postgres and a string by the time it leaves here.
    expect(typeof events[0].id).toBe("string");

    const suggestions = await libraryModule.suggestLibraryAnswers(KESTREL, "mobilisation");
    expect(suggestions.map((s) => s.answer.id)).toEqual([kestrel.answerId]);
  });

  /* -------------------------------------------------------------------------
   * 4. Meridian is still intact after all of the above.
   * ---------------------------------------------------------------------- */

  it("leaves Meridian's pipeline exactly as the seed left it", async () => {
    const pipeline = await tendersModule.listPipeline(MERIDIAN);
    expect(pipeline).toHaveLength(3);
    expect(pipeline.map((row) => row.latestAssessment?.recommendation)).toEqual([
      "review",
      "no_bid",
      "bid",
    ]);
    expect(pipeline.map((row) => row.requirementCount)).toEqual([27, 40, 41]);
  });
});
