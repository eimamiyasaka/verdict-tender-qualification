/**
 * Draft persistence (§8 step 7): Zod validation at the insert boundary, the
 * 0.6 confidence threshold, dedupe on (kind + normalised constraint) with the
 * loser's provenance kept as a citation, and the unrecognised-credential rule.
 */
import { beforeEach, describe, expect, it } from "vitest";
import type { RequirementDraft } from "@/lib/types";
import { persistDrafts } from "../_placeholder/persist";
import { DEMO_ORG_ID } from "../_placeholder/seed";
import { getStore, resetStore } from "../_placeholder/store";

const TENDER = "tender-nhs";

function draft(overrides: Partial<RequirementDraft>): RequirementDraft {
  return {
    kind: "certification",
    obligation: "mandatory",
    summary: "ISO 9001 certification",
    constraint: { kind: "certification", credential_code: "ISO9001" },
    pageNumber: 12,
    quotedClause: "The Bidder must hold ISO 9001.",
    clauseReference: "§4.1",
    questionRef: null,
    wordLimit: null,
    weighting: null,
    extractionConfidence: 0.9,
    ...overrides,
  };
}

beforeEach(() => resetStore());

describe("persistDrafts", () => {
  it("merges a duplicate obligation from a second document into a citation on the surviving requirement", () => {
    const store = getStore();
    const psq = store.documents.find((d) => d.tenderId === TENDER && d.filename === "PSQ.pdf")!;
    const before = store.requirements.filter((r) => r.tenderId === TENDER).length;
    const outcome = persistDrafts(store, {
      orgId: DEMO_ORG_ID,
      tenderId: TENDER,
      documentId: psq.id,
      drafts: [draft({ pageNumber: 40, quotedClause: "Restated: ISO 9001 is required." })],
    });
    expect(outcome).toMatchObject({ created: 0, citationsAdded: 1, heldForReview: 0, rejected: 0 });
    expect(store.requirements.filter((r) => r.tenderId === TENDER).length).toBe(before);
    const iso = store.requirements.find((r) => r.tenderId === TENDER && r.summary === "ISO 9001 quality management certification")!;
    expect(store.citations.some((c) => c.requirementId === iso.id && c.pageNumber === 40)).toBe(true);
  });

  it("holds drafts under 0.6 confidence for review and rejects drafts with no valid citation", () => {
    const store = getStore();
    const psq = store.documents.find((d) => d.tenderId === TENDER && d.filename === "PSQ.pdf")!;
    const outcome = persistDrafts(store, {
      orgId: DEMO_ORG_ID,
      tenderId: TENDER,
      documentId: psq.id,
      drafts: [
        draft({ constraint: { kind: "certification", credential_code: "BS_EN_1276" }, extractionConfidence: 0.4 }),
        draft({ constraint: { kind: "certification", credential_code: "SSIP" }, pageNumber: 0 }),
        draft({ constraint: { kind: "certification", credential_code: "SSIP" }, quotedClause: "" }),
        draft({ kind: "financial", constraint: { kind: "financial", metric: "annual_turnover" } as never }),
      ],
    });
    expect(outcome).toMatchObject({ created: 0, heldForReview: 1, rejected: 3 });
  });

  it("stores an unrecognised credential code as kind other with the raw string preserved", () => {
    const store = getStore();
    const psq = store.documents.find((d) => d.tenderId === TENDER && d.filename === "PSQ.pdf")!;
    const outcome = persistDrafts(store, {
      orgId: DEMO_ORG_ID,
      tenderId: TENDER,
      documentId: psq.id,
      drafts: [draft({ summary: "ISO 22301 business continuity", constraint: { kind: "certification", credential_code: "ISO22301" } })],
    });
    expect(outcome.created).toBe(1);
    const row = store.requirements.find((r) => r.summary === "ISO 22301 business continuity")!;
    expect(row.kind).toBe("other");
    expect(row.constraintJson).toMatchObject({ credential_code: "ISO22301", unrecognised: true });
  });

  it("keeps the highest-confidence draft within a batch", () => {
    const store = getStore();
    const psq = store.documents.find((d) => d.tenderId === TENDER && d.filename === "PSQ.pdf")!;
    persistDrafts(store, {
      orgId: DEMO_ORG_ID,
      tenderId: TENDER,
      documentId: psq.id,
      drafts: [
        draft({ summary: "Low", constraint: { kind: "certification", credential_code: "SSIP" }, extractionConfidence: 0.7, pageNumber: 5 }),
        draft({ summary: "High", constraint: { kind: "certification", credential_code: "SSIP" }, extractionConfidence: 0.95, pageNumber: 9 }),
      ],
    });
    const row = store.requirements.find((r) => r.tenderId === TENDER && (r.constraintJson as { credential_code?: string }).credential_code === "SSIP")!;
    expect(row.summary).toBe("High");
    expect(row.pageNumber).toBe(9);
    expect(store.citations.some((c) => c.requirementId === row.id && c.pageNumber === 5)).toBe(true);
  });
});
