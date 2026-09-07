# Verdict — tender qualification

A public-sector bid pack arrives as 60–120 pages across five or six PDFs, and the most common outcome of reading it is discovering, after the fact, that a mandatory certification was missing on page 84. Verdict shreds the pack into a page-cited requirements matrix, joins it against a structured company profile, and returns a **bid / no-bid / review** call computed deterministically from stated facts — never inferred by a language model.

**Live demo:** _not deployed yet — [run it locally](#running-it), which takes about five minutes._

**Demo sign-in:** the **View demo** button on `/login`, or `demo@meridianfacilities.co.uk` with the password in your `.env`. No registration, and the demo organisation is seeded with three tenders producing one of each verdict.

**Specification:** [`docs/spec.md`](docs/spec.md) — v2.0, frozen before the build clock and the first commit in this repository. Every field name, screen, rule and error string below comes from it. `contracts.ts` is the machine-readable half: enums, Zod constraint schemas, the extraction prompt and the `Evaluate` signature, shared by the seed, the engine, the API route and the UI.

---

## The 90-second path

1. **Land on the pipeline.** Three tenders, three verdicts, sorted by submission deadline. The one closing inside seven days shows its countdown in `--flag` regardless of verdict.
2. **Open _NHS Supply Chain — Managed Cleaning Services_.** A full-bleed **NO BID** block, then two blocking failures, both quantified: *"FY2025 turnover £4,120,000 — short by £880,000."* Not *"turnover requirement not met."*
3. **Click `[view]` on the ISO 27001 row.** The citation drawer opens with the verbatim clause, `PSQ.pdf · p.31 · §4.2.1`, and the second citation from the ITT — the same obligation stated in two documents, deduplicated into one matrix row with both provenances kept.
4. **Go to Profile → Insurance.** Employers' liability is listed as asked-for-but-missing. Add it at £10m.
5. **Return to the NHS tender and press Re-run.** The version increments, the employers' liability `unknown` resolves to a `pass`, and **the verdict stays no-bid** — the ISO 27001 failure is real and nothing about the profile edit changes it. This is the moment that shows the verdict is arithmetic over typed facts rather than a model being agreeable.
6. **Open _University of Leeds — Soft FM Framework_,** which is a bid. Workspace tab → any method statement → **Suggest from library** → a past answer appears with the terms that matched it. Use it and the live word count updates.

---

## Why this product

This is a real, crowded, consolidating market, and that is the point — willingness to pay is already proven.

| Incumbent | Where they sit |
|---|---|
| **AutogenAI** | Enterprise, full lifecycle, quote-based pricing |
| **mytender.io** | UK SME, pipeline and section assignment, subscription |
| **Responsive / Loopio / QorusDocs** | Private-sector RFP, library-led |
| **Stotles** | Public-sector pipeline discovery, $13m Series A, 1,000+ customers |
| **Lucius AI** | Free no-signup tender scan returning a compliance matrix and a bid/no-bid call |
| **CleanTender / SwiftBid** | Sector-specific, £99–£149 entry pricing |

**The wedge.** Discovery tools answer *which buyers should we target*. Drafting tools answer *write the answer*. The verification layer between them — page-cited requirement extraction, deterministic eligibility checking against a structured supplier profile, and an audit trail — is the part that is hardest to get from a general assistant and the part nobody covers end to end.

**The narrower wedge inside that.** Several tools now extract requirements with page citations. Almost none hold a structured, machine-readable profile of the supplier and evaluate the two against each other *without a model in the decision path*. The differentiator is not the extraction; it is that the verdict is arithmetic over typed facts, reproducible, and unit-tested. You can read [`src/lib/qualify/evaluate.ts`](src/lib/qualify/evaluate.ts) in ninety seconds and know exactly why the answer is what it is.

Nothing here is claimed as novel. It is a specific, defensible slice of a validated market.

**The three failures the product exists to prevent:** a 30–60 hour bid on something with a disqualifying gate visible on day one; technical disqualification on a lapsed certificate or a missed clarification deadline; and the requirement nobody checked because nobody read that appendix.

---

## How it works

```
┌────────────────────────────────────────────────────────────────┐
│  Next.js 16 · App Router · TypeScript · Tailwind v4 · Radix    │
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

**Why Next.js rather than a SPA plus an API.** Prisma cannot run in a browser, so a Vite SPA would need a hand-written API layer, CORS handling and a serialisation seam between two codebases. App Router collapses all of that: a Server Component calls a data function directly, a Server Action mutates and revalidates, one deploy covers both. The only hand-written HTTP endpoint in the app is the extraction route, and it exists solely because the Anthropic key must not reach the client.

**Why Prisma rather than the Supabase client.** The Supabase JS client is a thin PostgREST wrapper; it pushes tenancy into database policies and typing into generated row types, which is a reasonable trade when the client talks to the database directly. Once there is a server in the path, Prisma gives one typed data layer, migrations under version control, a schema readable as a single file, and a seed script that is ordinary TypeScript. Supabase remains the Postgres host and the identity provider; nothing else about it is load-bearing.

**Why pdf.js in the browser.** Page numbers come out correct and free, there is no server-side PDF dependency to install, and the file never has to leave the client except as text. The trade-off is that large packs use browser memory and a scanned PDF yields nothing — detected explicitly and surfaced as a named error rather than an empty matrix.

### Extraction is a model's job. The verdict is not.

The model reads pages and emits typed `RequirementDraft`s — a kind, a constraint body, and a verbatim clause with the document and page it came from. Nothing else. It never sees the company profile, never compares a number to a threshold, and never decides whether to bid.

`evaluate(input)` takes an `EvaluationInput` — the requirements plus a `CapabilitySnapshot` of the supplier — and returns a verdict per requirement with the recommendation. It is a pure function: no network, no database, no `new Date()`. The only clock is the injected `asOf`, which is why an assessment run three months ago is still explicable today, and why the whole engine tests in milliseconds.

The recommendation is three lines, in `recommend()` in `contracts.ts`:

```
any mandatory fail    → no_bid
any mandatory unknown → review
otherwise             → bid
```

The model writes the prose summary that accompanies the call. The model does not make the call.

**The distinction that carries the product** is the third verdict. A missing credential is a `fail` — absence is knowable, because the profile is a closed world of certifications held. A missing financial year is `unknown` — we cannot see what was never entered. *"You haven't told us your 2025 turnover"* and *"your turnover is £4.1m against a £5m threshold"* are different sentences to a bid manager, and collapsing them into one red cross is how these tools lose trust in the first week. Insurance behaves like the financial case rather than the certification case for exactly the same reason: an uninsured company and a company that hasn't filled in the form look identical from here.

Every rationale is quantitative where the data allows it, and the stored string is what the UI renders — never a re-derivation.

### No citation, no requirement

`documentId`, `pageNumber` and `quotedClause` are `NOT NULL` at the database level, with `page_number > 0` and `char_length(quoted_clause) between 1 and 1200` enforced as CHECK constraints. A requirement that cannot be pointed at was invented, and the database is the only referee that cannot be argued with.

Prisma cannot express CHECK constraints, so three are hand-appended to [`prisma/migrations/20260906172839_init/migration.sql`](prisma/migrations/20260906172839_init/migration.sql), deliberately and with a comment saying so. The third enforces constraint *shape* per kind — a `certification` row must carry a `credential_code`, a `financial` row must carry `metric`, `operator` and `value`. The same shapes are validated by Zod at the insert boundary in `src/lib/ingest/prepare.ts`; the CHECK is the backstop for anything that bypasses it.

### Chunked extraction, not one long call

Text is chunked into 5-page windows with 1 page of overlap, each carrying its true page offsets, posted to the extraction route at concurrency 4, one Claude Sonnet 4.6 call per chunk with structured output. A single 120-page call produces plausible page numbers that are frequently wrong, and a wrong citation is worse than no citation because it silently destroys the trust the product is built on. The overlap exists so a clause spanning a page break is never cut in half.

Three rules in the pipeline are about not lying:

- **A scan is rejected before any model call.** Fewer than 200 extracted characters per page and the document is marked `failed` with the message stored verbatim: *"This PDF has no text layer. Verdict reads text-based PDFs only — try the buyer's original download rather than a scan."* No API call, no cost, no silence.
- **One chunk failing does not fail the document.** Each chunk's outcome is recorded independently, and the failed-chunk count is stored on the event and shown in the Documents tab. A pipeline that unions an empty result into a total and reports success is the most dangerous failure mode here, because it looks exactly like success.
- **Rejected drafts are counted, not dropped.** Malformed drafts increment `draftsRejected`; drafts below 0.6 confidence are held for review and never enter the matrix. A credential code the model invented is stored as `kind = other` with the raw string preserved and a verdict of `unknown` — never silently coerced onto the nearest real code.

Where the same obligation appears in the PSQ and the ITT, one `Requirement` row survives deduplication on kind plus normalised constraint, the highest-confidence draft wins, and every loser's provenance is written to `RequirementCitation` so the drawer can list both.

### Assessments are immutable

An `Assessment` is never updated after insert. Editing the profile produces version *n+1*; version *n* stays exactly as it was, and the audit tab shows both. Each version stores the `deadlineUsed` and `asOfUsed` it evaluated against — without them, version 1 becomes unreadable the moment the deadline moves.

Version allocation takes a Postgres advisory lock on `hashtext(tenderId)` inside the same interactive transaction that computes `max(version) + 1` and writes the rows, so two concurrent runs cannot both claim the same version. Every write path in `src/lib/db/` appends exactly one `Event` in the same transaction as the change it describes — an audit log written outside the transaction will eventually lie.

### Tenancy without RLS — the trade-off, stated

Prisma connects as the database owner and bypasses row-level security by design. Keeping RLS would mean wrapping every transaction in a `SET LOCAL request.jwt.claims` dance, which is fragile and easy to get subtly wrong.

**The rule instead:** every table that can belong to an organisation carries `orgId`, every Prisma call in the codebase lives inside `src/lib/db/`, and every one of those functions takes `orgId` as its first argument — resolved by `getOrgContext()` from the session, never from a URL, a form field or a request body. No Prisma call may be written anywhere else in the app. `prisma/seed.ts` is the single audited exception, and it is a build-time script rather than part of the running application.

**This is weaker than a database guarantee, and it should be read as weaker.** It is compensated by [`src/lib/db/__tests__/tenancy.test.ts`](src/lib/db/__tests__/tenancy.test.ts), which creates a second organisation and asserts that every exported read function returns nothing belonging to the first. If you are looking for the multi-tenancy answer, that test is it.

`middleware.ts` decides where people are sent, never what they can read. It calls `getUser()` rather than `getSession()`, so the token is revalidated with the auth server instead of decoded from a cookie the browser supplied.

### Design rules that are enforced in code, not by discipline

- **Five colours, no others.** `--ink`, `--paper`, `--rule`, `--flag`, `--pending`, defined once in `src/app/globals.css`. Tailwind's default palette is wiped in `@theme` (`--color-*: initial`) so a sixth colour cannot be used by accident. Shadow scales are wiped the same way. There is no green anywhere in the application.
- **A passing requirement gets no colour at all.** Only failures and unknowns are coloured. Someone scanning 40 requirements needs the 2 that are wrong to be the only things that catch the eye, which inverts the usual traffic-light dashboard on purpose.
- **Citations look like citations.** Document names, page numbers, clause references and timestamps are set in IBM Plex Mono at ~0.85em, ink at 60% opacity. They are real structural information from the source document, so they are used as the visual anchors rather than decorative numbering.
- **No business logic in components.** Verdicts and counts are read from the stored `Assessment` and never recomputed client-side. The stored `rationale` renders verbatim — the UI never rewrites, truncates or re-derives it.
- **The drawer slide is the only animation,** 320ms ease-out, disabled under `prefers-reduced-motion`. Under 640px the drawer is a full-screen sheet rather than a side panel.

---

## Running it

**Prerequisites:** Node 20+, a Supabase project (the free tier is enough), and an Anthropic API key if you want to extract a pack of your own. The seeded demo needs no API key.

```bash
cp .env.example .env      # then fill in the seven values it documents
npm install               # postinstall runs `prisma generate`
npm run db:migrate        # applies the init migration, CHECK constraints included
npm run db:seed           # Meridian Facilities Ltd, three tenders, six library answers
npm run dev
```

Open http://localhost:3000 and press **View demo**.

`.env.example` is the authoritative setup guide and is worth reading rather than skimming — three things there each cost about ten minutes if you get them wrong:

- **Two connection strings, both required.** `DATABASE_URL` is the pooled connection on port 6543 with `?pgbouncer=true&connection_limit=1`, used by the app at runtime. `DIRECT_URL` is the direct connection on port 5432, declared as `directUrl` in the datasource and used only by `prisma migrate`, which fails in confusing ways over the transaction pooler.
- **`DEMO_EMAIL` / `DEMO_PASSWORD` must match a real Supabase Auth user** — create one under Authentication → Users with *Auto Confirm User* ticked. Neither carries a `NEXT_PUBLIC_` prefix and both are read only inside a `server-only` module called from a Server Action, so the demo password is never inlined into the client bundle.
- **That auth user's id must equal the seeded `users` row id.** The public schema holds a mirror row because Prisma cannot own Supabase's `auth.users` table, and the mirror id is supplied on insert rather than generated. Get it wrong and sign-in succeeds, `ensureUser()` writes a mirror row belonging to no organisation, and `getOrgContext()` throws.

### Scripts

```bash
npm run dev          # next dev --turbopack
npm run build        # next build --turbopack
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm test             # vitest run
npm run db:migrate   # prisma migrate dev
npm run db:seed      # tsx prisma/seed.ts — idempotent, safe to re-run
npm run db:studio    # prisma studio
```

The seed is idempotent: every row's id is derived from its fixture key, so a second run updates rather than duplicates. It also shifts **every** date by one offset from `DEMO_ASOF` (2026-09-03) to today — deadlines, certificate expiries, financial year ends, policy review dates, event timestamps. Shifting deadlines but not expiries would silently change verdicts, which is the one way that file could lie. It seeds assessments as authored rather than recomputing them, because the NHS tender is at v2 precisely because a certificate was added after v1, and re-running `evaluate()` today would not reproduce v1.

---

## Tests

```
Test Files  20 passed | 3 skipped (23)
     Tests  376 passed | 11 skipped (387)
```

The engine is the most heavily tested code in the repository, deliberately — it is the file a reviewer will actually read.

| Area | Files | What is pinned |
|---|---|---|
| `src/lib/qualify/` | 8 files, 262 tests | All four verdicts for certification, financial and insurance; the missing financial year; the null metric; the currency mismatch; a credential expiring between today and the deadline; `expiresOn = null` meaning *does not expire*; policy review age; which projects counted toward an experience threshold. Every golden case in `fixtures/evaluation.ts` is replayed against the engine, and all three whole-tender runs are asserted requirement by requirement against the counts the fixtures publish — including step 5 of the demo path, where adding employers' liability resolves the unknown and the NHS verdict stays `no_bid`. A purity block asserts that the same input twice gives the same answer, that the snapshot handed in is not mutated, and that shifting `asOf` past every expiry *does* change the answer. `imports.test.ts` walks the engine's source and asserts it imports nothing but `contracts.ts` and its own siblings, and reads no clock but the injected `asOf`. |
| `src/lib/ingest/` | 6 files, 49 tests | Chunk planning and page-offset fidelity; bounded concurrency preserving input order; per-chunk failure isolation; a document/chunk echo mismatch discarding a result rather than misfiling it; screening before parse; validation, dedupe and the review queue. |
| `src/lib/db/` | 4 files, 37 tests | The `Decimal` ↔ `number` and BigInt seams; the persist boundary; the tenancy test. |
| `src/app/api/` | 1 file, 10 tests | Request validation, typed error codes, echo of `documentId` and `chunkIndex`. |
| `src/lib/` | 2 files, 26 tests | Money and date formatting; `countWords`, whose first case is the empty string returning 0 — the generated column in the original schema claimed one word for an empty draft. |

**The 11 skipped tests are gated, not broken.** `tenancy.test.ts` and `ensure-user.test.ts` write to a real database and run only under `VERDICT_TEST_DB=1` against a disposable `DATABASE_URL`; `page-numbers.test.ts` needs a real PDF and skips itself while `public/packs/` is empty.

```bash
npm test                                                              # the 376
VERDICT_TEST_DB=1 DATABASE_URL=postgresql://…/verdict_test npm test   # plus the database tests
```

`fixtures/` carries its own self-check, `fixtureProblems()`, which recomputes every tender's headline counts from its own requirement rows and reports anything that disagrees with the assessment as written. A fixture claiming *"21 pass · 2 fail · 3 unknown"* while containing something else is worse than no fixture, because several build sessions were working against the claim in parallel.

---

## Screens

Seven routes, not seventeen. Depth over breadth: three excellent screens beat eight shallow ones, and obvious bugs multiply with surface area.

| Route | Screen |
|---|---|
| `/login` | Sign in, with *View demo* at least as prominent as the form |
| `/` | Pipeline — one card per tender, verdict word leading every row, sorted by deadline |
| `/tenders/new` | Add a tender, then upload its pack typed by role |
| `/tenders/[id]?tab=assessment` | The verdict block, then BLOCKING, then NEEDS AN ANSWER FROM YOU, then two collapsed disclosures |
| `/tenders/[id]?tab=requirements` | The full matrix, filterable by kind, obligation and verdict; filters live in the URL |
| `/tenders/[id]?tab=workspace` | ITT questions as task cards: owner, status, due date, live word count, *Suggest from library* |
| `/tenders/[id]?tab=documents` | Per-document extraction status, stored error messages in full, failed-chunk counts |
| `/tenders/[id]/audit` | The append-only activity log for that tender |
| `/profile` | Organisation details and the five capability sections, each row saying how many requirements read it |
| `/library` | Past answers with tags, usage counts, inline expansion and a client-side filter |

**The citation drawer** is the signature element and where the design budget went: the verbatim clause as a block quote with a 2px rule and the most vertical space in the panel, the clause reference and page in mono beneath it, any additional citations, and either a link that opens the PDF at that page or the line *"Source file not retained — clause text above is verbatim."* Never a dead link, never a disabled control with no explanation. Escape closes it, focus is trapped while it is open and returns to the `[view]` control that opened it.

---

## Repository layout

```
docs/spec.md              frozen v2.0 specification — the binding source for everything
contracts.ts              enums, Zod constraint schemas, EXTRACTION_RULES, the Evaluate
                          signature, recommend()/tallyMandatory()/desirableCoverage()
fixtures/                 the demo dataset as plain TypeScript, plus fixtureProblems()
prisma/
  schema.prisma           the data model — snake_case tables via @@map, Decimal money
  migrations/…_init/      generated DDL plus the three hand-appended CHECK constraints
  seed.ts                 inserts fixtures/ as authored, date-shifted, idempotent
src/
  app/
    (auth)/login          sign in, with View demo at least as prominent as the form
    (app)/                pipeline · tenders/[id] (4 tabs) · tenders/new · profile ·
                          library · tenders/[id]/audit
    api/extract-requirements/   the only hand-written HTTP endpoint, and only because
                                ANTHROPIC_API_KEY must not reach the client
    auth/callback         post-sign-in; calls ensureUser() once
  components/             ui/ (Radix primitives, restyled) · tender/ · profile/ ·
                          library/ · upload/ · shell/ · common/ · audit/
  lib/
    qualify/              the pure engine — one file per requirement kind
    ingest/               pdf.js orchestration, chunking, screening, validation, dedupe
    db/                   the ONLY data-access layer; every function takes orgId first
    auth/                 Supabase clients, getOrgContext(), ensureUser()
    actions/              Server Actions — the only write path from the UI
    pdf/, format.ts, text.ts, labels.ts, types.ts
  middleware.ts           session refresh and route guard — where people go, not what
                          they can read; authorisation is getOrgContext() plus orgId
```

---

## What is deliberately out of scope

Each of these has a reason, and naming them is the point rather than an apology.

| Cut | Why |
|---|---|
| **Semantic / vector search over the library** | Keyword `ILIKE` plus tag overlap, ranked by matched-term count then usage, top 3. At six seeded answers this is indistinguishable from anything cleverer, and an embedding store is a dependency for marginal gain at demo scale. |
| **OCR for scanned PDFs** | Needs a vision pipeline and a fallback UX. Instead the absence of a text layer is detected before any model call and fails loudly with a named cause and a named fix. |
| **Automatic ingestion from Find a Tender** | Needs a scraper and a scheduler. Manual upload only. |
| **Pricing schedule (`.xlsx`) parsing** | A second parser and a second extraction contract, for a document that carries no eligibility gates. |
| **Multi-lot bidding** | One lot per tender record. Multi-lot changes the shape of the requirements matrix, not just its contents. |
| **Email notifications, billing, win/loss analytics** | Subscription machinery, not the verification layer. |
| **Durable storage of user-uploaded PDFs** | Seeded packs are static assets. A pack uploaded at runtime is read in the browser by pdf.js, its text extracted, and the file discarded. Requirements from it keep their document name, page and verbatim clause — everything the drawer needs except the link back to the PDF, which the UI states in a line of copy rather than rendering a dead control. Durable storage buys the demo nothing and costs a bucket, three policies and a class of failure at the least recoverable moment. |
| **Database-enforced row-level security** | Tenancy is enforced in one server-side helper and one data-access directory instead, with a test that proves it. See [above](#tenancy-without-rls--the-trade-off-stated). This is the cut most worth arguing with. |

---

## Known gaps in this build

Three things a reviewer will find, listed here rather than left to be discovered.

1. **The seeded packs are not committed.** `public/packs/` holds only a README, so the citation drawer's *Open PDF at page N* link 404s for the seeded tenders — the `filePath` values in `fixtures/tenders/*.ts` point at files that are not there. The clause text, page and clause reference in the drawer are unaffected; only the link out is. `page-numbers.test.ts` skips itself for the same reason.
2. **`runAssessmentAction` still injects the placeholder evaluator.** `runAssessment` takes `evaluate` as an injected dependency so that the pure engine and the data layer could be built on separate branches at the same time. The real engine landed in `src/lib/qualify/` and is fully tested, but `src/lib/actions/assessments.ts` has not yet been switched over to it; the adapter it uses is marked in the file as temporary wiring. Swapping it is one import.
3. **Reset demo is a no-op.** The sidebar control calls `resetStore()` against the in-memory store that the Prisma data layer replaced. `npm run db:seed` does the job it was written for; the control should be removed or repointed at the seed.

---

## Time and method

The specification was written **before** the build clock and is the first commit in this repository — 61KB, frozen at v2.0, with `contracts.ts` and `fixtures/` following as its machine-readable half. Prep time declared upfront reads as engineering discipline; prep time discovered by a reviewer reads as something else.

The build itself ran on 6 September 2026, from the first feature commit at 18:43 to the last at 21:06 — **two hours and twenty-three minutes**, verifiable with `git log --format="%h %ad %s" --date=format:"%Y-%m-%d %H:%M"`.

It ran as parallel Claude Code sessions in separate git worktrees, each working against the frozen spec and the shared fixtures, merged through seven pull requests: `feat/db-setup`, `chore/contracts-fixtures`, the UI build, `feat/auth-supabase`, `feat/qualify-engine`, `feat/extraction-live` and `feat/prisma-data-layer`. The fixtures exist precisely so those sessions did not block on one another — the UI rendered real requirement rows before the extractor existed, the engine had golden cases before the seed existed, and the seed had one canonical dataset rather than inventing a second one.

Two decisions did most of the work. Freezing `contracts.ts` meant six sessions shared one set of enum strings, constraint shapes and function signatures, so the merges were merges rather than reconciliations. Making `evaluate` an injected dependency of `runAssessment` meant the engine and the data layer could be written simultaneously without either stubbing the other — which is also why gap 2 above exists, and why it is one line to close.

---

## What I would do next

**In order.**

1. **Close the three gaps above** — commit the packs, swap the evaluator import, fix or remove Reset demo.
2. **Row-level security, properly.** Not by abandoning the `src/lib/db/` rule but by putting a database guarantee underneath it: a session-scoped Postgres role, `SET LOCAL request.jwt.claims` applied in one transaction wrapper rather than at every call site, and the existing tenancy test kept as the regression check.
3. **An OCR fallback.** Detection already exists and already fails loudly. The next step is offering a vision pass over the pages with no text layer, with the extra cost and latency stated before it runs rather than after.
4. **Portal ingestion from Find a Tender.** A scheduled OCDS pull matched against the profile's SIC codes and regions, feeding the pipeline instead of a manual upload.
5. **Semantic retrieval for the library**, once there are enough answers for keyword matching to visibly miss.
6. **Win/loss analytics** — the reason a bid manager keeps paying in year two, and the thing the append-only `Event` log is already collecting the data for.
