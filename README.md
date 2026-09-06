# Verdict — tender qualification

A public-sector bid pack is 60–120 pages across five or six PDFs, and the most common outcome of reading it is discovering, after the fact, that a mandatory certification was missing on page 84. Verdict shreds the pack into a page-cited requirements matrix, joins it against a structured company profile, and returns a **bid / no-bid / review** call computed deterministically from stated facts — never inferred by a model.

**Specification:** [`docs/spec.md`](docs/spec.md) (frozen v2.0). Every field name, screen and rule in this codebase comes from it.

## Status of this branch: frontend against placeholders

This branch is the complete frontend. The server side — Prisma schema, Supabase, `contracts.ts`, the qualification engine and the extraction route — is being built on a separate branch. Until they merge:

| Concern | On this branch | At merge |
|---|---|---|
| Data | In-memory store seeded with the §13 demo organisation (`src/lib/db/_placeholder/`) | Function bodies in `src/lib/db/*.ts` become Prisma queries; signatures and return shapes stay |
| Types | Hand-written mirror of the §7 data model (`src/lib/types.ts`) | Replaced by `@prisma/client` types and `contracts.ts` |
| Auth | httpOnly cookie holding a seeded user id (`src/lib/auth/session.ts`) | Supabase Auth behind the same `getOrgContext()` |
| Evaluator | Stub following the §9 rules so seeded assessments are consistent with the seeded profile | The pure, unit-tested `evaluate()` in `src/lib/qualify/` |
| Extraction | `/api/extract-requirements` returns regex-derived drafts so the browser pipeline can be exercised | Claude Sonnet with `EXTRACTION_RULES` |
| Packs | `public/packs/` is empty; "Open PDF" links 404 | The three real packs are committed |

**All figures in the demo are placeholders.** Nothing here should be read as real tender data.

## Run it

```
cp .env.example .env
npm install
npm run dev
```

Open http://localhost:3000. Sign in with **View demo**, or with `DEMO_EMAIL` / `DEMO_PASSWORD` from `.env` (defaults: `demo@meridianfacilities.co.uk` / `verdict-demo`).

```
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm test            # vitest — formatting, word count, demo path, tenancy, dedupe
npm run build
```

The in-memory store resets on every server restart, and **Reset demo** in the sidebar does the same without restarting.

## The 90-second path

1. Land on the pipeline. Three tenders, three verdicts, deadlines visible; the one closing inside a week is flagged.
2. Open **NHS Supply Chain — Managed Cleaning Services**. Big **NO BID**, two blocking failures, both quantified: *"FY2025 turnover £4,120,000 — short by £880,000."*
3. Click `[view]` on the ISO 27001 row. The drawer opens with the verbatim clause, `PSQ.pdf · p.31 · §4.2.1`, and the second citation from the ITT.
4. Go to **Profile**. Under Insurance, employers' liability is listed as asked-for-but-missing; add it at £10m.
5. Return to the NHS tender and **Re-run**. Version increments to 3, the employers' liability unknown resolves to a pass, and **the verdict stays no-bid** — the certification failure is real.
6. Open **University of Leeds — Soft FM Framework**, which is a bid. Workspace tab, any method statement, **Suggest from library**, an answer appears with its matched terms; use it and the word count updates.

## Screens

| Route | Screen |
|---|---|
| `/login` | Sign in, with *View demo* at least as prominent as the form |
| `/` | Pipeline, sorted by submission deadline, verdict word leading every row |
| `/tenders/new` | Add a tender, then upload its pack typed by role |
| `/tenders/[id]?tab=assessment` | Verdict block, BLOCKING, NEEDS AN ANSWER FROM YOU, two collapsed disclosures |
| `/tenders/[id]?tab=requirements` | The full matrix — filterable by kind, obligation, verdict; filters live in the URL |
| `/tenders/[id]?tab=workspace` | Task cards per ITT question: owner, status, due, live word count, Suggest from library |
| `/tenders/[id]?tab=documents` | Per-document extraction status, stored error messages in full, failed-chunk counts, upload |
| `/tenders/[id]/audit` | Append-only activity log |
| `/profile` | Organisation details and the five capability sections, each row saying how many requirements read it |
| `/library` | Past answers with tags, usage counts, inline expansion and a client-side filter |

**The citation drawer** is the signature element (§12.6): verbatim clause as a block quote, clause reference, additional citations, and either a link that opens the PDF at that page or the line *"Source file not retained — clause text above is verbatim."* Radix Dialog supplies the focus trap, Escape and focus return; the 320ms slide is the only animation in the application and is disabled under `prefers-reduced-motion`.

## Design rules that are enforced in code

- **Five colours, nothing else.** `--ink`, `--paper`, `--rule`, `--flag`, `--pending` are defined once in `src/app/globals.css`; Tailwind's default palette is wiped in `@theme` so no other colour can be used by accident. There is no green anywhere.
- **A passing requirement gets no colour.** Only failures (`--flag`) and unknowns (`--pending`) are coloured.
- **Citations look like citations.** Document names, page numbers, clause references and timestamps are set in IBM Plex Mono at ~0.85em, ink at 60%.
- **No business logic in components.** Verdicts and counts are read from the assessment, never recomputed client-side. Rationale text renders verbatim.
- **No Prisma outside `src/lib/db/`.** Every data function takes `orgId` from the session, never from a URL or form field.

## Upload pipeline (browser side)

`src/lib/ingest/` implements §8 steps 2–7 in the browser: pdf.js reads each page (true page numbers), a PDF with fewer than 200 characters per page is rejected as having no text layer before any model call, pages are chunked into 5-page windows with 1 page of overlap, chunks are posted at concurrency 4 with per-chunk progress, and one chunk failing never fails the document. Drafts under 0.6 confidence are held for review; duplicates across documents become extra citations on one requirement.

## What is deliberately out of scope

Semantic search over the library, OCR for scanned PDFs, portal ingestion, pricing-schedule parsing, multi-lot bidding, notifications and billing, durable storage of uploaded PDFs, and database row-level security. See §4 and §6.3 of the spec for why.

## Layout

```
src/
  app/                 routes: (auth)/login, (app)/{page,tenders/[id],tenders/new,profile,library}
  components/          ui/ (restyled shadcn primitives) · common/ · shell/ · tender/ · profile/ · library/ · upload/
  lib/
    types.ts           §7 data model mirror + contract types
    format.ts, text.ts, labels.ts
    auth/              session (placeholder)
    actions/           Server Actions — the only write path from the UI
    db/                the only data-access layer; _placeholder/ is deleted at merge
    ingest/            pdf.js text extraction, chunking, orchestration (client-only)
  middleware.ts        route guard
```
