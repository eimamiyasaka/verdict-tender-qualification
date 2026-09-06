# Verdict — Tender Qualification Platform

**Specification v2.0 · FROZEN**

Written before the build clock starts.

**Read order for any agent session:** this file, then `contracts.ts`, then your brief in `prompts/`. Both are read-only. If you need a change to either, stop and ask.

---

## 1. Summary

A public-sector bid pack lands as 60–120 pages across five or six PDFs. Before anyone writes a word, someone has to read all of it to find out whether the company is even allowed to bid. That read takes most of a day, and its most common outcome is discovering — after the fact — that a mandatory certification was missing on page 84.

Verdict shreds the pack into a verifiable requirements matrix, joins it against a structured company profile, and returns a bid / no-bid / review call in minutes. Every requirement cites a document, page and verbatim clause. Every verdict is computed deterministically from stated facts, never inferred by a language model.

Once the call is "bid", the same requirements become the bid workspace: assignable tasks, drafted responses seeded from a library of past answers, and a deadline view across the pipeline.

**One-line pitch:** stop losing weekends to tenders you were never eligible for.

---

## 2. The user

**Primary:** the person at a 20–200 person UK company who owns bids. At an SME this is an operations director or business development manager doing it alongside their real job, four to twelve times a year. At a larger firm it's a bid manager with a small desk.

**Secondary:** bid consultancies who qualify opportunities on behalf of several clients and need the profile switching.

**What their day looks like now.** A notice arrives from Find a Tender or an alerting service. They download the pack. They skim for the deadline, then read the Procurement Specific Questionnaire for the eligibility gates, then the Invitation to Tender for the questions they'll have to answer, then the evaluation methodology to see how it's marked. They keep notes in a Word document and a spreadsheet. Three weeks later they submit, or they don't.

**The three failures the product exists to prevent:**

1. **Wasted bids.** 30–60 hours spent on something with a disqualifying gate that was visible on day one.
2. **Technical disqualification.** A lapsed certificate, a missed clarification deadline, an exceeded word count.
3. **Invisible unknowns.** Not knowing what you don't know — the requirement nobody checked because nobody read that appendix.

---

## 3. Market position — state this honestly in the README

This is a real, crowded, consolidating market. That is the point: willingness to pay is already proven.

- **AutogenAI** — enterprise, full lifecycle, quote-based pricing.
- **mytender.io** — UK SME, pipeline and section assignment, subscription.
- **Responsive / Loopio / QorusDocs** — private-sector RFP, library-led.
- **Stotles** — public-sector pipeline discovery, $13m Series A, 1,000+ customers.
- **Lucius AI** — free no-signup tender scan returning a compliance matrix, page-cited findings and a bid/no-bid call.
- **CleanTender / SwiftBid** — sector-specific, £99–£149 entry pricing.

**The wedge.** Discovery tools are good at "which buyers should we target." Drafting tools are good at "write the answer." The verification layer between them — page-cited requirement extraction, deterministic eligibility checking against a structured company profile, and an audit trail — is the part that is hardest to get from a general assistant and the part nobody covers end to end.

**The narrower wedge inside that.** Several tools now extract requirements with page citations. Almost none hold a structured, machine-readable profile of the supplier and evaluate the two against each other *without a model in the decision path*. Verdict's differentiator is not the extraction; it is that the verdict is arithmetic over typed facts, reproducible, and unit-tested. A reviewer can read `evaluate()` in ninety seconds and know exactly why the answer is what it is.

Do not claim novelty anywhere in the submission. Claim a specific, defensible slice of a validated market.

---

## 4. Scope

### In scope for v1

| # | Capability | Why it's in |
|---|---|---|
| 1 | Multi-document upload per tender, typed by role | The pack is the unit of work, not the file |
| 2 | Page-cited requirement extraction into typed constraints | The core artefact |
| 3 | Structured company profile (credentials, financials, insurance, projects, policies) | The other half of the join |
| 4 | Deterministic qualification engine with three-valued verdicts | The differentiator |
| 5 | Versioned assessments with bid / no-bid / review recommendation | The decision |
| 6 | Requirements matrix UI with citation drawer | Where trust is won or lost |
| 7 | Bid workspace: tasks, assignment, response drafting | Turns a scanner into a platform |
| 8 | Answer library with keyword/tag reuse | The reason it compounds |
| 9 | Pipeline view across tenders with deadlines | The reason it's a subscription |
| 10 | Append-only audit log | The reason it's defensible |

### Explicitly out of scope — say so, don't hide it

- Semantic/vector search over the answer library (keyword + tags only)
- OCR for scanned PDFs — text-layer PDFs only, and it fails loudly rather than silently
- Automatic ingestion from Find a Tender (manual upload only)
- Pricing schedule (`.xlsx`) parsing
- Multi-lot bidding — one lot per tender record
- Email notifications, billing, win/loss analytics
- **Durable storage of user-uploaded PDFs.** Seeded packs are served as static files. A pack uploaded at runtime is read in the browser, its text extracted, and the file itself is not persisted. See §6.4 for why, and §13 for what the UI does about it.
- **Database-enforced row-level security.** Tenancy is enforced in one server-side helper instead. See §6.3 for the trade-off, and say it plainly in the README rather than letting a reviewer find it.

Naming these is the scope-judgement evidence. Each one has a real reason: OCR needs a vision pipeline and a fallback UX; vector search needs an embedding store and adds a dependency for marginal gain at demo scale; portal ingestion needs a scraper and a scheduler.

---

## 5. Domain vocabulary — use these words exactly, in code and UI

| Term | Meaning |
|---|---|
| **Tender** | A published public-sector opportunity. The unit of work. |
| **Pack** | The set of documents issued for one tender. |
| **PSQ** | Procurement Specific Questionnaire. The eligibility gate. Introduced by the Procurement Act 2023 (in force 24 Feb 2025), replacing the old Selection Questionnaire. Fail it and you never see the ITT. |
| **ITT** | Invitation to Tender. The stage where you write method statements and submit pricing. |
| **Conditions of Participation** | The Act's term for selection criteria: financial standing and technical ability, which must be proportionate to contract value. |
| **Requirement** | One extracted obligation. Mandatory, desirable or informational. |
| **Mandatory** | A pass/fail gate. Failing one is disqualifying regardless of bid quality. |
| **Method statement** | A long-form written answer to an ITT question, usually word-limited and weighted. |
| **Most Advantageous Tender** | The award standard — highest scoring against published criteria, not cheapest. |
| **Clarification deadline** | Usually a week before submission. The last chance to ask the buyer a question. Missing it is a classic own goal. |
| **Framework / call-off** | A pre-approved supplier panel, and the individual contracts let from it. |

Never say "job", "opportunity record", "item", "check" or "score" where one of these words fits.

---

## 6. Architecture

```
┌────────────────────────────────────────────────────────────────┐
│  Next.js 15 · App Router · TypeScript · Tailwind · shadcn/ui   │
│  Deployed on Vercel                                            │
│                                                                │
│  Server Components read data. Server Actions write it.         │
│  pdf.js runs IN THE BROWSER → per-page text + true page nos.   │
└──────────────┬───────────────────────────────┬─────────────────┘
               │ page-indexed chunks           │ Prisma Client
               ▼                               │ (server only)
┌──────────────────────────────────┐           │
│  POST /api/extract-requirements  │           │
│  · ANTHROPIC_API_KEY lives here  │           │
│  · one call per 5-page chunk     │           │
│  · structured output →           │           │
│    RequirementDraft[]            │           │
└──────────────┬───────────────────┘           │
               │                               │
               ▼                               ▼
┌────────────────────────────────────────────────────────────────┐
│  Supabase Postgres  ·  schema owned by Prisma Migrate          │
│  Supabase Auth      ·  identity only, never queried for data   │
└────────────────────────────────┬───────────────────────────────┘
                                 ▼
┌────────────────────────────────────────────────────────────────┐
│  Qualification engine — PURE TYPESCRIPT · src/lib/qualify/     │
│  evaluate(input) → { verdict, rationale, evidence[] }          │
│  No network. No model. No clock except the injected asOf.      │
│  Runs on the server; identical code runs in Vitest.            │
└────────────────────────────────────────────────────────────────┘
```

### 6.1 Why Next.js rather than a SPA plus an API

Prisma cannot run in a browser, so a Vite SPA would need a hand-written API layer, CORS handling and a serialisation seam between two codebases. App Router collapses all of that: a Server Component calls a data function directly, a Server Action mutates and revalidates, and one Vercel deploy covers both. The only hand-written HTTP endpoint in the app is the extraction route, and it exists solely because the Anthropic key must not reach the client.

### 6.2 Why Prisma rather than the Supabase client

The Supabase JS client is a thin PostgREST wrapper. It pushes tenancy into database policies and typing into generated row types, which is a reasonable trade when the client talks to the database directly. Once there is a server in the path, Prisma gives a single typed data layer, migrations under version control, a schema readable as one file, and a seed script that is ordinary TypeScript. Supabase remains the Postgres host and the identity provider; nothing else about it is load-bearing.

### 6.3 Tenancy without RLS — the trade-off, stated

Prisma connects as the database owner and bypasses row-level security by design. Keeping RLS would mean wrapping every transaction in a `SET LOCAL request.jwt.claims` dance, which is fragile under a two-hour clock and easy to get subtly wrong.

**The rule instead:** every column that can belong to an organisation carries `orgId`, and every Prisma call in the codebase lives inside `src/lib/db/` and takes an `orgId` argument that comes from the session, never from a URL, form field or request body. No Prisma call may be written anywhere else in the app.

This is weaker than a database guarantee and the README must say so. It is compensated by a test — `src/lib/db/__tests__/tenancy.test.ts` — that creates a second organisation and asserts that every exported read function returns nothing belonging to the first. A reviewer looking for the multi-tenancy answer will find that test.

### 6.4 Files

The three seeded packs are committed as static assets under `public/packs/` and referenced by relative path. The citation drawer's *open source PDF at page N* link is therefore a plain `<a href="/packs/nhs/psq.pdf#page=31">`, with no signed URLs, no bucket, no storage policies and no upload failure mode on the demo path.

A pack uploaded at runtime is read into memory by pdf.js, its text extracted and sent for extraction, and the file itself is discarded. Requirements from it keep their document name, page and verbatim clause — everything the drawer needs except the link back to the PDF, which the UI states explicitly rather than rendering a dead control. This is a real limitation; it is also the correct cut, because durable file storage buys the demo nothing and costs a bucket, three policies and a class of failure at the least recoverable moment.

### 6.5 Why pdf.js in the browser

Page numbers come out correct and free, there is no server-side PDF dependency to install, and the file never has to leave the client except as text. Trade-off: large packs use browser memory, and a scanned PDF yields no text — detected explicitly (§8) and surfaced as a named error rather than an empty matrix.

### 6.6 Why the evaluator is pure

It makes the verdict reproducible, testable in seconds, and reviewable by a human reading the code rather than trusting a prompt. It is the single strongest engineering-judgement signal in the build, and it is the reason the demo can prove determinism live (§12).

---

## 7. Data model

**This section replaces `schema.sql`.** On the clock, one session generates `prisma/schema.prisma` from it, runs `prisma migrate dev --name init`, then hand-appends the two raw SQL blocks in §7.6 to the generated migration before it is applied. Every field name below is binding: the UI is built against these names in parallel, so a rename is a merge conflict, not a preference.

### 7.1 Conventions

- Prisma model names are PascalCase singular (`TenderDocument`); `@@map` gives every table its snake_case plural name (`tender_documents`); `@map` gives every field its snake_case column name. UI and application code use the Prisma camelCase names throughout.
- Every primary key is `String @id @default(uuid()) @db.Uuid` unless stated.
- Every table has `createdAt DateTime @default(now())`.
- Money is `Decimal @db.Decimal(14,2)`. Never `Float`. Currency is a separate `String @db.Char(3)`, ISO 4217, defaulting to `GBP`.
- Dates with no time component are `@db.Date`. Everything else is `DateTime` (timestamptz).
- Every child table carries `orgId String @db.Uuid` with a cascade-delete relation to `Organisation`, even where it is reachable through a parent. This is what makes §6.3's rule one identical expression everywhere.

### 7.2 Enums

Generated as Postgres enums by Prisma. Values are exactly these strings — `contracts.ts` mirrors several of them and the two must not drift.

| Enum | Values |
|---|---|
| `OrgRole` | `owner`, `admin`, `member` |
| `TenderStatus` | `draft`, `extracting`, `extraction_failed`, `extracted`, `assessed`, `bidding`, `submitted`, `won`, `lost`, `abandoned` |
| `DocumentType` | `contract_notice`, `specification`, `psq`, `itt`, `pricing_schedule`, `terms_and_conditions`, `evaluation_methodology`, `clarification_log`, `other` |
| `ExtractionStatus` | `pending`, `running`, `complete`, `failed` |
| `RequirementKind` | `certification`, `financial`, `insurance`, `experience`, `policy`, `legal_status`, `resource`, `question`, `date`, `other` |
| `Obligation` | `mandatory`, `desirable`, `informational` |
| `Verdict` | `pass`, `fail`, `unknown`, `not_applicable` |
| `BidRecommendation` | `bid`, `no_bid`, `review` |
| `TaskStatus` | `not_started`, `in_progress`, `in_review`, `complete` |
| `FinancialMetric` | `annual_turnover`, `net_assets`, `profit_before_tax`, `current_ratio`, `credit_score` |
| `InsuranceType` | `employers_liability`, `public_liability`, `professional_indemnity`, `product_liability`, `cyber`, `contract_works`, `motor_fleet` |
| `KeyDateKind` | `clarification_deadline`, `submission_deadline`, `site_visit`, `presentation`, `award_notification`, `contract_start`, `contract_end` |

### 7.3 Identity and tenancy

**`User` → `users`.** Prisma cannot own Supabase's `auth.users` table, and foreign keys pointing into another schema make the migration awkward. So the public schema holds a mirror row, and every user-referencing foreign key in the app points here.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid, PK | **Equals the Supabase auth user id.** Not generated — supplied on insert. |
| `email` | String, unique | |
| `displayName` | String? | |
| `createdAt` | DateTime | |

The mirror row is created in one place: `ensureUser()` in `src/lib/auth/`, called by the post-sign-in callback. It upserts on `id`. Nothing else writes to this table except the seed.

**`Organisation` → `organisations`**

| Field | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `name` | String | |
| `companiesHouseNumber` | String? | |
| `headcount` | Int? | |
| `registeredRegion` | String? | `England`, `Scotland`, … |
| `sicCodes` | String[] | default `[]` |
| `createdAt` | DateTime | |

**`Membership` → `memberships`**

| Field | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `orgId` | uuid → Organisation | cascade |
| `userId` | uuid → User | cascade |
| `role` | `OrgRole` | default `member` |
| `createdAt` | DateTime | |

`@@unique([orgId, userId])`, `@@index([userId])`.

A user belongs to exactly one organisation in v1. `getOrgContext()` resolves the session user to their single membership and throws if there is none; the UI never offers an org switcher.

### 7.4 Supplier capability

These five tables plus `Organisation.headcount` and `Organisation.registeredRegion` are the **entire** evidence surface the evaluator reads. Nothing else about the supplier may enter `CapabilitySnapshot`.

**`CredentialType` → `credential_types`** — reference data, seeded, not user-editable, not org-scoped.

| Field | Type | Notes |
|---|---|---|
| `code` | String, PK | `ISO27001`, `CYBER_ESSENTIALS_PLUS`, `CHAS` |
| `label` | String | display name |
| `category` | String? | `quality`, `security`, `hs`, `environmental` |

Seed rows, exactly:

```
ISO9001                 ISO 9001 Quality Management               quality
ISO14001                ISO 14001 Environmental Management        environmental
ISO27001                ISO 27001 Information Security            security
ISO45001                ISO 45001 Occupational H&S                hs
CYBER_ESSENTIALS        Cyber Essentials                          security
CYBER_ESSENTIALS_PLUS   Cyber Essentials Plus                     security
CHAS                    CHAS Accreditation                        hs
SAFECONTRACTOR          SafeContractor                            hs
CONSTRUCTIONLINE        Constructionline                          quality
SSIP                    SSIP Member Scheme                        hs
DSPT                    NHS Data Security & Protection Toolkit    security
BS_EN_1276              BS EN 1276                                quality
```

**`Credential` → `credentials`**

| Field | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `orgId` | uuid → Organisation | cascade |
| `code` | String → CredentialType.code | restrict |
| `reference` | String? | certificate number |
| `issuedOn` | Date? | |
| `expiresOn` | Date? | **null means does not expire** — the evaluator must treat null as valid, never as missing |
| `evidenceUrl` | String? | |

`@@unique([orgId, code])`, `@@index([orgId])`.

**`FinancialYear` → `financial_years`**

| Field | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `orgId` | uuid → Organisation | cascade |
| `yearEnding` | Date | |
| `turnover` | Decimal(14,2)? | |
| `netAssets` | Decimal(14,2)? | |
| `profitBeforeTax` | Decimal(14,2)? | |
| `currency` | Char(3) | default `GBP` |

`@@unique([orgId, yearEnding])`, `@@index([orgId, yearEnding])`.

A row may exist with a null metric. That is the case that produces `unknown` rather than `fail`, and it is the distinction the product is built on (§9).

**`Insurance` → `insurances`**

| Field | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `orgId` | uuid → Organisation | cascade |
| `kind` | `InsuranceType` | |
| `coverAmount` | Decimal(14,2) | |
| `currency` | Char(3) | default `GBP` |
| `insurer` | String? | |
| `expiresOn` | Date? | |

`@@unique([orgId, kind])`, `@@index([orgId])`.

**`PastProject` → `past_projects`**

| Field | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `orgId` | uuid → Organisation | cascade |
| `clientName` | String | |
| `title` | String | |
| `description` | String? | |
| `contractValue` | Decimal(14,2)? | |
| `currency` | Char(3) | default `GBP` |
| `sector` | String? | `healthcare`, `local_government`, `education`, … |
| `startedOn` | Date? | |
| `endedOn` | Date? | null means ongoing |
| `isPublicSector` | Boolean | default `false` |
| `refereeContactable` | Boolean | default `false` |

`@@index([orgId, endedOn])`.

**`Policy` → `policies`**

| Field | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `orgId` | uuid → Organisation | cascade |
| `policyType` | String | `modern_slavery`, `equality`, `environmental`, `health_safety`, `data_protection` |
| `title` | String? | |
| `lastReviewed` | Date? | |
| `documentUrl` | String? | |

`@@unique([orgId, policyType])`, `@@index([orgId])`.

### 7.5 Tender side

**`Tender` → `tenders`**

| Field | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `orgId` | uuid → Organisation | cascade |
| `title` | String | |
| `buyerName` | String? | |
| `source` | String? | `find_a_tender`, `contracts_finder`, `manual` |
| `noticeReference` | String? | OCID or notice id |
| `sourceUrl` | String? | |
| `contractValue` | Decimal(14,2)? | |
| `currency` | Char(3)? | default `GBP` |
| `durationMonths` | Int? | shown in the metadata line as "48 months" |
| `lotReference` | String? | |
| `status` | `TenderStatus` | default `draft` |
| `createdById` | uuid → User? | set null |
| `createdAt` / `updatedAt` | DateTime | `updatedAt` uses `@updatedAt` |

`@@index([orgId, status])`.

**`TenderDocument` → `tender_documents`**

| Field | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `tenderId` | uuid → Tender | cascade |
| `orgId` | uuid → Organisation | cascade |
| `filename` | String | as displayed in citations — `PSQ.pdf` |
| `docType` | `DocumentType` | default `other` |
| `filePath` | String? | **nullable.** Seeded packs: `/packs/nhs/psq.pdf`. Runtime uploads: null (§6.4) |
| `pageCount` | Int? | |
| `extractionStatus` | `ExtractionStatus` | default `pending` |
| `extractionError` | String? | the user-facing message, stored verbatim |
| `uploadedAt` | DateTime | default now |

`@@index([tenderId])`.

**`Requirement` → `requirements`** — the core table.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `tenderId` | uuid → Tender | cascade |
| `orgId` | uuid → Organisation | cascade |
| `kind` | `RequirementKind` | |
| `obligation` | `Obligation` | default `mandatory` |
| `summary` | String | one line, human readable, shown in the matrix |
| `constraintJson` | Json | a `RequirementConstraint` from `contracts.ts` |
| `documentId` | uuid → TenderDocument | **NOT NULL**, cascade |
| `pageNumber` | Int | **NOT NULL**, `> 0` |
| `quotedClause` | String | **NOT NULL**, 1–1200 chars, verbatim |
| `clauseReference` | String? | `4.2.1`, `Appendix C` |
| `questionRef` | String? | `Method Statement 3` — `kind = question` only |
| `wordLimit` | Int? | `kind = question` only |
| `weighting` | Decimal(5,2)? | percentage of total score |
| `extractionConfidence` | Decimal(3,2)? | 0–1 |

`@@index([tenderId, obligation])`, `@@index([tenderId, kind])`, `@@index([documentId])`.

**Invariant 1 — no citation, no requirement.** `documentId`, `pageNumber` and `quotedClause` are non-null at the database level. A requirement that cannot be pointed at was invented, and the database is the only referee that cannot be argued with.

**`RequirementCitation` → `requirement_citations`** — additional citations for a deduplicated requirement.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `requirementId` | uuid → Requirement | cascade |
| `orgId` | uuid → Organisation | cascade |
| `documentId` | uuid → TenderDocument | cascade |
| `pageNumber` | Int | |
| `quotedClause` | String | |
| `clauseReference` | String? | |

`@@index([requirementId])`.

When the same obligation appears in the PSQ and the ITT, one `Requirement` row survives deduplication and the losing draft's provenance lands here. The citation drawer lists the primary citation and then any of these. This is the table that makes "both citations are kept" true rather than aspirational.

**`KeyDate` → `key_dates`**

| Field | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `tenderId` | uuid → Tender | cascade |
| `orgId` | uuid → Organisation | cascade |
| `kind` | `KeyDateKind` | |
| `occursAt` | DateTime | |
| `documentId` | uuid → TenderDocument? | set null |
| `pageNumber` | Int? | |
| `quotedClause` | String? | |

`@@index([tenderId, occursAt])`.

The submission deadline the evaluator uses is the earliest `KeyDate` with `kind = submission_deadline` for that tender. That resolution lives in exactly one function, `getSubmissionDeadline(tenderId)` in `src/lib/db/tenders.ts`, and nothing re-derives it.

### 7.6 Assessment

**`Assessment` → `assessments`** — immutable. Never updated after insert.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `tenderId` | uuid → Tender | cascade |
| `orgId` | uuid → Organisation | cascade |
| `version` | Int | 1-based, per tender |
| `recommendation` | `BidRecommendation` | |
| `mandatoryTotal` | Int | default 0 |
| `mandatoryPassed` | Int | default 0 |
| `mandatoryFailed` | Int | default 0 |
| `mandatoryUnknown` | Int | default 0 |
| `desirableScore` | Decimal(5,2)? | 0–100 coverage of desirable requirements |
| `rationale` | String? | one-paragraph human-readable summary |
| `deadlineUsed` | DateTime? | the deadline the run evaluated against |
| `asOfUsed` | DateTime | the clock the run evaluated against |
| `runById` | uuid → User? | set null |

`@@unique([tenderId, version])`, `@@index([tenderId, version])`.

`deadlineUsed` and `asOfUsed` are what make an old assessment re-explainable months later. Without them, version 1 becomes unreadable the moment the deadline moves.

**`AssessmentResult` → `assessment_results`**

| Field | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `assessmentId` | uuid → Assessment | cascade |
| `requirementId` | uuid → Requirement | cascade |
| `orgId` | uuid → Organisation | cascade |
| `verdict` | `Verdict` | |
| `rationale` | String | quantitative, rendered verbatim in the UI |
| `evidence` | Json | `EvidenceRef[]`, default `[]` |
| `warning` | String? | e.g. certificate expiring 12 days before the deadline |
| `overriddenById` | uuid → User? | set null |
| `overrideNote` | String? | |

`@@unique([assessmentId, requirementId])`, `@@index([assessmentId, verdict])`, `@@index([requirementId])`.

**Invariant 3 — assessments are never mutated.** Editing the profile creates version *n+1*. Version *n* stays exactly as it was, and the audit tab can show both.

**Version allocation.** `runAssessment` opens a Prisma interactive transaction, takes a Postgres advisory lock on `hashtext(tenderId)`, computes `max(version) + 1`, writes the assessment and its results, and commits. Two concurrent runs cannot both claim the same version.

### 7.7 Workspace and audit

**`BidTask` → `bid_tasks`**

| Field | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `tenderId` | uuid → Tender | cascade |
| `orgId` | uuid → Organisation | cascade |
| `requirementId` | uuid → Requirement? | set null |
| `title` | String | |
| `assigneeId` | uuid → User? | set null |
| `status` | `TaskStatus` | default `not_started` |
| `dueOn` | Date? | |
| `createdAt` / `updatedAt` | DateTime | |

`@@index([tenderId, status])`, `@@index([assigneeId])`.

**`Response` → `responses`**

| Field | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `requirementId` | uuid → Requirement, unique | cascade |
| `orgId` | uuid → Organisation | cascade |
| `body` | String | default `""` |
| `sourceAnswerId` | uuid → LibraryAnswer? | set null |
| `updatedById` | uuid → User? | set null |
| `createdAt` / `updatedAt` | DateTime | |

**Word count is computed in TypeScript, not by the database.** A generated column here is where the old schema had its only real bug: `regexp_split_to_array('', '\s+')` yields `{''}`, so every empty draft claimed one word. One function, `countWords(body: string): number` in `src/lib/text.ts`, trims, returns 0 for empty, and is unit-tested with the empty string as its first case.

**`LibraryAnswer` → `library_answers`**

| Field | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `orgId` | uuid → Organisation | cascade |
| `title` | String | |
| `body` | String | |
| `tags` | String[] | default `[]` |
| `sourceTenderId` | uuid → Tender? | set null |
| `timesUsed` | Int | default 0 |

`@@index([orgId])`.

v1 retrieval is `ILIKE` over title and body plus tag overlap, ranked by matched-term count then `timesUsed`, top 3. No tsvector index, no embeddings. At six seeded answers this is indistinguishable from anything cleverer, and the cut is stated in §4.

**`Event` → `events`** — append-only. Nothing updates or deletes here.

| Field | Type | Notes |
|---|---|---|
| `id` | BigInt, PK, autoincrement | |
| `orgId` | uuid → Organisation | cascade |
| `actorId` | uuid → User? | set null |
| `actorKind` | String | `user`, `system`, `model` — default `user` |
| `action` | String | `tender.created`, `document.uploaded`, `extraction.completed`, `assessment.run`, `result.overridden`, `profile.updated` |
| `subjectTable` | String? | |
| `subjectId` | uuid? | |
| `payload` | Json | default `{}` |
| `createdAt` | DateTime | |

`@@index([orgId, createdAt])`, `@@index([subjectTable, subjectId])`.

Every write path in `src/lib/db/` that changes state appends exactly one event in the same transaction as the change. If it isn't in the same transaction, it will eventually lie.

### 7.8 Two raw SQL blocks to append to the initial migration

Prisma cannot express either. Paste both into the generated migration file before applying it, and say in the README that this was deliberate.

**Invariant 2 — constraint shape enforced by the database.**

```sql
alter table requirements add constraint constraint_shape_valid check (
  case kind
    when 'certification' then constraint_json ? 'credential_code'
    when 'financial'     then constraint_json ?& array['metric','operator','value']
    when 'insurance'     then constraint_json ?& array['insurance_kind','min_cover']
    when 'experience'    then constraint_json ? 'min_count'
    when 'policy'        then constraint_json ? 'policy_type'
    else true
  end
);
```

A model that hallucinates a `certification` requirement with no `credential_code` gets a database error, not a row the evaluator cannot read. The same shapes are validated by Zod at the insert boundary in `src/lib/ingest/persist.ts`; the CHECK is the backstop for anything that bypasses it.

**Non-negotiable citation constraints:**

```sql
alter table requirements add constraint page_number_positive check (page_number > 0);
alter table requirements add constraint quoted_clause_length check (char_length(quoted_clause) between 1 and 1200);
```

### 7.9 Connection strings

Supabase gives two. Both are needed and confusing them costs ten minutes.

- `DATABASE_URL` — the **pooled** connection, port 6543, with `?pgbouncer=true&connection_limit=1`. Used by the app at runtime on Vercel.
- `DIRECT_URL` — the **direct** connection, port 5432. Used by `prisma migrate` only, declared as `directUrl` in the datasource block. Migrations fail in confusing ways over the pooler.

---

## 8. Extraction pipeline

### Flow

1. User uploads 1–6 PDFs to a tender and tags each with a `docType`.
2. A `TenderDocument` row is created with `extractionStatus = pending`. The file is not persisted (§6.4).
3. pdf.js extracts text per page in the browser. If total extracted characters `< 200 × pageCount`, the document is marked `failed` with the stored message: *"This PDF has no text layer. Verdict reads text-based PDFs only — try the buyer's original download rather than a scan."*
4. Text is chunked into 5-page windows with 1 page of overlap, each carrying its true page offsets. The overlap exists so a clause spanning a page break is never cut in half.
5. Chunks are POSTed to `/api/extract-requirements` at concurrency 4. Each returns `RequirementDraft[]`. `extractionStatus` moves to `running`, and per-chunk progress is shown.
6. Drafts with `extractionConfidence < 0.6` are held in a review queue and do not enter the matrix.
7. Surviving drafts are persisted through `src/lib/ingest/persist.ts`, which validates each with Zod, deduplicates on (`kind` + normalised `constraintJson`), keeps the highest-confidence draft as the `Requirement`, and writes every loser's provenance to `RequirementCitation`.
8. `tender.status → extracted`; one `Event` with the model name, chunk count and requirement count.

**One chunk failing does not fail the document.** Each chunk's result is recorded independently and the count of failed chunks is stored on the event and surfaced in the Documents tab. A pipeline that silently unions an empty result into a total and reports success is the single most dangerous failure mode here, because it looks exactly like success.

### Prompt contract

The system prompt is `EXTRACTION_RULES` from `contracts.ts` plus the JSON schema for `RequirementDraft`. Model: Claude Sonnet 4.6, structured output. The rules that matter most:

- Extract only what is stated. Never infer an obligation from sector convention.
- `quotedClause` must be verbatim. If you cannot quote it, do not emit it.
- `mandatory` only for binding language (*must*, *shall*, *failure to X will result in exclusion*) or an explicit pass/fail gate. Default to `desirable` when unsure.
- Emit numbers and currency separately. Never `"£5 million"` as a string.
- Same obligation in two documents → emit twice with both citations. Deduplication happens downstream.
- Report honest confidence. Low confidence is useful; false confidence is not.

### Why chunking rather than one long call

Page-accurate citations. A single 120-page call produces plausible page numbers that are frequently wrong, and a wrong citation is worse than no citation because it silently destroys the trust the whole product is built on.

---

## 9. Qualification engine

`evaluate(input: EvaluationInput) => EvaluationResult` — signature frozen in `contracts.ts`.

Pure function. No network, no model, no clock except the injected `asOf`. Lives in `src/lib/qualify/evaluate.ts`. Imports nothing from Prisma, Next or the database.

### Verdict semantics — do not improvise

| Verdict | Meaning |
|---|---|
| `pass` | Provably satisfied by data in the snapshot |
| `fail` | Provably violated by data in the snapshot |
| `unknown` | The snapshot lacks the data needed to decide |
| `not_applicable` | Informational, or scoped to a lot we're not bidding |

**The distinction that carries the product:** a missing credential is a `fail` — absence is knowable, because the profile is a closed world of certifications held. A missing financial year is `unknown` — we cannot see what was never entered. "You haven't told us your 2025 turnover" and "your turnover is £4.1m against a £5m threshold" are different sentences to a bid manager, and collapsing them into a red cross is how these tools lose trust in the first week.

### Per-kind logic

- **certification** — credential present? valid at the submission deadline? Absent → `fail`. Present with `expiresOn = null` → `pass`. Present but expiring within 30 days *after* the deadline → `pass` with a dated `warning`. Expired before the deadline → `fail` with the expiry date in the rationale.
- **financial** — compare the metric across the last N filed years, most recent first. Any required year missing, or present with a null metric → `unknown`, naming which year. Currency mismatch → `unknown` with an explicit rationale, never a silent conversion at an invented rate.
- **insurance** — cover ≥ minimum and not expired at the deadline. No policy of that kind recorded → `unknown`, not `fail`: an uninsured company and a company that hasn't filled in the form look identical from here, which is exactly why this differs from certification.
- **experience** — count projects matching value, recency, sector and public-sector filters. Returns the matching projects as `evidence` so the user sees which ones counted and which fell short.
- **policy** — policy of that type exists → `pass`. Present but `lastReviewed` over 24 months old → `pass` with a warning. Absent → `fail`.
- **question / date / legal_status / resource / other** — `not_applicable` to eligibility. Questions route to the workspace; dates route to `KeyDate`.

Every rationale is quantitative where the data allows it. *"FY2025 turnover £4,120,000 — short by £880,000"*, never *"turnover requirement not met"*.

### Recommendation

```
any mandatory fail    → no_bid
any mandatory unknown → review
otherwise             → bid
```

Three lines, in `recommend()` in `contracts.ts`. The model writes the prose summary that accompanies the call; the model does not make the call.

### Test coverage

This is the highest-tested code in the repo and that is deliberate — it is the file a reviewer will actually read. Vitest, covering at minimum: all four verdicts for `certification`, `financial` and `insurance`; the missing financial year; the currency mismatch; the credential expiring between today and the deadline; `expiresOn = null`; and the empty-string word count from §7.7.

---

## 10. Screens

Six routes. Depth over breadth — three excellent screens beat eight shallow ones, and "obvious bugs" is a graded criterion that multiplies with surface area.

| Route | Screen |
|---|---|
| `/login` | Sign in, plus a prominent *View demo* |
| `/` | Pipeline — the home screen |
| `/tenders/[id]` | Tender detail, four tabs via `?tab=` |
| `/profile` | Company profile |
| `/library` | Answer library |
| `/tenders/[id]/audit` | Activity log |

### 10.1 Pipeline (`/`)

```
┌────────────────────────────────────────────────────────────────┐
│  Verdict                          [ + Add tender ]   ◍ Meridian│
├────────────────────────────────────────────────────────────────┤
│  3 open   ·   1 closing this week   ·   2 need review          │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ NO BID     NHS Supply Chain — Managed Cleaning           │  │
│  │            £2.4m · 48 months      2 mandatory failures   │  │
│  │            34 requirements           Closes in 11 days   │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │ REVIEW     Camden LBC — Grounds Maintenance              │  │
│  │            £780k · 36 months      3 unknowns             │  │
│  │            27 requirements           Closes in 4 days    │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │ BID        Univ. of Leeds — Soft FM Framework            │  │
│  │            £1.1m · Lot 2          all gates clear        │  │
│  │            41 requirements           Closes in 19 days   │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

Sorted by submission deadline ascending. One Prisma query with the latest assessment included — no N+1, no view. Verdict is the leading visual element on every row. Anything closing inside 7 days shows its countdown in `--flag` regardless of verdict.

### 10.2 Tender detail (`/tenders/[id]`)

Header: back link, title, then a metadata line with contract value, duration, submission deadline and clarification deadline, both dates in the mono face.

Four tabs: **Assessment · Requirements · Workspace · Documents**. Assessment is the default.

**Tab: Assessment** — the demo screen. It has to land in ten seconds.

```
┌────────────────────────────────────────────────────────────────┐
│  ← Pipeline                                                    │
│  NHS Supply Chain — Managed Cleaning Services                  │
│  £2.4m · 48 months · Closes 14 Sep 2026 · Clarifications 7 Sep │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│    NO BID          2 mandatory failures block this tender.     │
│                    21 pass · 2 fail · 3 unknown · 8 desirable  │
│                    Assessed v2 · 24 Aug 2026 · [ Re-run ]      │
│                                                                │
├────────────────────────────────────────────────────────────────┤
│  BLOCKING                                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ ✕ ISO 27001 certification                                │  │
│  │   Not held. No certificate on your profile.              │  │
│  │   PSQ.pdf p.31 §4.2.1                          [ view ]  │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │ ✕ Minimum annual turnover £5,000,000                     │  │
│  │   FY2025 turnover £4,120,000 — short by £880,000.        │  │
│  │   PSQ.pdf p.28 §3.4                            [ view ]  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  NEEDS AN ANSWER FROM YOU                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ ? Employers' liability cover ≥ £10,000,000               │  │
│  │   No employers' liability policy recorded. Add one to    │  │
│  │   resolve.                             [ add to profile ]│  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  ▸ 21 requirements met                                         │
│  ▸ 8 desirable criteria                                        │
└────────────────────────────────────────────────────────────────┘
```

Failures first, unknowns second, passes collapsed. The stored `rationale` renders verbatim — the UI never rewrites, truncates or re-derives it. Every row links to its clause.

**Tab: Requirements** — the full matrix, filterable by kind, obligation and verdict, default sort fail → unknown → pass. Columns: verdict · summary · obligation · source (document + page, mono) · kind.

**The citation drawer** is the trust device and must work flawlessly. Clicking any source opens a panel showing the verbatim `quotedClause`, the clause reference, the document name and page, any additional `RequirementCitation` rows, and — where `filePath` is set — a link that opens the PDF at that page. This is what makes the system checkable by someone who knows nothing about procurement, including the reviewer.

**Tab: Workspace** — renders only when `status = bidding`; otherwise *"This tender hasn't been marked as a bid yet."* ITT questions as task cards with assignee, status, word limit and live word count. Each has *Suggest from library*.

**Tab: Documents** — filename, type, page count, extraction status, requirements-found count, and for a failed extraction the stored `extractionError` shown in full.

### 10.3 Company profile (`/profile`)

Five sections matching the capability tables, plus organisation details. Each row shows *"used by N requirements across M tenders"* — this is what makes profile completion feel worth doing rather than like a form. Expiry flagged at 90 days (`--pending`) and 30 days (`--flag`). `credential.code` is a select populated from `CredentialType`.

### 10.4 Answer library (`/library`)

Table of past answers with tags as mono chips and usage counts. Client-side filter over title and body. Clicking a row expands the body inline.

### 10.5 Audit (`/tenders/[id]/audit`)

Reverse-chronological `Event` rows for the tender: uploads, extraction runs with model and chunk counts, assessment versions, overrides. Cheap to build, disproportionate credibility, and it mirrors the audit-spine pattern Algosoup showcases in its own work.

---

## 11. Design direction

The subject's world is procurement documents: numbered clauses, cross-references, appendices, marking matrices. The interface should feel like a well-made legal instrument, not a SaaS dashboard.

**Palette** — five values, no gradients, no others:

- `--ink` `#161719` — text, and the near-black verdict block
- `--paper` `#FBFBF9` — background
- `--rule` `#DEDDD6` — hairline dividers, 1px
- `--flag` `#B3261E` — failures only
- `--pending` `#8A6D1F` — unknowns and review only

**The key rule: a passing requirement gets no colour at all.** It is ink on paper — no pill, no badge, no icon tint. Only problems are coloured. This inverts the usual traffic-light dashboard and it is the right call here: someone scanning 40 requirements needs the 2 that are wrong to be the only things that catch the eye. There is no green anywhere in the application.

**Type** — Inter Tight (or Inter) for body and UI, with tabular figures on every money column. Clause references, page numbers, document filenames and timestamps in a mono face at ~0.85em and `--ink` at 60% opacity: they are citations, and citations should look like citations. Headings carry hierarchy through weight and letter-spacing, not size jumps. No display serif.

**Structure encodes meaning.** Clause references (`§4.2.1`, `p.31`) are real structural information from the source document — use them as the visual anchors rather than inventing decorative numbering.

**Layout** — max content width 1100px, generous vertical rhythm, 1px `--rule` hairlines, cards with a 1px border and 2px radius, and no drop shadows anywhere. Dense but not cramped; this is a reading interface.

**Signature element:** the citation drawer. Spend the design budget there and keep everything else quiet.

**Motion:** the drawer slide and nothing else. Respect `prefers-reduced-motion`.

**Copy rules.** Errors state what happened and what to do: *"This PDF has no text layer"*, not *"Extraction failed."* Empty states are invitations: *"No tenders yet. Upload a pack to get your first verdict."* Buttons keep their verb through the flow — *Run assessment* produces *Assessment complete*.

---

## 12. UI implementation spec

Binding detail for whichever session builds the front end. Everything here is decided; none of it is a starting point for improvisation.

### 12.1 App shell

Slim left sidebar. Wordmark **Verdict** in the mono face. Nav: Pipeline, Profile, Library. Current organisation name at the bottom with a sign-out control. Content column max 1100px, centred.

Define the five colours as CSS variables in `globals.css` and reference them through Tailwind theme extensions. No other colour values appear in the codebase.

### 12.2 `/login`

Centred card, email and password. Below, clearly separated, a **View demo** button that signs in with `DEMO_EMAIL` / `DEMO_PASSWORD` from server-side env and redirects to `/`. It must be at least as prominent as the form — most visitors will use it, and no reviewer should have to register.

### 12.3 Pipeline

Header strip: three counts as plain text separated by mono middots — open tenders, closing within 7 days, needing review. Not cards, not tiles.

One bordered card per tender. Verdict word first: uppercase, mono, wide letter-spacing, vertically centred against the two lines beside it. `NO BID` in `--flag`, `REVIEW` in `--pending`, `BID` in `--ink`. The summary line states the problem in plain words — *"2 mandatory failures"*, *"3 unknowns"*, *"all gates clear"*. Money abbreviated with tabular figures (£2.4m, £780k). Deadline right-aligned on the second line; under 7 days it is `--flag` with the day count. Hover changes the border to `--ink` and nothing else — no elevation, no shadow.

### 12.4 Assessment verdict block

Full-bleed within the content column. `--ink` background, `--paper` text, minimum 140px tall, generous padding. Verdict word at 40px or more in the mono face, uppercase, wide letter-spacing. It is the first thing the eye lands on. To its right: the one-line summary, the counts line, then version and date with the *Re-run* button.

### 12.5 Result rows

Three groups in this order, and the order is the point:

1. **BLOCKING** — mandatory, `verdict = fail`. Line 1: requirement summary. Line 2: the stored rationale, verbatim. Line 3: document, page and clause reference in mono, with `[view]`.
2. **NEEDS AN ANSWER FROM YOU** — `verdict = unknown`, in `--pending`. Same layout plus a secondary *Add to profile* link.
3. Two collapsed disclosures: *"N requirements met"* and *"N desirable criteria"*. Collapsed by default. No colour.

### 12.6 The citation drawer

Slides in from the right, 320ms ease-out — the only animation in the application.

Contents in this order: document filename and page number in mono at 12px; the verbatim clause as a block quote at 17px, line-height 1.6, with a 2px `--rule` left border and 20px left padding, given the most vertical space in the panel; the clause reference beneath in mono; the requirement summary and its obligation; any additional citations; the open-PDF link where one exists.

Escape closes it. Focus is trapped while open and returns to the `[view]` control that opened it. Under 640px it is a full-screen sheet, not a side panel. Disabled under `prefers-reduced-motion`.

Where `filePath` is null, render the citation without a link plus one line of mono copy: *"Source file not retained — clause text above is verbatim."* Never a dead link, never a disabled button with no explanation.

### 12.7 Quality floor

- Responsive to 380px: pipeline cards and the assessment screen stay readable.
- Visible keyboard focus rings on every interactive element.
- Loading states are skeleton rows matching the real layout, never spinners.
- Errors say what happened and what to do, in the interface's voice. Never "Something went wrong".
- No console errors on the demo path.

### 12.8 Do not

- No dashboard, charts, KPI tiles or analytics screen.
- No green, no drop shadows, no gradients, no emoji.
- No onboarding, tours, settings page, or tooltips beyond the ones specified.
- No business logic in components. Verdicts and counts are read from `Assessment`; they are never recomputed client-side.
- No Prisma import outside `src/lib/db/`.

---

## 13. Demo data

A reviewer must see a loaded, working product within ten seconds of opening the URL. An empty state with a signup form is a failed demo.

**Seeded organisation:** *Meridian Facilities Ltd* — 62 staff, Manchester, soft FM contractor. Deliberately built so the demo has drama:

- Holds ISO 9001, ISO 14001, CHAS, Cyber Essentials. **Does not hold ISO 27001.**
- FY2025 turnover £4.12m, FY2024 £3.87m. Below a £5m threshold — a near miss, not a wild miss.
- Public liability £10m, professional indemnity £5m. **No employers' liability recorded** — this produces the `unknown`.
- Nine past projects, six public sector, values £180k–£1.4m.
- Four policies; the modern slavery policy was last reviewed 31 months ago.
- Six library answers covering social value, safeguarding, TUPE, environmental management, quality assurance and business continuity.

**Three seeded tenders** producing one of each verdict, from **real packs downloaded before the clock starts** and committed under `public/packs/`. Real 80-page documents rather than synthetic text is a large credibility difference for zero build cost, and it lets a reviewer open the source PDF and check a citation themselves.

**Demo credentials in the README**, plus the *View demo* button.

### The 90-second reviewer path

1. Land on the pipeline. Three tenders, three verdicts, deadlines visible.
2. Open the NHS one. Big **NO BID**, two blocking failures, both quantified.
3. Click the ISO 27001 citation. Drawer opens with the verbatim clause, PSQ.pdf p.31 §4.2.1. Open the PDF and the clause is actually there.
4. Go to profile, add an employers' liability policy at £10m.
5. Return, re-run. Version increments. The unknown resolves to a pass; **the verdict stays no-bid**, because the certification failure is real. This is the moment that proves the engine is deterministic rather than a language model being agreeable.
6. Open the Leeds tender, which is a bid. Workspace tab, an ITT question, *Suggest from library*, an answer appears.

---

## 14. Edge cases to handle explicitly

| Case | Behaviour |
|---|---|
| Scanned PDF, no text layer | Detected before any model call. Explicit error naming the cause and the fix, stored on the document and shown in the Documents tab. |
| One extraction chunk fails | The document still completes. Failed-chunk count stored on the event and shown in the Documents tab. Never a silent partial success. |
| Extraction returns zero requirements | Not an empty matrix. *"No requirements found in this document — check it's the right file, or the type tag."* |
| Model emits a `credential_code` not in `CredentialType` | Stored as `kind = other` with the raw string preserved in `constraintJson`, verdict `unknown`. Never silently dropped. |
| Currency mismatch (EUR requirement, GBP profile) | `unknown` with an explicit rationale. Never a silent conversion at an invented rate. |
| Submission deadline in the past | Tender renders read-only with a *Closed* marker. |
| Credential expires between today and the deadline | `fail`, with the expiry date in the rationale. Expires within 30 days *after* the deadline → `pass` with a dated warning. |
| Credential with `expiresOn = null` | `pass`. Null means does not expire, not missing. |
| Profile edited after assessment | Existing assessment untouched; a banner offers *Re-run assessment*. |
| Two documents state the same requirement | One matrix row, both citations listed in the drawer via `RequirementCitation`. |
| Response exceeds the word limit | Live count turns `--flag` at 100%; nothing is blocked, because bid managers overwrite then cut. |
| Empty response body | Word count is 0. Explicitly tested. |
| Upload over 20MB | Rejected client-side before parsing, with the size named. |
| Uploaded pack's source file requested from the drawer | Citation renders without a link plus the "source file not retained" line. |

---

## 15. How this maps to the four evaluation criteria

| Criterion | Where it's evidenced |
|---|---|
| **Product judgment** | A real market with named incumbents and published pricing. A workflow chosen because it is the verification layer nobody covers end to end. Ten in-scope capabilities, eight explicitly cut with stated reasons. |
| **Engineering judgment** | Typed constraints with database-enforced shape. A pure, unit-tested evaluator. Immutable versioned assessments carrying the deadline and clock they used. A single data-access layer with a tenancy test. Fourteen edge cases handled by design rather than discovered. |
| **AI-native workflow** | Specification and contracts frozen and timestamped before any agent ran. Parallel branches with fixtures so nothing blocked. Chunked extraction chosen over a single long call for a stated reason. Confidence thresholds routing to review. Full unedited logs from every session, including the one that went wrong. |
| **Execution** | Live URL, seeded demo, a 90-second path that works, and a README that names what was cut and why. |

---

## 16. README plan

The README is graded even though nobody says so. Structure:

1. **What it is** — two sentences, the demo URL, the credentials.
2. **The 90-second path** — the numbered walkthrough from §13.
3. **Why this product** — the market, the incumbents, the wedge. Honest about the crowd.
4. **How it works** — the §6 diagram and one paragraph on extract-versus-evaluate.
5. **What I cut and why** — the eight out-of-scope items, including RLS and file storage, with reasons.
6. **Time and method** — *"N hours of specification before the build clock, committed in full and timestamped. Two hours of build. Three Claude Code sessions in parallel against a frozen spec. All logs included, unedited, from every session including the one that went wrong."*
7. **What I'd do next** — RLS via a session-scoped Postgres role, OCR fallback, portal ingestion, semantic retrieval, win/loss analytics.

Point 6 is the one that matters. Prep time declared upfront reads as engineering discipline; prep time discovered by a reviewer reads as something else.