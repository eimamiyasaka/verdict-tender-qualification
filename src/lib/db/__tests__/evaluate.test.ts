/**
 * The §9 verdict rules, as the placeholder evaluator implements them. The
 * real engine's Vitest suite lives with `src/lib/qualify/`; these cases are
 * the ones the spec names and are what the UI is built to display.
 */
import { describe, expect, it } from "vitest";
import type { CredentialType, Organisation, Requirement } from "@/lib/types";
import { evaluateRequirement, recommend, type ProfileSnapshot } from "../_placeholder/evaluate";

const asOf = new Date(2026, 8, 6);
const deadline = new Date(2026, 8, 17);
const clock = { asOf, deadline };

const organisation: Organisation = {
  id: "org",
  name: "Test Ltd",
  companiesHouseNumber: null,
  headcount: 40,
  registeredRegion: "England",
  sicCodes: [],
  createdAt: asOf,
};
const credentialTypes: CredentialType[] = [{ code: "ISO9001", label: "ISO 9001 Quality Management", category: "quality" }];

function profile(overrides: Partial<ProfileSnapshot> = {}): ProfileSnapshot {
  return { organisation, credentialTypes, credentials: [], financialYears: [], insurances: [], pastProjects: [], policies: [], ...overrides };
}

function req(kind: Requirement["kind"], constraint: Record<string, unknown>, obligation: Requirement["obligation"] = "mandatory"): Requirement {
  return {
    id: "r",
    tenderId: "t",
    orgId: "org",
    kind,
    obligation,
    summary: "test",
    constraintJson: { kind, ...constraint } as Requirement["constraintJson"],
    documentId: "d",
    pageNumber: 1,
    quotedClause: "clause",
    clauseReference: null,
    questionRef: null,
    wordLimit: null,
    weighting: null,
    extractionConfidence: 0.9,
    createdAt: asOf,
  };
}

const iso9001 = (expiresOn: Date | null) => ({
  id: "c1",
  orgId: "org",
  code: "ISO9001",
  reference: "Q-1",
  issuedOn: null,
  expiresOn,
  evidenceUrl: null,
  createdAt: asOf,
});

describe("certification", () => {
  it("absent → fail: absence is knowable", () => {
    const r = evaluateRequirement(req("certification", { credential_code: "ISO9001" }), profile(), clock);
    expect(r.verdict).toBe("fail");
    expect(r.rationale).toBe("Not held. No certificate on your profile.");
  });
  it("expiresOn null → pass: null means does not expire", () => {
    const r = evaluateRequirement(req("certification", { credential_code: "ISO9001" }), profile({ credentials: [iso9001(null)] }), clock);
    expect(r.verdict).toBe("pass");
    expect(r.warning).toBeNull();
  });
  it("expires between today and the deadline → fail with the expiry date", () => {
    const r = evaluateRequirement(req("certification", { credential_code: "ISO9001" }), profile({ credentials: [iso9001(new Date(2026, 8, 10))] }), clock);
    expect(r.verdict).toBe("fail");
    expect(r.rationale).toContain("expired 10 Sep 2026");
  });
  it("expires within 30 days after the deadline → pass with a dated warning", () => {
    const r = evaluateRequirement(req("certification", { credential_code: "ISO9001" }), profile({ credentials: [iso9001(new Date(2026, 9, 1))] }), clock);
    expect(r.verdict).toBe("pass");
    expect(r.warning).toContain("14 days after the submission deadline");
  });
  it("unknown credential code → unknown, never silently dropped", () => {
    const r = evaluateRequirement(req("certification", { credential_code: "ISO99999" }), profile(), clock);
    expect(r.verdict).toBe("unknown");
  });
});

describe("financial", () => {
  const fy = (year: number, turnover: number | null, currency = "GBP") => ({
    id: `fy${year}`,
    orgId: "org",
    yearEnding: new Date(year, 2, 31),
    turnover,
    netAssets: 100_000,
    profitBeforeTax: 10_000,
    currency,
    createdAt: asOf,
  });
  it("short of the threshold → fail, quantified", () => {
    const r = evaluateRequirement(req("financial", { metric: "annual_turnover", operator: "gte", value: 5_000_000 }), profile({ financialYears: [fy(2025, 4_120_000)] }), clock);
    expect(r.verdict).toBe("fail");
    expect(r.rationale).toBe("FY2025 turnover £4,120,000 — short by £880,000.");
  });
  it("missing year → unknown, naming what is missing", () => {
    const r = evaluateRequirement(req("financial", { metric: "annual_turnover", operator: "gte", value: 1, years: 2 }), profile({ financialYears: [fy(2025, 4_120_000)] }), clock);
    expect(r.verdict).toBe("unknown");
    expect(r.rationale).toContain("Only 1 financial year entered; 2 required");
  });
  it("present year with a null metric → unknown, naming the year", () => {
    const r = evaluateRequirement(req("financial", { metric: "annual_turnover", operator: "gte", value: 1 }), profile({ financialYears: [fy(2025, null)] }), clock);
    expect(r.verdict).toBe("unknown");
    expect(r.rationale).toContain("FY2025 turnover not entered");
  });
  it("currency mismatch → unknown, never a silent conversion", () => {
    const r = evaluateRequirement(req("financial", { metric: "annual_turnover", operator: "gte", value: 1, currency: "EUR" }), profile({ financialYears: [fy(2025, 4_120_000)] }), clock);
    expect(r.verdict).toBe("unknown");
    expect(r.rationale).toContain("stated in EUR");
  });
});

describe("insurance", () => {
  it("no policy of that kind → unknown, not fail", () => {
    const r = evaluateRequirement(req("insurance", { insurance_kind: "employers_liability", min_cover: 10_000_000 }), profile(), clock);
    expect(r.verdict).toBe("unknown");
    expect(r.rationale).toBe("No employers' liability policy recorded. Add one to resolve.");
  });
  it("cover below the minimum → fail, quantified", () => {
    const r = evaluateRequirement(
      req("insurance", { insurance_kind: "public_liability", min_cover: 10_000_000 }),
      profile({ insurances: [{ id: "i", orgId: "org", kind: "public_liability", coverAmount: 5_000_000, currency: "GBP", insurer: null, expiresOn: null, createdAt: asOf }] }),
      clock,
    );
    expect(r.verdict).toBe("fail");
    expect(r.rationale).toContain("short of £10,000,000 by £5,000,000");
  });
});

describe("policy and experience", () => {
  it("policy reviewed over 24 months ago → pass with a warning; absent → fail", () => {
    const old = { id: "p", orgId: "org", policyType: "modern_slavery", title: null, lastReviewed: new Date(2024, 1, 10), documentUrl: null, createdAt: asOf };
    expect(evaluateRequirement(req("policy", { policy_type: "modern_slavery" }), profile({ policies: [old] }), clock)).toMatchObject({ verdict: "pass" });
    expect(evaluateRequirement(req("policy", { policy_type: "modern_slavery" }), profile({ policies: [old] }), clock).warning).toContain("30 months ago");
    expect(evaluateRequirement(req("policy", { policy_type: "modern_slavery" }), profile(), clock).verdict).toBe("fail");
  });
  it("experience lists which projects counted and which fell short", () => {
    const projects = [
      { id: "a", orgId: "org", clientName: "A", title: "big", description: null, contractValue: 900_000, currency: "GBP", sector: "healthcare", startedOn: null, endedOn: null, isPublicSector: true, refereeContactable: true, createdAt: asOf },
      { id: "b", orgId: "org", clientName: "B", title: "small", description: null, contractValue: 90_000, currency: "GBP", sector: "commercial", startedOn: null, endedOn: null, isPublicSector: false, refereeContactable: true, createdAt: asOf },
    ];
    const r = evaluateRequirement(req("experience", { min_count: 2, min_value: 500_000 }), profile({ pastProjects: projects }), clock);
    expect(r.verdict).toBe("fail");
    expect(r.evidence.map((e) => e.matched)).toEqual([true, false]);
    expect(r.evidence[1].note).toContain("£90,000 is under £500,000");
  });
});

describe("recommend", () => {
  it("any mandatory fail → no_bid; any mandatory unknown → review; otherwise bid", () => {
    expect(recommend([{ obligation: "mandatory", verdict: "fail" }, { obligation: "mandatory", verdict: "unknown" }])).toBe("no_bid");
    expect(recommend([{ obligation: "mandatory", verdict: "unknown" }, { obligation: "desirable", verdict: "fail" }])).toBe("review");
    expect(recommend([{ obligation: "mandatory", verdict: "pass" }, { obligation: "desirable", verdict: "fail" }])).toBe("bid");
  });
});
