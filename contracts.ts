/**
 * Verdict — shared contracts.
 *
 * FROZEN. Read-only, like `docs/spec.md`. If you need a change here, stop and ask.
 *
 * This file is the seam between the parallel build sessions. It holds every shape
 * that crosses a boundary — extraction → persistence → evaluation → UI — plus the
 * three pieces of arithmetic (`recommend`, `tallyMandatory`, `desirableCoverage`)
 * that must have exactly one definition in the codebase.
 *
 * Rules for this file:
 *   - No imports except `zod`. No Prisma, no Next, no database, no network, no clock.
 *   - Enum value strings are byte-identical to the Postgres enums in spec §7.2.
 *   - Anything the database enforces (spec §7.8) is enforced here too, so the CHECK
 *     constraint is a backstop rather than the only referee.
 *
 * Naming, and the one place it is inconsistent on purpose:
 *   - Model/row fields are camelCase — they become Prisma fields (`pageNumber`).
 *   - Keys *inside* `constraintJson` are snake_case (`credential_code`), because
 *     spec §7.8's CHECK constraint queries those exact keys with `?` and `?&`.
 *     Renaming one breaks a database constraint, not just a type.
 */

import { z } from 'zod';

/* ============================================================================
 * 1. Enums — spec §7.2. These strings are binding.
 * ========================================================================== */

export const ORG_ROLES = ['owner', 'admin', 'member'] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

export const TENDER_STATUSES = [
  'draft',
  'extracting',
  'extraction_failed',
  'extracted',
  'assessed',
  'bidding',
  'submitted',
  'won',
  'lost',
  'abandoned',
] as const;
export type TenderStatus = (typeof TENDER_STATUSES)[number];

export const DOCUMENT_TYPES = [
  'contract_notice',
  'specification',
  'psq',
  'itt',
  'pricing_schedule',
  'terms_and_conditions',
  'evaluation_methodology',
  'clarification_log',
  'other',
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const EXTRACTION_STATUSES = ['pending', 'running', 'complete', 'failed'] as const;
export type ExtractionStatus = (typeof EXTRACTION_STATUSES)[number];

export const REQUIREMENT_KINDS = [
  'certification',
  'financial',
  'insurance',
  'experience',
  'policy',
  'legal_status',
  'resource',
  'question',
  'date',
  'other',
] as const;
export type RequirementKind = (typeof REQUIREMENT_KINDS)[number];

export const OBLIGATIONS = ['mandatory', 'desirable', 'informational'] as const;
export type Obligation = (typeof OBLIGATIONS)[number];

export const VERDICTS = ['pass', 'fail', 'unknown', 'not_applicable'] as const;
export type Verdict = (typeof VERDICTS)[number];

export const BID_RECOMMENDATIONS = ['bid', 'no_bid', 'review'] as const;
export type BidRecommendation = (typeof BID_RECOMMENDATIONS)[number];

export const TASK_STATUSES = ['not_started', 'in_progress', 'in_review', 'complete'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const FINANCIAL_METRICS = [
  'annual_turnover',
  'net_assets',
  'profit_before_tax',
  'current_ratio',
  'credit_score',
] as const;
export type FinancialMetric = (typeof FINANCIAL_METRICS)[number];

export const INSURANCE_TYPES = [
  'employers_liability',
  'public_liability',
  'professional_indemnity',
  'product_liability',
  'cyber',
  'contract_works',
  'motor_fleet',
] as const;
export type InsuranceType = (typeof INSURANCE_TYPES)[number];

export const KEY_DATE_KINDS = [
  'clarification_deadline',
  'submission_deadline',
  'site_visit',
  'presentation',
  'award_notification',
  'contract_start',
  'contract_end',
] as const;
export type KeyDateKind = (typeof KEY_DATE_KINDS)[number];

/**
 * `FinancialYear` stores turnover, net assets and profit before tax only.
 * `current_ratio` and `credit_score` are real things for a buyer to ask for and are
 * therefore in the enum, but the snapshot can never answer them — spec §9's
 * definition of `unknown` ("the snapshot lacks the data needed to decide") is the
 * correct verdict for both, permanently, and not a gap to be quietly filled later.
 */
export const METRICS_NOT_IN_SNAPSHOT: readonly FinancialMetric[] = ['current_ratio', 'credit_score'];

/* ============================================================================
 * 2. Reference data — spec §7.4. `credential_types` is seeded, not user-editable.
 * ========================================================================== */

export const CREDENTIAL_TYPES = [
  { code: 'ISO9001', label: 'ISO 9001 Quality Management', category: 'quality' },
  { code: 'ISO14001', label: 'ISO 14001 Environmental Management', category: 'environmental' },
  { code: 'ISO27001', label: 'ISO 27001 Information Security', category: 'security' },
  { code: 'ISO45001', label: 'ISO 45001 Occupational H&S', category: 'hs' },
  { code: 'CYBER_ESSENTIALS', label: 'Cyber Essentials', category: 'security' },
  { code: 'CYBER_ESSENTIALS_PLUS', label: 'Cyber Essentials Plus', category: 'security' },
  { code: 'CHAS', label: 'CHAS Accreditation', category: 'hs' },
  { code: 'SAFECONTRACTOR', label: 'SafeContractor', category: 'hs' },
  { code: 'CONSTRUCTIONLINE', label: 'Constructionline', category: 'quality' },
  { code: 'SSIP', label: 'SSIP Member Scheme', category: 'hs' },
  { code: 'DSPT', label: 'NHS Data Security & Protection Toolkit', category: 'security' },
  { code: 'BS_EN_1276', label: 'BS EN 1276', category: 'quality' },
] as const satisfies readonly { code: string; label: string; category: string }[];

export type CredentialCode = (typeof CREDENTIAL_TYPES)[number]['code'];

export const CREDENTIAL_CODES: readonly CredentialCode[] = CREDENTIAL_TYPES.map((c) => c.code);

export function isKnownCredentialCode(code: string): code is CredentialCode {
  return (CREDENTIAL_CODES as readonly string[]).includes(code);
}

export function credentialLabel(code: string): string {
  return CREDENTIAL_TYPES.find((c) => c.code === code)?.label ?? code;
}

/**
 * `Policy.policyType` is a plain string column, so an unrecognised value is stored
 * rather than rejected. This is the canonical set the profile UI offers.
 */
export const POLICY_TYPES = [
  'modern_slavery',
  'equality',
  'environmental',
  'health_safety',
  'data_protection',
] as const;
export type PolicyType = (typeof POLICY_TYPES)[number];

/* ============================================================================
 * 3. Money
 *
 * The database stores money as `Decimal(14,2)` (spec §7.1). Inside the pure
 * evaluator it is a plain `number` in major units — Prisma's `Decimal` cannot cross
 * into a module that imports nothing from Prisma.
 *
 * Binary64 represents 2dp values approximately (4_120_000.10 is really
 * 4_120_000.099999999627), so every money comparison in the codebase goes through
 * `compareMoney`, which rounds both sides to minor units and compares integers.
 * Never use `>=` on two `Money` values directly.
 * ========================================================================== */

/** Major units (pounds, not pence), at most 2 decimal places. */
export type Money = number;

export const DEFAULT_CURRENCY = 'GBP';

export function toMinorUnits(value: Money): number {
  return Math.round(value * 100);
}

export function compareMoney(a: Money, b: Money): -1 | 0 | 1 {
  const left = toMinorUnits(a);
  const right = toMinorUnits(b);
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

export function sameCurrency(a: string | null | undefined, b: string | null | undefined): boolean {
  return (a ?? DEFAULT_CURRENCY).toUpperCase() === (b ?? DEFAULT_CURRENCY).toUpperCase();
}

/** Applies a `ComparisonOperator` to two already-rounded values. */
export function satisfiesThreshold(
  actual: number,
  operator: ComparisonOperator,
  threshold: number,
): boolean {
  switch (operator) {
    case 'gte':
      return actual >= threshold;
    case 'gt':
      return actual > threshold;
    case 'lte':
      return actual <= threshold;
    case 'lt':
      return actual < threshold;
    case 'eq':
      return actual === threshold;
  }
}

/* ============================================================================
 * 4. RequirementConstraint — the typed body of `requirements.constraint_json`.
 *
 * Invariant 2 (spec §7.8) is a database CHECK over these exact snake_case keys.
 * The Zod schemas below are the same rule at the insert boundary; the CHECK is the
 * backstop for anything that bypasses `src/lib/ingest/persist.ts`.
 *
 * `kind` is repeated inside the JSON so the object is self-describing and usable as
 * a TypeScript discriminated union. It must equal the row's `kind` column — see
 * `constraintMatchesKind`.
 * ========================================================================== */

export const COMPARISON_OPERATORS = ['gte', 'gt', 'lte', 'lt', 'eq'] as const;
export type ComparisonOperator = (typeof COMPARISON_OPERATORS)[number];

/**
 * How a financial threshold applies across the years it asks for:
 *   each_year — every one of the last `years_required` filed years must satisfy it
 *   any_year  — at least one of them must
 *   average   — the mean across them must
 */
export const FINANCIAL_BASES = ['each_year', 'any_year', 'average'] as const;
export type FinancialBasis = (typeof FINANCIAL_BASES)[number];

export const RESPONSE_FORMATS = ['method_statement', 'short_answer', 'attachment', 'form'] as const;
export type ResponseFormat = (typeof RESPONSE_FORMATS)[number];

const currencyCode = z.string().length(3).regex(/^[A-Za-z]{3}$/);

export const CertificationConstraintSchema = z.object({
  kind: z.literal('certification'),
  /**
   * A `CredentialType.code` where the buyer named a scheme we hold reference data
   * for. Where the model emits a code that is not in `credential_types`, spec §14
   * requires the row to be stored as `kind = 'other'` with the raw string preserved
   * — see `unresolvedCredentialConstraint`. Never silently dropped, never coerced.
   */
  credential_code: z.string().min(1).max(64),
});

export const FinancialConstraintSchema = z.object({
  kind: z.literal('financial'),
  metric: z.enum(FINANCIAL_METRICS),
  operator: z.enum(COMPARISON_OPERATORS),
  value: z.number(),
  /** Ignored for `current_ratio` and `credit_score`, which are dimensionless. */
  currency: currencyCode.optional(),
  /** How many of the most recent filed years the threshold applies to. Default 1. */
  years_required: z.number().int().min(1).max(10).optional(),
  /** Default `each_year`. */
  basis: z.enum(FINANCIAL_BASES).optional(),
});

export const InsuranceConstraintSchema = z.object({
  kind: z.literal('insurance'),
  insurance_kind: z.enum(INSURANCE_TYPES),
  min_cover: z.number().nonnegative(),
  currency: currencyCode.optional(),
});

export const ExperienceConstraintSchema = z.object({
  kind: z.literal('experience'),
  min_count: z.number().int().min(1),
  min_value: z.number().nonnegative().optional(),
  currency: currencyCode.optional(),
  /**
   * A project counts as recent when it ended within this many months of `asOf`, or
   * is ongoing (`endedOn` is null).
   */
  within_last_months: z.number().int().min(1).optional(),
  sector: z.string().min(1).max(64).optional(),
  public_sector_only: z.boolean().optional(),
  referee_required: z.boolean().optional(),
});

export const PolicyConstraintSchema = z.object({
  kind: z.literal('policy'),
  policy_type: z.string().min(1).max(64),
  /**
   * Drives the warning only, never the verdict. Spec §9: a policy that exists but
   * was last reviewed too long ago is a `pass` with a warning, not a `fail`.
   * Defaults to `POLICY_REVIEW_WARNING_MONTHS`.
   */
  max_age_months: z.number().int().min(1).optional(),
});

/* The tail kinds. Spec §9 makes all of them `not_applicable` to eligibility, and
 * spec §7.8's CHECK is `else true` for them, so Zod is permissive here too: a
 * requirement that cannot block a bid must never be the reason a chunk is rejected.
 * The fields exist so the citation drawer, the workspace and `key_dates` have
 * somewhere to read from. */

export const LegalStatusConstraintSchema = z.object({
  kind: z.literal('legal_status'),
  statement: z.string().min(1).max(400).optional(),
  region: z.string().min(1).max(64).optional(),
});

export const ResourceConstraintSchema = z.object({
  kind: z.literal('resource'),
  description: z.string().min(1).max(400).optional(),
  /**
   * Carried because `Organisation.headcount` is part of the evidence surface
   * (spec §7.4). v1 still returns `not_applicable` for `resource` per spec §9 — the
   * field is here so a later version does not need a contract change.
   */
  min_headcount: z.number().int().min(1).optional(),
});

export const QuestionConstraintSchema = z.object({
  kind: z.literal('question'),
  /** `questionRef`, `wordLimit` and `weighting` are columns on `requirements`, not keys here. */
  response_format: z.enum(RESPONSE_FORMATS).optional(),
});

export const DateConstraintSchema = z.object({
  kind: z.literal('date'),
  date_kind: z.enum(KEY_DATE_KINDS),
  /** ISO 8601 instant. `src/lib/ingest/persist.ts` mirrors this into `key_dates`. */
  occurs_at: z.string().datetime({ offset: true }),
});

/**
 * The escape hatch, and the reason nothing is ever dropped. Spec §14: a
 * `credential_code` the model invented is stored here verbatim with
 * `original_kind: 'certification'`, and evaluates to `unknown`.
 */
export const OtherConstraintSchema = z
  .object({
    kind: z.literal('other'),
    original_kind: z.enum(REQUIREMENT_KINDS).optional(),
    note: z.string().max(400).optional(),
  })
  .passthrough();

export const RequirementConstraintSchema = z.discriminatedUnion('kind', [
  CertificationConstraintSchema,
  FinancialConstraintSchema,
  InsuranceConstraintSchema,
  ExperienceConstraintSchema,
  PolicyConstraintSchema,
  LegalStatusConstraintSchema,
  ResourceConstraintSchema,
  QuestionConstraintSchema,
  DateConstraintSchema,
  OtherConstraintSchema,
]);

export type CertificationConstraint = z.infer<typeof CertificationConstraintSchema>;
export type FinancialConstraint = z.infer<typeof FinancialConstraintSchema>;
export type InsuranceConstraint = z.infer<typeof InsuranceConstraintSchema>;
export type ExperienceConstraint = z.infer<typeof ExperienceConstraintSchema>;
export type PolicyConstraint = z.infer<typeof PolicyConstraintSchema>;
export type LegalStatusConstraint = z.infer<typeof LegalStatusConstraintSchema>;
export type ResourceConstraint = z.infer<typeof ResourceConstraintSchema>;
export type QuestionConstraint = z.infer<typeof QuestionConstraintSchema>;
export type DateConstraint = z.infer<typeof DateConstraintSchema>;
export type OtherConstraint = z.infer<typeof OtherConstraintSchema>;
export type RequirementConstraint = z.infer<typeof RequirementConstraintSchema>;

/** The row's `kind` column and its constraint body must agree. */
export function constraintMatchesKind(
  kind: RequirementKind,
  constraint: RequirementConstraint,
): boolean {
  return constraint.kind === kind;
}

/** Spec §14, row 4. Preserves what the model said instead of discarding the row. */
export function unresolvedCredentialConstraint(rawCode: string, note?: string): OtherConstraint {
  return {
    kind: 'other',
    original_kind: 'certification',
    credential_code: rawCode,
    note: note ?? 'Credential code is not in credential_types; stored verbatim.',
  } as OtherConstraint;
}

/**
 * Deduplication key, spec §8 step 7: same `kind` plus normalised constraint. Keys
 * are sorted and empty values dropped, so `{a:1,b:2}` and `{b:2,a:1}` collide and a
 * defaulted field never splits one obligation into two matrix rows.
 */
export function constraintDedupeKey(
  kind: RequirementKind,
  constraint: RequirementConstraint,
): string {
  const entries = Object.entries(constraint as Record<string, unknown>)
    .filter(([key, value]) => key !== 'kind' && value !== undefined && value !== null)
    .map(([key, value]) => [key, typeof value === 'string' ? value.trim().toUpperCase() : value])
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  return kind + ':' + JSON.stringify(entries);
}

/* ============================================================================
 * 5. Extraction — spec §8.
 * ========================================================================== */

/** Spec §8: "Model: Claude Sonnet 4.6, structured output." */
export const EXTRACTION_MODEL = 'claude-sonnet-4-6';

/** 5-page windows with 1 page of overlap, so a clause spanning a break is never cut. */
export const CHUNK_PAGE_SPAN = 5;
export const CHUNK_PAGE_OVERLAP = 1;
export const EXTRACTION_CONCURRENCY = 4;

/** Below this, a draft is held in the review queue and does not enter the matrix. */
export const CONFIDENCE_THRESHOLD = 0.6;

/** Text-layer detection, spec §8 step 3: fewer than 200 chars per page is a scan. */
export const MIN_CHARS_PER_PAGE = 200;

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const MAX_DOCUMENTS_PER_TENDER = 6;

/** Invariant 1 and its CHECK constraint, spec §7.5 / §7.8. */
export const QUOTED_CLAUSE_MIN_LENGTH = 1;
export const QUOTED_CLAUSE_MAX_LENGTH = 1200;

export interface PageText {
  /** True 1-based page number from pdf.js — never a chunk-relative index. */
  pageNumber: number;
  text: string;
}

export interface ChunkPlan {
  index: number;
  startPage: number;
  endPage: number;
}

export interface DocumentChunk extends ChunkPlan {
  text: string;
}

/**
 * The window plan for a document. Consecutive windows overlap by exactly
 * `CHUNK_PAGE_OVERLAP` pages, and the last window always ends on the last page.
 */
export function planChunks(pageCount: number): ChunkPlan[] {
  if (pageCount < 1) return [];
  const stride = CHUNK_PAGE_SPAN - CHUNK_PAGE_OVERLAP;
  const plans: ChunkPlan[] = [];
  for (let startPage = 1; startPage <= pageCount; startPage += stride) {
    const endPage = Math.min(startPage + CHUNK_PAGE_SPAN - 1, pageCount);
    plans.push({ index: plans.length, startPage, endPage });
    if (endPage === pageCount) break;
  }
  return plans;
}

/** Spec §8 step 3. Cheap, runs before any model call, and fails loudly. */
export function hasTextLayer(totalCharacters: number, pageCount: number): boolean {
  if (pageCount < 1) return false;
  return totalCharacters >= MIN_CHARS_PER_PAGE * pageCount;
}

/**
 * What the model returns per chunk. Field names are camelCase because each one
 * becomes a `requirements` column; the nested `constraint` keeps snake_case keys.
 * `documentId`, `tenderId` and `orgId` are attached by `persist.ts` from the
 * request, never by the model.
 */
export const RequirementDraftSchema = z
  .object({
    kind: z.enum(REQUIREMENT_KINDS),
    obligation: z.enum(OBLIGATIONS),
    summary: z.string().min(1).max(200),
    constraint: RequirementConstraintSchema,
    /** True page number within the source document. Invariant 1. */
    pageNumber: z.number().int().positive(),
    /** Verbatim. Invariant 1, and the CHECK in spec §7.8. */
    quotedClause: z.string().min(QUOTED_CLAUSE_MIN_LENGTH).max(QUOTED_CLAUSE_MAX_LENGTH),
    clauseReference: z.string().max(64).nullish(),
    questionRef: z.string().max(120).nullish(),
    wordLimit: z.number().int().positive().nullish(),
    weighting: z.number().min(0).max(100).nullish(),
    extractionConfidence: z.number().min(0).max(1),
  })
  .refine((d) => constraintMatchesKind(d.kind, d.constraint), {
    message: 'constraint.kind must equal the requirement kind',
    path: ['constraint', 'kind'],
  })
  .refine((d) => d.kind === 'question' || (d.questionRef == null && d.wordLimit == null), {
    message: 'questionRef and wordLimit are only valid when kind is "question"',
    path: ['questionRef'],
  });

export type RequirementDraft = z.infer<typeof RequirementDraftSchema>;

/** The structured-output envelope. A single object keeps the schema addressable. */
export const ExtractionBatchSchema = z.object({
  drafts: z.array(RequirementDraftSchema),
});

export type ExtractionBatch = z.infer<typeof ExtractionBatchSchema>;

/**
 * POST /api/extract-requirements — the only hand-written HTTP endpoint in the app
 * (spec §6.1), and the only place `ANTHROPIC_API_KEY` is read.
 *
 * The route builds its request as:
 *
 *   client.messages.parse({
 *     model: EXTRACTION_MODEL,
 *     max_tokens: 8000,
 *     system: extractionSystemPrompt(request),
 *     messages: [{ role: 'user', content: request.chunk.text }],
 *     output_config: { format: zodOutputFormat(ExtractionBatchSchema, 'requirements') },
 *   })
 *
 * `zodOutputFormat` comes from '@anthropic-ai/sdk/helpers/zod'. Note the parameter
 * is `output_config.format` — the older top-level `output_format` is deprecated.
 */
export interface ExtractRequirementsRequest {
  /** Echoed back on the response so a result can never be attributed to the wrong document. */
  documentId: string;
  filename: string;
  docType: DocumentType;
  chunk: DocumentChunk;
}

export interface ExtractRequirementsSuccess {
  ok: true;
  documentId: string;
  chunkIndex: number;
  model: string;
  drafts: RequirementDraft[];
  /** Drafts the model returned that failed `RequirementDraftSchema`. Counted, never hidden. */
  rejectedCount: number;
}

export interface ExtractRequirementsFailure {
  ok: false;
  documentId: string;
  chunkIndex: number;
  error: { code: ExtractionErrorCode; message: string };
}

export type ExtractRequirementsResponse = ExtractRequirementsSuccess | ExtractRequirementsFailure;

export const EXTRACTION_ERROR_CODES = [
  'no_text_layer',
  'model_error',
  'invalid_output',
  'rate_limited',
  'timeout',
] as const;
export type ExtractionErrorCode = (typeof EXTRACTION_ERROR_CODES)[number];

/**
 * The outcome of extracting one document. Spec §8: one chunk failing does not fail
 * the document, and the failed-chunk count is stored on the event and shown in the
 * Documents tab. A pipeline that unions an empty result into a total and reports
 * success is the most dangerous failure mode here, because it looks like success.
 */
export interface DocumentExtractionOutcome {
  documentId: string;
  chunksTotal: number;
  chunksSucceeded: number;
  chunksFailed: number;
  /** Passed `RequirementDraftSchema` and cleared `CONFIDENCE_THRESHOLD`. */
  draftsAccepted: number;
  /** Held in the review queue below `CONFIDENCE_THRESHOLD`. Not in the matrix. */
  draftsHeldForReview: number;
  /** Failed Zod. Counted so a shape problem is visible rather than silent. */
  draftsRejected: number;
  /** Survived deduplication and became a `Requirement`. */
  requirementsCreated: number;
  /** Losing duplicates whose provenance became a `RequirementCitation`. */
  citationsCreated: number;
}

/**
 * The system prompt, spec §8. `EXTRACTION_RULES` is the fixed half; the caller
 * appends the document's identity so page numbers land in the right place.
 */
export const EXTRACTION_RULES = `You extract obligations from UK public-sector tender documents into a typed requirements matrix. A bid manager will act on what you return, and every row you emit will be shown to them beside the clause it came from.

WHAT TO EXTRACT
Extract only what the text states. Never infer an obligation from sector convention, from what a buyer usually asks for, or from the document's title. If the pages you were given do not state it, it does not exist.

CITATIONS — the hard rule
Every requirement carries a true page number and a verbatim quoted clause.
- pageNumber is the real page of the source PDF. Each chunk tells you its page range; use the page the clause actually appears on, not the first page of the chunk.
- quotedClause is copied character-for-character from the text. Do not paraphrase, tidy, expand abbreviations or join sentences that were separate.
- If you cannot quote it, do not emit it. A wrong citation is worse than a missing requirement, because it destroys the trust the whole matrix depends on.
- Keep the quote under 1200 characters. Where a clause is longer, quote the operative sentence.

OBLIGATION
- mandatory — binding language ("must", "shall", "is required to"), an explicit pass/fail gate, or a stated consequence of exclusion ("failure to provide this will result in your bid being rejected").
- desirable — scored, weighted, preferred, "will be viewed favourably", or worth marks without being a gate.
- informational — context, background, or a statement of fact carrying no obligation.
Default to desirable when the language is genuinely ambiguous. Over-calling mandatory turns a winnable bid into a no-bid, which is the most expensive mistake you can make here.

KIND AND CONSTRAINT
Choose one kind and emit the matching constraint object. Keys are snake_case exactly as written.
- certification — { "kind": "certification", "credential_code": "ISO27001" }
  Use one of: ISO9001, ISO14001, ISO27001, ISO45001, CYBER_ESSENTIALS, CYBER_ESSENTIALS_PLUS, CHAS, SAFECONTRACTOR, CONSTRUCTIONLINE, SSIP, DSPT, BS_EN_1276.
  If the buyer names a scheme not on that list, emit kind "other" with original_kind "certification" and the scheme name in credential_code. Do not guess the nearest match.
- financial — { "kind": "financial", "metric": "annual_turnover", "operator": "gte", "value": 5000000, "currency": "GBP", "years_required": 1, "basis": "each_year" }
  metric: annual_turnover, net_assets, profit_before_tax, current_ratio, credit_score. operator: gte, gt, lte, lt, eq. basis: each_year, any_year, average.
- insurance — { "kind": "insurance", "insurance_kind": "employers_liability", "min_cover": 10000000, "currency": "GBP" }
  insurance_kind: employers_liability, public_liability, professional_indemnity, product_liability, cyber, contract_works, motor_fleet.
- experience — { "kind": "experience", "min_count": 3, "min_value": 500000, "currency": "GBP", "within_last_months": 36, "sector": "healthcare", "public_sector_only": true, "referee_required": true }
  Include only the filters the clause actually states.
- policy — { "kind": "policy", "policy_type": "modern_slavery" }
  policy_type: modern_slavery, equality, environmental, health_safety, data_protection.
- question — { "kind": "question", "response_format": "method_statement" }
  For ITT questions and method statements. Put the question's own label in questionRef ("Method Statement 3"), its word limit in wordLimit, and its share of the total score in weighting.
- date — { "kind": "date", "date_kind": "submission_deadline", "occurs_at": "2026-09-14T12:00:00+01:00" }
  date_kind: clarification_deadline, submission_deadline, site_visit, presentation, award_notification, contract_start, contract_end. Resolve the instant from the document, including the stated time and UK offset. If no time is given, use 12:00 local.
- legal_status, resource, other — for obligations that fit nothing above. Keep the clause; the matrix will show it without evaluating it.

NUMBERS
Emit numbers and currency separately. value is 5000000, currency is "GBP". Never "£5 million", never "5m", never a string. Percentages are plain numbers: 30, not "30%".

DUPLICATES
If the same obligation appears in two documents or twice in one, emit it each time with its own citation. Deduplication happens downstream and both citations are kept, so a second mention costs nothing and a suppressed one loses evidence.

CONFIDENCE
extractionConfidence is your honest probability, 0 to 1, that this requirement is correctly extracted and correctly typed. Anything below 0.6 goes to a human review queue rather than the matrix, which is a useful outcome. Low confidence is useful; false confidence is not. Do not inflate to look decisive.

If a chunk contains no obligations, return an empty list. An empty list is a valid, useful answer.`;

/** Appends the per-document context to `EXTRACTION_RULES`. */
export function extractionSystemPrompt(request: ExtractRequirementsRequest): string {
  const { filename, docType, chunk } = request;
  return (
    EXTRACTION_RULES +
    '\n\nTHIS CHUNK\n' +
    'Document: ' +
    filename +
    ' (type: ' +
    docType +
    ')\n' +
    'Pages ' +
    chunk.startPage +
    ' to ' +
    chunk.endPage +
    ' of the source PDF. Page markers appear inline in the text; pageNumber must be one of these.'
  );
}

/* ============================================================================
 * 6. CapabilitySnapshot — the entire evidence surface, spec §7.4.
 *
 * Nothing else about the supplier may enter this type. If the evaluator needs a
 * fact that is not here, the answer is `unknown`, not a new field.
 * ========================================================================== */

export interface CredentialFact {
  id: string;
  code: string;
  reference: string | null;
  issuedOn: Date | null;
  /** Null means DOES NOT EXPIRE. It never means missing. Spec §7.4, §9, §14. */
  expiresOn: Date | null;
}

export interface FinancialYearFact {
  id: string;
  yearEnding: Date;
  /** A null metric on a filed year is the `unknown` case, not a zero. */
  turnover: Money | null;
  netAssets: Money | null;
  profitBeforeTax: Money | null;
  currency: string;
}

export interface InsuranceFact {
  id: string;
  kind: InsuranceType;
  coverAmount: Money;
  currency: string;
  insurer: string | null;
  expiresOn: Date | null;
}

export interface PastProjectFact {
  id: string;
  clientName: string;
  title: string;
  contractValue: Money | null;
  currency: string;
  sector: string | null;
  startedOn: Date | null;
  /** Null means ongoing. */
  endedOn: Date | null;
  isPublicSector: boolean;
  refereeContactable: boolean;
}

export interface PolicyFact {
  id: string;
  policyType: string;
  title: string | null;
  lastReviewed: Date | null;
}

export interface CapabilitySnapshot {
  orgId: string;
  headcount: number | null;
  registeredRegion: string | null;
  credentials: CredentialFact[];
  financialYears: FinancialYearFact[];
  insurances: InsuranceFact[];
  pastProjects: PastProjectFact[];
  policies: PolicyFact[];
}

/* ============================================================================
 * 7. Evaluation — spec §9. `evaluate` is pure: no network, no model, no clock
 * except the injected `asOf`.
 * ========================================================================== */

/** Where a piece of evidence came from. Renders in the drawer and the result row. */
export const EVIDENCE_SOURCES = [
  'credential',
  'financial_year',
  'insurance',
  'past_project',
  'policy',
  'organisation',
] as const;
export type EvidenceSource = (typeof EVIDENCE_SOURCES)[number];

export interface EvidenceRef {
  source: EvidenceSource;
  /** The row id, or null for an organisation-level fact. */
  id: string | null;
  /** Human-readable, rendered as-is. */
  label: string;
  /** The quantitative detail — "£1,400,000 · ended Mar 2025 · public sector". */
  detail?: string;
  /**
   * For `experience`: whether this project counted toward `min_count`.
   *
   * Spec §9 requires the user to see which ones counted *and which fell short*, so
   * an experience outcome returns every past project in the snapshot with this flag
   * set on each — not only the matches. A row the user cannot see is a row they
   * will re-check by hand.
   */
  counted?: boolean;
}

/** A requirement reduced to what the evaluator is allowed to see. */
export interface EvaluableRequirement {
  id: string;
  kind: RequirementKind;
  obligation: Obligation;
  summary: string;
  constraint: RequirementConstraint;
}

export interface EvaluationInput {
  /** The injected clock. The evaluator calls no other. */
  asOf: Date;
  /** Earliest `submission_deadline` KeyDate, from `getSubmissionDeadline()`. */
  submissionDeadline: Date | null;
  snapshot: CapabilitySnapshot;
  requirements: EvaluableRequirement[];
}

/** The per-requirement shape — `evaluate(input) -> { verdict, rationale, evidence[] }`. */
export interface RequirementOutcome {
  verdict: Verdict;
  /** Quantitative wherever the data allows. Stored, then rendered verbatim by the UI. */
  rationale: string;
  evidence: EvidenceRef[];
  /** e.g. a certificate expiring 21 days after the deadline. */
  warning?: string | null;
}

/** One row of `assessment_results`. */
export interface RequirementEvaluation extends RequirementOutcome {
  requirementId: string;
}

/** Maps 1:1 onto the count columns of `assessments`. */
export interface MandatoryCounts {
  mandatoryTotal: number;
  mandatoryPassed: number;
  mandatoryFailed: number;
  mandatoryUnknown: number;
}

export interface EvaluationResult extends MandatoryCounts {
  recommendation: BidRecommendation;
  /** 0–100 coverage of desirable requirements; null when there are none to score. */
  desirableScore: number | null;
  results: RequirementEvaluation[];
  /** Recorded on the assessment so an old version stays re-explainable. Spec §7.6. */
  deadlineUsed: Date | null;
  asOfUsed: Date;
}

/** The frozen signature. `src/lib/qualify/evaluate.ts` implements exactly this. */
export type Evaluate = (input: EvaluationInput) => EvaluationResult;

/** Context handed to each per-kind rule. */
export interface EvaluationContext {
  asOf: Date;
  submissionDeadline: Date | null;
  snapshot: CapabilitySnapshot;
}

export type EvaluateRequirement = (
  requirement: EvaluableRequirement,
  context: EvaluationContext,
) => RequirementOutcome;

/* --- The three pieces of arithmetic. One definition each, and this is it. --- */

/**
 * Spec §9. Three lines, and the model is nowhere near them.
 *
 *   any mandatory fail    -> no_bid
 *   any mandatory unknown -> review
 *   otherwise             -> bid
 */
export function recommend(counts: MandatoryCounts): BidRecommendation {
  if (counts.mandatoryFailed > 0) return 'no_bid';
  if (counts.mandatoryUnknown > 0) return 'review';
  return 'bid';
}

/**
 * `mandatoryTotal` counts mandatory requirements the evaluator could actually rule
 * on. A mandatory ITT question is `not_applicable` to eligibility (spec §9) and is
 * excluded, which keeps `total === passed + failed + unknown` true on every
 * assessment — the property the verdict block's counts line depends on.
 */
export function tallyMandatory(
  rows: readonly { obligation: Obligation; verdict: Verdict }[],
): MandatoryCounts {
  const counts: MandatoryCounts = {
    mandatoryTotal: 0,
    mandatoryPassed: 0,
    mandatoryFailed: 0,
    mandatoryUnknown: 0,
  };
  for (const row of rows) {
    if (row.obligation !== 'mandatory') continue;
    if (row.verdict === 'pass') counts.mandatoryPassed += 1;
    else if (row.verdict === 'fail') counts.mandatoryFailed += 1;
    else if (row.verdict === 'unknown') counts.mandatoryUnknown += 1;
    else continue;
    counts.mandatoryTotal += 1;
  }
  return counts;
}

/**
 * `Assessment.desirableScore` — the share of scoreable desirable requirements that
 * pass, 0–100 to 2dp. Desirable requirements that are `not_applicable` are not
 * scoreable and are excluded; null when none are left.
 */
export function desirableCoverage(
  rows: readonly { obligation: Obligation; verdict: Verdict }[],
): number | null {
  const scoreable = rows.filter(
    (r) => r.obligation === 'desirable' && r.verdict !== 'not_applicable',
  );
  if (scoreable.length === 0) return null;
  const passed = scoreable.filter((r) => r.verdict === 'pass').length;
  return Math.round((passed / scoreable.length) * 10000) / 100;
}

/* --- Evaluation constants, spec §9 and §14. --- */

/** A credential expiring within this many days AFTER the deadline passes, with a warning. */
export const CREDENTIAL_EXPIRY_WARNING_DAYS = 30;

/** A policy last reviewed longer ago than this passes, with a warning. Never a fail. */
export const POLICY_REVIEW_WARNING_MONTHS = 24;

/* ============================================================================
 * 8. Audit — spec §7.7. Every state change appends exactly one event in the same
 * transaction as the change.
 * ========================================================================== */

export const ACTOR_KINDS = ['user', 'system', 'model'] as const;
export type ActorKind = (typeof ACTOR_KINDS)[number];

export const EVENT_ACTIONS = [
  'tender.created',
  'document.uploaded',
  'extraction.completed',
  'extraction.failed',
  'assessment.run',
  'result.overridden',
  'profile.updated',
  'tender.status_changed',
  'response.updated',
  'task.created',
] as const;
export type EventAction = (typeof EVENT_ACTIONS)[number];

/** `extraction.completed` — the Documents tab and the audit log both read this. */
export interface ExtractionCompletedPayload extends Omit<DocumentExtractionOutcome, 'documentId'> {
  model: string;
  filename: string;
}

/** `assessment.run` — the audit log shows the version and the inputs it used. */
export interface AssessmentRunPayload {
  version: number;
  recommendation: BidRecommendation;
  mandatoryTotal: number;
  mandatoryPassed: number;
  mandatoryFailed: number;
  mandatoryUnknown: number;
  desirableScore: number | null;
  deadlineUsed: string | null;
  asOfUsed: string;
}

/** `result.overridden` — who changed a verdict, from what, to what, and why. */
export interface ResultOverriddenPayload {
  requirementId: string;
  requirementSummary: string;
  from: Verdict;
  to: Verdict;
  note: string;
}

/* ============================================================================
 * 9. Interface copy and tokens.
 *
 * Frozen here because these strings and values appear in more than one session's
 * work, and spec §11's rules are only true if there is one copy of each.
 * ========================================================================== */

/** Spec §8 step 3 — stored verbatim on `tender_documents.extraction_error`. */
export const NO_TEXT_LAYER_MESSAGE =
  'This PDF has no text layer. Verdict reads text-based PDFs only — try the buyer’s original download rather than a scan.';

/** Spec §14 — zero requirements is not an empty matrix. */
export const NO_REQUIREMENTS_MESSAGE =
  'No requirements found in this document — check it’s the right file, or the type tag.';

/** Spec §12.6 — where `filePath` is null. Never a dead link. */
export const SOURCE_FILE_NOT_RETAINED_MESSAGE =
  'Source file not retained — clause text above is verbatim.';

/** Spec §10.2 — the Workspace tab before the tender is a bid. */
export const WORKSPACE_NOT_BIDDING_MESSAGE = 'This tender hasn’t been marked as a bid yet.';

/** Spec §11 — empty states are invitations. */
export const EMPTY_PIPELINE_MESSAGE = 'No tenders yet. Upload a pack to get your first verdict.';

/** Spec §14 — rejected client-side before parsing, with the size named. */
export function uploadTooLargeMessage(bytes: number): string {
  const mb = (bytes / (1024 * 1024)).toFixed(1);
  const limitMb = MAX_UPLOAD_BYTES / (1024 * 1024);
  return (
    'This file is ' +
    mb +
    'MB. Verdict reads packs up to ' +
    limitMb +
    'MB — split it, or upload the documents separately.'
  );
}

export function tooManyDocumentsMessage(count: number): string {
  return (
    'A pack takes up to ' +
    MAX_DOCUMENTS_PER_TENDER +
    ' documents. You selected ' +
    count +
    ' — remove ' +
    (count - MAX_DOCUMENTS_PER_TENDER) +
    ' and upload again.'
  );
}

/** Spec §11 palette. Five values, no gradients, no others. There is no green. */
export const PALETTE = {
  /** Text, and the near-black verdict block. */
  ink: '#161719',
  /** Background. */
  paper: '#FBFBF9',
  /** Hairline dividers, 1px. */
  rule: '#DEDDD6',
  /** Failures only. */
  flag: '#B3261E',
  /** Unknowns and review only. */
  pending: '#8A6D1F',
} as const;

/** Spec §12.3 — the leading word on a pipeline row, and its colour. */
export const RECOMMENDATION_LABELS: Record<BidRecommendation, string> = {
  no_bid: 'NO BID',
  review: 'REVIEW',
  bid: 'BID',
};

export const RECOMMENDATION_COLOURS: Record<BidRecommendation, keyof typeof PALETTE> = {
  no_bid: 'flag',
  review: 'pending',
  bid: 'ink',
};

/** Content column max width, spec §11 / §12.1. */
export const CONTENT_MAX_WIDTH_PX = 1100;

/** The drawer slide, spec §12.6. The only animation in the application. */
export const DRAWER_ANIMATION_MS = 320;

/** Spec §10.1 / §12.3 — a countdown inside this many days renders in `--flag`. */
export const DEADLINE_SOON_DAYS = 7;

/** Spec §10.3 — profile expiry flagged at 90 days (`--pending`) and 30 (`--flag`). */
export const PROFILE_EXPIRY_PENDING_DAYS = 90;
export const PROFILE_EXPIRY_FLAG_DAYS = 30;

/** Spec §7.7 — ILIKE over title and body plus tag overlap, top 3. */
export const LIBRARY_SUGGESTION_LIMIT = 3;
