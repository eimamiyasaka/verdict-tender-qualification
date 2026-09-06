/**
 * Verdict domain types — a hand-written mirror of the Prisma data model in
 * spec §7, using the Prisma camelCase field names throughout.
 *
 * PLACEHOLDER SEAM. When the server branch lands `prisma/schema.prisma` and
 * `contracts.ts`, the model types here are replaced by
 * `import type { Tender, ... } from "@prisma/client"` and the contract types
 * by `import type { RequirementConstraint, EvidenceRef } from "contracts"`.
 * Every field name and enum value below is binding (§7: "every field name is
 * binding"), so that swap should be mechanical.
 *
 * Two deliberate differences from raw Prisma output, both made at the data
 * layer boundary (src/lib/db) so that pages and components never see them:
 *   - Money is `number`, not `Prisma.Decimal` (Decimal cannot cross the
 *     Server → Client Component boundary).
 *   - Every model is a plain object with no relation getters.
 */

// ---------------------------------------------------------------------------
// Enums (§7.2). Values are exactly these strings; contracts.ts mirrors several.
// ---------------------------------------------------------------------------

export const ORG_ROLES = ["owner", "admin", "member"] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

export const TENDER_STATUSES = [
  "draft",
  "extracting",
  "extraction_failed",
  "extracted",
  "assessed",
  "bidding",
  "submitted",
  "won",
  "lost",
  "abandoned",
] as const;
export type TenderStatus = (typeof TENDER_STATUSES)[number];

export const DOCUMENT_TYPES = [
  "contract_notice",
  "specification",
  "psq",
  "itt",
  "pricing_schedule",
  "terms_and_conditions",
  "evaluation_methodology",
  "clarification_log",
  "other",
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const EXTRACTION_STATUSES = ["pending", "running", "complete", "failed"] as const;
export type ExtractionStatus = (typeof EXTRACTION_STATUSES)[number];

export const REQUIREMENT_KINDS = [
  "certification",
  "financial",
  "insurance",
  "experience",
  "policy",
  "legal_status",
  "resource",
  "question",
  "date",
  "other",
] as const;
export type RequirementKind = (typeof REQUIREMENT_KINDS)[number];

export const OBLIGATIONS = ["mandatory", "desirable", "informational"] as const;
export type Obligation = (typeof OBLIGATIONS)[number];

export const VERDICTS = ["pass", "fail", "unknown", "not_applicable"] as const;
export type Verdict = (typeof VERDICTS)[number];

export const BID_RECOMMENDATIONS = ["bid", "no_bid", "review"] as const;
export type BidRecommendation = (typeof BID_RECOMMENDATIONS)[number];

export const TASK_STATUSES = ["not_started", "in_progress", "in_review", "complete"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const FINANCIAL_METRICS = [
  "annual_turnover",
  "net_assets",
  "profit_before_tax",
  "current_ratio",
  "credit_score",
] as const;
export type FinancialMetric = (typeof FINANCIAL_METRICS)[number];

export const INSURANCE_TYPES = [
  "employers_liability",
  "public_liability",
  "professional_indemnity",
  "product_liability",
  "cyber",
  "contract_works",
  "motor_fleet",
] as const;
export type InsuranceType = (typeof INSURANCE_TYPES)[number];

export const KEY_DATE_KINDS = [
  "clarification_deadline",
  "submission_deadline",
  "site_visit",
  "presentation",
  "award_notification",
  "contract_start",
  "contract_end",
] as const;
export type KeyDateKind = (typeof KEY_DATE_KINDS)[number];

/** Not a Postgres enum (§7.4: Policy.policyType is a String) but a closed list in practice. */
export const POLICY_TYPES = [
  "modern_slavery",
  "equality",
  "environmental",
  "health_safety",
  "data_protection",
] as const;
export type PolicyType = (typeof POLICY_TYPES)[number];

export const TENDER_SOURCES = ["find_a_tender", "contracts_finder", "manual"] as const;
export type TenderSource = (typeof TENDER_SOURCES)[number];

// ---------------------------------------------------------------------------
// Identity and tenancy (§7.3)
// ---------------------------------------------------------------------------

export interface User {
  /** Equals the Supabase auth user id. */
  id: string;
  email: string;
  displayName: string | null;
  createdAt: Date;
}

export interface Organisation {
  id: string;
  name: string;
  companiesHouseNumber: string | null;
  headcount: number | null;
  registeredRegion: string | null;
  sicCodes: string[];
  createdAt: Date;
}

export interface Membership {
  id: string;
  orgId: string;
  userId: string;
  role: OrgRole;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Supplier capability (§7.4) — the entire evidence surface the evaluator reads.
// ---------------------------------------------------------------------------

export interface CredentialType {
  code: string;
  label: string;
  category: "quality" | "security" | "hs" | "environmental" | null;
}

export interface Credential {
  id: string;
  orgId: string;
  code: string;
  reference: string | null;
  issuedOn: Date | null;
  /** null means does not expire — never "missing". */
  expiresOn: Date | null;
  evidenceUrl: string | null;
  createdAt: Date;
}

export interface FinancialYear {
  id: string;
  orgId: string;
  yearEnding: Date;
  turnover: number | null;
  netAssets: number | null;
  profitBeforeTax: number | null;
  currency: string;
  createdAt: Date;
}

export interface Insurance {
  id: string;
  orgId: string;
  kind: InsuranceType;
  coverAmount: number;
  currency: string;
  insurer: string | null;
  expiresOn: Date | null;
  createdAt: Date;
}

export interface PastProject {
  id: string;
  orgId: string;
  clientName: string;
  title: string;
  description: string | null;
  contractValue: number | null;
  currency: string;
  sector: string | null;
  startedOn: Date | null;
  /** null means ongoing. */
  endedOn: Date | null;
  isPublicSector: boolean;
  refereeContactable: boolean;
  createdAt: Date;
}

export interface Policy {
  id: string;
  orgId: string;
  policyType: string;
  title: string | null;
  lastReviewed: Date | null;
  documentUrl: string | null;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Tender side (§7.5)
// ---------------------------------------------------------------------------

export interface Tender {
  id: string;
  orgId: string;
  title: string;
  buyerName: string | null;
  source: TenderSource | null;
  noticeReference: string | null;
  sourceUrl: string | null;
  contractValue: number | null;
  currency: string | null;
  durationMonths: number | null;
  lotReference: string | null;
  status: TenderStatus;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TenderDocument {
  id: string;
  tenderId: string;
  orgId: string;
  /** As displayed in citations — `PSQ.pdf`. */
  filename: string;
  docType: DocumentType;
  /** Seeded packs: `/packs/nhs/psq.pdf`. Runtime uploads: null (§6.4). */
  filePath: string | null;
  pageCount: number | null;
  extractionStatus: ExtractionStatus;
  /** The user-facing message, stored verbatim. */
  extractionError: string | null;
  uploadedAt: Date;
}

/**
 * The typed constraint stored in `Requirement.constraintJson` (§7.8). Keys are
 * snake_case because this is JSON checked by the database, not a Prisma model.
 * `contracts.ts` owns the canonical definition; this mirror is what the UI reads.
 */
export type RequirementConstraint =
  | { kind: "certification"; credential_code: string }
  | {
      kind: "financial";
      metric: FinancialMetric;
      operator: "gte" | "gt" | "lte" | "lt" | "eq";
      value: number;
      currency?: string;
      /** How many most-recent filed years the test applies to. Default 1. */
      years?: number;
    }
  | { kind: "insurance"; insurance_kind: InsuranceType; min_cover: number; currency?: string }
  | {
      kind: "experience";
      min_count: number;
      min_value?: number;
      currency?: string;
      within_years?: number;
      sector?: string;
      public_sector_only?: boolean;
    }
  | { kind: "policy"; policy_type: string }
  | { kind: "question"; question_ref?: string; word_limit?: number; weighting?: number }
  | { kind: "date"; date_kind?: KeyDateKind }
  | { kind: "legal_status" | "resource" | "other"; [key: string]: unknown };

export interface Requirement {
  id: string;
  tenderId: string;
  orgId: string;
  kind: RequirementKind;
  obligation: Obligation;
  /** One line, human readable, shown in the matrix. */
  summary: string;
  constraintJson: RequirementConstraint;
  /** Invariant 1 — no citation, no requirement. All three are NOT NULL. */
  documentId: string;
  pageNumber: number;
  quotedClause: string;
  clauseReference: string | null;
  /** `kind = question` only. */
  questionRef: string | null;
  wordLimit: number | null;
  /** Percentage of total score. */
  weighting: number | null;
  /** 0–1. */
  extractionConfidence: number | null;
  createdAt: Date;
}

export interface RequirementCitation {
  id: string;
  requirementId: string;
  orgId: string;
  documentId: string;
  pageNumber: number;
  quotedClause: string;
  clauseReference: string | null;
  createdAt: Date;
}

export interface KeyDate {
  id: string;
  tenderId: string;
  orgId: string;
  kind: KeyDateKind;
  occursAt: Date;
  documentId: string | null;
  pageNumber: number | null;
  quotedClause: string | null;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Assessment (§7.6) — immutable, versioned.
// ---------------------------------------------------------------------------

export interface Assessment {
  id: string;
  tenderId: string;
  orgId: string;
  /** 1-based, per tender. */
  version: number;
  recommendation: BidRecommendation;
  mandatoryTotal: number;
  mandatoryPassed: number;
  mandatoryFailed: number;
  mandatoryUnknown: number;
  /** 0–100 coverage of desirable requirements. */
  desirableScore: number | null;
  rationale: string | null;
  deadlineUsed: Date | null;
  asOfUsed: Date;
  runById: string | null;
  createdAt: Date;
}

/** A pointer from a result back to the profile row that produced it. Mirrors contracts.ts. */
export interface EvidenceRef {
  table:
    | "credentials"
    | "financial_years"
    | "insurances"
    | "past_projects"
    | "policies"
    | "organisations";
  id: string;
  label: string;
  /** Why this row counted, or fell short. */
  note?: string;
  matched?: boolean;
}

export interface AssessmentResult {
  id: string;
  assessmentId: string;
  requirementId: string;
  orgId: string;
  verdict: Verdict;
  /** Quantitative, rendered verbatim in the UI. */
  rationale: string;
  evidence: EvidenceRef[];
  warning: string | null;
  overriddenById: string | null;
  overrideNote: string | null;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Workspace and audit (§7.7)
// ---------------------------------------------------------------------------

export interface BidTask {
  id: string;
  tenderId: string;
  orgId: string;
  requirementId: string | null;
  title: string;
  assigneeId: string | null;
  status: TaskStatus;
  dueOn: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Response {
  id: string;
  requirementId: string;
  orgId: string;
  body: string;
  sourceAnswerId: string | null;
  updatedById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LibraryAnswer {
  id: string;
  orgId: string;
  title: string;
  body: string;
  tags: string[];
  sourceTenderId: string | null;
  timesUsed: number;
  createdAt: Date;
}

export type EventAction =
  | "tender.created"
  | "tender.status_changed"
  | "document.uploaded"
  | "extraction.completed"
  | "extraction.failed"
  | "assessment.run"
  | "result.overridden"
  | "profile.updated"
  | "task.updated"
  | "response.saved"
  | "library.answer_used";

export interface Event {
  /** BigInt in Postgres; serialised to string at the data layer boundary. */
  id: string;
  orgId: string;
  actorId: string | null;
  actorKind: "user" | "system" | "model";
  action: EventAction;
  subjectTable: string | null;
  subjectId: string | null;
  payload: Record<string, unknown>;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Extraction drafts (§8) — what /api/extract-requirements returns per chunk.
// Mirrors `RequirementDraft` in contracts.ts.
// ---------------------------------------------------------------------------

export interface RequirementDraft {
  kind: RequirementKind;
  obligation: Obligation;
  summary: string;
  constraint: RequirementConstraint;
  pageNumber: number;
  quotedClause: string;
  clauseReference: string | null;
  questionRef: string | null;
  wordLimit: number | null;
  weighting: number | null;
  extractionConfidence: number;
}

// ---------------------------------------------------------------------------
// View models — the shapes the screens actually read. Built in src/lib/db.
// ---------------------------------------------------------------------------

/** One row on the pipeline (§10.1): tender + latest assessment, one query, no N+1. */
export interface PipelineRow {
  tender: Tender;
  latestAssessment: Assessment | null;
  submissionDeadline: Date | null;
  requirementCount: number;
}

export interface RequirementWithSources extends Requirement {
  document: TenderDocument;
  citations: Array<RequirementCitation & { document: TenderDocument }>;
}

export interface AssessmentWithResults extends Assessment {
  results: AssessmentResult[];
}

export interface TenderDetail {
  tender: Tender;
  documents: TenderDocument[];
  keyDates: KeyDate[];
  requirements: RequirementWithSources[];
  latestAssessment: AssessmentWithResults | null;
  assessmentVersions: Assessment[];
  submissionDeadline: Date | null;
  clarificationDeadline: Date | null;
  /** True when the profile changed after the latest assessment was run (§14). */
  profileChangedSinceAssessment: boolean;
  /** Per-document count of requirements found, keyed by document id. */
  requirementCountByDocument: Record<string, number>;
  /** Per-document failed-chunk counts from the extraction event, keyed by document id. */
  failedChunksByDocument: Record<string, number>;
}

export interface WorkspaceTask extends BidTask {
  requirement: RequirementWithSources | null;
  response: Response | null;
  assignee: User | null;
}

/** "used by N requirements across M tenders" (§10.3). */
export interface UsageCount {
  requirements: number;
  tenders: number;
}

/** Something requirements ask for that the profile does not hold. */
export interface ProfileGap {
  key: string;
  label: string;
  usage: UsageCount;
}

export interface ProfileView {
  organisation: Organisation;
  credentials: Array<Credential & { type: CredentialType; usage: UsageCount }>;
  credentialTypes: CredentialType[];
  financialYears: Array<FinancialYear & { usage: UsageCount }>;
  insurances: Array<Insurance & { usage: UsageCount }>;
  pastProjects: Array<PastProject & { usage: UsageCount }>;
  policies: Array<Policy & { usage: UsageCount }>;
  /** Certifications, insurance kinds and policy types requirements cite but the profile lacks. */
  gaps: { credentials: ProfileGap[]; insurances: ProfileGap[]; policies: ProfileGap[] };
  /** Tenders whose latest assessment predates the last profile change. */
  staleAssessments: Array<Pick<Tender, "id" | "title">>;
}

export interface LibraryAnswerWithSource extends LibraryAnswer {
  sourceTender: Pick<Tender, "id" | "title"> | null;
}

export interface EventWithActor extends Event {
  actor: User | null;
}

export interface OrgContext {
  orgId: string;
  userId: string;
  organisation: Organisation;
  user: User;
  role: OrgRole;
}
