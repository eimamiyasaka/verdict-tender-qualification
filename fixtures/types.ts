/**
 * Fixture shapes.
 *
 * These are not database models — they are the authoring format. A fixture carries
 * a stable `key` instead of a uuid so one row can reference another before any ids
 * exist, and the seed resolves keys to ids as it inserts.
 *
 * Every field name that also exists on a Prisma model matches it exactly (spec §7):
 * a rename here is a rename there.
 */

import type {
  BidRecommendation,
  DocumentType,
  EvidenceRef,
  ExtractionStatus,
  InsuranceType,
  KeyDateKind,
  Money,
  Obligation,
  OrgRole,
  RequirementConstraint,
  RequirementKind,
  TaskStatus,
  TenderStatus,
  Verdict,
} from '../contracts';

/* --- Identity --- */

export interface UserFixture {
  key: string;
  /** Equals the Supabase auth user id in production. Fixed here so seeds are idempotent. */
  id: string;
  email: string;
  displayName: string | null;
}

export interface MembershipFixture {
  user: string;
  role: OrgRole;
}

export interface OrganisationFixture {
  key: string;
  id: string;
  name: string;
  companiesHouseNumber: string | null;
  headcount: number | null;
  registeredRegion: string | null;
  sicCodes: string[];
  memberships: MembershipFixture[];
}

/* --- Supplier capability, spec §7.4 --- */

export interface CredentialFixture {
  key: string;
  code: string;
  reference: string | null;
  issuedOn: Date | null;
  /** Null means does not expire. Never means missing. */
  expiresOn: Date | null;
  evidenceUrl?: string | null;
  /** Authoring note — why this row is shaped the way it is. Not persisted. */
  note?: string;
}

export interface FinancialYearFixture {
  key: string;
  yearEnding: Date;
  turnover: Money | null;
  netAssets: Money | null;
  profitBeforeTax: Money | null;
  currency: string;
  note?: string;
}

export interface InsuranceFixture {
  key: string;
  kind: InsuranceType;
  coverAmount: Money;
  currency: string;
  insurer: string | null;
  expiresOn: Date | null;
}

export interface PastProjectFixture {
  key: string;
  clientName: string;
  title: string;
  description: string | null;
  contractValue: Money | null;
  currency: string;
  sector: string | null;
  startedOn: Date | null;
  /** Null means ongoing. */
  endedOn: Date | null;
  isPublicSector: boolean;
  refereeContactable: boolean;
}

export interface PolicyFixture {
  key: string;
  policyType: string;
  title: string | null;
  lastReviewed: Date | null;
  documentUrl?: string | null;
  note?: string;
}

/* --- Tender side, spec §7.5 --- */

export interface TenderDocumentFixture {
  key: string;
  /** As displayed in citations. */
  filename: string;
  docType: DocumentType;
  /**
   * Seeded packs point at `public/packs/...`. Null models a runtime upload whose
   * file was not persisted (spec §6.4) — the drawer renders the clause with
   * `SOURCE_FILE_NOT_RETAINED_MESSAGE` and no link.
   */
  filePath: string | null;
  pageCount: number | null;
  extractionStatus: ExtractionStatus;
  extractionError?: string | null;
}

export interface KeyDateFixture {
  kind: KeyDateKind;
  occursAt: Date;
  document?: string;
  pageNumber?: number;
  quotedClause?: string;
}

/** An additional citation for a deduplicated requirement — `requirement_citations`. */
export interface ExtraCitationFixture {
  document: string;
  pageNumber: number;
  quotedClause: string;
  clauseReference?: string;
}

/**
 * What `evaluate()` must produce for this requirement, given `demoProfile` and the
 * tender's deadline at `DEMO_ASOF`.
 *
 * `verdict` is normative — the engine's test suite asserts against it.
 * `rationale` and `warning` are given only where the requirement is a fail, an
 * unknown, or a pass carrying a warning: those strings are what the UI renders
 * verbatim, so they are worth pinning. Plain passes carry no rationale here,
 * because pinning 61 sentences of generated prose would be a drift trap rather
 * than a test.
 */
export interface ExpectedOutcomeFixture {
  verdict: Verdict;
  rationale?: string;
  warning?: string;
  evidence?: EvidenceRef[];
}

export interface RequirementFixture {
  key: string;
  kind: RequirementKind;
  obligation: Obligation;
  summary: string;
  constraint: RequirementConstraint;
  /** `TenderDocumentFixture.key`. Invariant 1 — never null. */
  document: string;
  pageNumber: number;
  quotedClause: string;
  clauseReference?: string;
  /** `kind = question` only. */
  questionRef?: string;
  wordLimit?: number;
  weighting?: number;
  extractionConfidence: number;
  alsoCitedIn?: ExtraCitationFixture[];
  expected: ExpectedOutcomeFixture;
}

/* --- Assessment, spec §7.6 --- */

export interface AssessmentFixture {
  version: number;
  recommendation: BidRecommendation;
  mandatoryTotal: number;
  mandatoryPassed: number;
  mandatoryFailed: number;
  mandatoryUnknown: number;
  desirableScore: number | null;
  /** Model-written prose in production. Frozen here so the demo screen has copy. */
  rationale: string;
  deadlineUsed: Date | null;
  asOfUsed: Date;
  runBy?: string;
  /**
   * Set on historical versions. A superseded assessment was computed against an
   * older profile, so re-running `evaluate()` today will not reproduce it — that is
   * Invariant 3 working, not a broken fixture.
   */
  historicalNote?: string;
}

/* --- Workspace, spec §7.7 --- */

export interface BidTaskFixture {
  key: string;
  title: string;
  requirement?: string;
  assignee?: string;
  status: TaskStatus;
  dueOn?: Date | null;
}

export interface ResponseFixture {
  requirement: string;
  body: string;
  sourceAnswer?: string;
  updatedBy?: string;
  /** Expected `countWords(body)`. The empty-body case is the one spec §7.7 names. */
  expectedWordCount: number;
}

/* --- Tender --- */

export interface TenderFixture {
  key: string;
  title: string;
  buyerName: string;
  source: string;
  noticeReference: string;
  sourceUrl: string | null;
  contractValue: Money | null;
  currency: string;
  durationMonths: number | null;
  lotReference: string | null;
  status: TenderStatus;
  createdBy: string;
  documents: TenderDocumentFixture[];
  keyDates: KeyDateFixture[];
  requirements: RequirementFixture[];
  /** Newest last. The final entry is the one the pipeline and detail screens read. */
  assessments: AssessmentFixture[];
  tasks: BidTaskFixture[];
  responses: ResponseFixture[];
}

/* --- Library and audit --- */

export interface LibraryAnswerFixture {
  key: string;
  title: string;
  body: string;
  tags: string[];
  sourceTender?: string;
  timesUsed: number;
}

export interface EventFixture {
  action: string;
  actorKind: 'user' | 'system' | 'model';
  actor?: string;
  subjectTable: string | null;
  subject?: string;
  payload: Record<string, unknown>;
  createdAt: Date;
  tender?: string;
}
