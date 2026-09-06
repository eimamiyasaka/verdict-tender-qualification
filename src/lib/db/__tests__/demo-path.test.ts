/**
 * The 90-second reviewer path (§13), exercised against the data layer.
 *
 * These run against the placeholder store today and are written to the same
 * exported functions the Prisma implementation will keep, so they can be
 * pointed at a test database at merge.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { DEMO_ORG_ID, DEMO_USER_ID } from "../_placeholder/seed";
import { resetStore } from "../_placeholder/store";
import { runAssessment } from "../assessments";
import { listTenderEvents } from "../events";
import { suggestLibraryAnswers } from "../library";
import { getProfile, upsertInsurance, upsertPolicy } from "../profile";
import { getTenderDetail, listPipeline } from "../tenders";
import { listWorkspaceTasks } from "../workspace";

beforeEach(() => resetStore());

describe("1. the pipeline", () => {
  it("shows three tenders with one of each verdict, sorted by submission deadline", async () => {
    const rows = await listPipeline(DEMO_ORG_ID);
    expect(rows.map((r) => r.tender.id)).toEqual(["tender-camden", "tender-nhs", "tender-leeds"]);
    expect(rows.map((r) => r.latestAssessment?.recommendation)).toEqual(["review", "no_bid", "bid"]);
    expect(rows.every((r) => r.requirementCount > 20)).toBe(true);
  });
});

describe("2. the NHS tender", () => {
  it("is a no-bid with two quantified blocking failures and three unknowns", async () => {
    const detail = await getTenderDetail(DEMO_ORG_ID, "tender-nhs");
    const a = detail!.latestAssessment!;
    expect(a.version).toBe(2);
    expect(a.recommendation).toBe("no_bid");
    expect(a.mandatoryFailed).toBe(2);
    expect(a.mandatoryUnknown).toBe(3);
    expect(a.mandatoryPassed).toBe(21);
    expect(a.rationale).toBe("2 mandatory failures block this tender.");
    const rationales = a.results.map((r) => r.rationale);
    expect(rationales).toContain("FY2025 turnover £4,120,000 — short by £880,000.");
    expect(rationales).toContain("Not held. No certificate on your profile.");
    expect(rationales).toContain("No employers' liability policy recorded. Add one to resolve.");
  });

  it("carries the deadline and clock it evaluated against", async () => {
    const detail = await getTenderDetail(DEMO_ORG_ID, "tender-nhs");
    const a = detail!.latestAssessment!;
    expect(a.deadlineUsed?.getTime()).toBe(detail!.submissionDeadline?.getTime());
    expect(a.asOfUsed).toBeInstanceOf(Date);
  });

  it("keeps both citations for the deduplicated ISO 27001 requirement", async () => {
    const detail = await getTenderDetail(DEMO_ORG_ID, "tender-nhs");
    const iso = detail!.requirements.find((r) => r.summary === "ISO 27001 certification")!;
    expect(iso.document.filename).toBe("PSQ.pdf");
    expect(iso.pageNumber).toBe(31);
    expect(iso.clauseReference).toBe("§4.2.1");
    expect(iso.citations).toHaveLength(1);
    expect(iso.citations[0].document.filename).toBe("ITT.pdf");
  });
});

describe("4–5. add employers' liability, re-run", () => {
  it("resolves the unknown to a pass; the verdict stays no-bid; version 2 is untouched", async () => {
    await upsertInsurance(DEMO_ORG_ID, DEMO_USER_ID, {
      kind: "employers_liability",
      coverAmount: 10_000_000,
      currency: "GBP",
      insurer: "Aviva",
      expiresOn: null,
    });
    const before = await getTenderDetail(DEMO_ORG_ID, "tender-nhs");
    expect(before!.profileChangedSinceAssessment).toBe(true);

    const v3 = await runAssessment(DEMO_ORG_ID, DEMO_USER_ID, "tender-nhs");
    expect(v3.version).toBe(3);
    expect(v3.recommendation).toBe("no_bid");
    expect(v3.mandatoryFailed).toBe(2);
    expect(v3.mandatoryUnknown).toBe(2);
    expect(v3.mandatoryPassed).toBe(22);

    const after = await getTenderDetail(DEMO_ORG_ID, "tender-nhs");
    expect(after!.profileChangedSinceAssessment).toBe(false);
    const v2 = after!.assessmentVersions.find((v) => v.version === 2)!;
    expect(v2.mandatoryUnknown).toBe(3);
    const el = after!.latestAssessment!.results.find((r) => r.rationale.startsWith("Employers' liability"))!;
    expect(el.verdict).toBe("pass");
    expect(el.rationale).toBe("Employers' liability £10,000,000 recorded (Aviva) — meets £10,000,000.");
  });

  it("appends one event per write, in order", async () => {
    await upsertPolicy(DEMO_ORG_ID, DEMO_USER_ID, { policyType: "data_protection", title: "Data Protection Policy", lastReviewed: new Date(), documentUrl: null });
    await runAssessment(DEMO_ORG_ID, DEMO_USER_ID, "tender-nhs");
    const events = await listTenderEvents(DEMO_ORG_ID, "tender-nhs");
    expect(events[0].action).toBe("assessment.run");
    expect(events[0].payload.version).toBe(3);
    const profile = await getProfile(DEMO_ORG_ID);
    expect(profile!.policies.some((p) => p.policyType === "data_protection")).toBe(true);
  });
});

describe("6. the Leeds workspace", () => {
  it("has a task per method statement and suggests the social value answer first", async () => {
    const tasks = await listWorkspaceTasks(DEMO_ORG_ID, "tender-leeds");
    expect(tasks).toHaveLength(8);
    expect(tasks[0].requirement?.questionRef).toBe("Method Statement 1");
    expect(tasks.filter((t) => t.response).length).toBeGreaterThanOrEqual(4);
    const suggestions = await suggestLibraryAnswers(DEMO_ORG_ID, "Describe the social value you will deliver through this contract");
    expect(suggestions[0]?.answer.id).toBe("lib-social-value");
    expect(suggestions.length).toBeLessThanOrEqual(3);
  });
});

describe("profile gaps", () => {
  it("lists what requirements ask for that the profile lacks", async () => {
    const profile = await getProfile(DEMO_ORG_ID);
    expect(profile!.gaps.credentials.map((g) => g.key)).toContain("ISO27001");
    expect(profile!.gaps.insurances.map((g) => g.key)).toContain("employers_liability");
    expect(profile!.staleAssessments).toEqual([]);
  });
});
