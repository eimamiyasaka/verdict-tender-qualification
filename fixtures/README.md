# fixtures/

The demo dataset, typed against `contracts.ts`.

This exists so three build sessions can run in parallel without blocking on each
other: the UI session renders real requirement rows before the extractor exists, the
engine session has golden cases before the seed exists, and `prisma/seed.ts` has one
canonical dataset to insert rather than inventing a second one.

Nothing here imports Prisma, Next or the database. Everything is a plain TypeScript
value.

---

## What is in here

| File | What it holds |
|---|---|
| `clock.ts` | `DEMO_ASOF` and the date helpers. Every date in the fixtures is anchored to it. |
| `types.ts` | The authoring shapes. Field names match the Prisma models in spec §7 exactly. |
| `organisation.ts` | Meridian Facilities Ltd, its two users, and the second org the tenancy test uses. |
| `profile.ts` | The five capability tables, plus a ready-made `CapabilitySnapshot`. |
| `tenders/nhs.ts` | NO BID — 40 requirements, two blocking failures, three unknowns. |
| `tenders/camden.ts` | REVIEW — 27 requirements, three unknowns, and both document edge cases. |
| `tenders/leeds.ts` | BID — 41 requirements, all gates clear, plus the bid workspace. |
| `library.ts` | Six library answers and what "Suggest from library" must return. |
| `extraction.ts` | Chunk plans, a good chunk result, and every way a chunk can go wrong. |
| `evaluation.ts` | Golden cases for `evaluate()`, `recommend()`, `desirableCoverage()` and `countWords()`. |
| `events.ts` | The audit log for all three tenders. |
| `index.ts` | Barrel, plus `fixtureProblems()` — the self-check described below. |

---

## The three tenders

Sorted by submission deadline, which is pipeline order.

| | Camden | NHS | Leeds |
|---|---|---|---|
| Verdict | REVIEW | NO BID | BID |
| Value | £780k · 36 months | £2.4m · 48 months | £1.1m · Lot 2 |
| Closes | `DEMO_ASOF` + 4 days | + 11 days | + 19 days |
| Requirements | 27 | 40 | 41 |
| Mandatory | 16 pass · 0 fail · 3 unknown | 21 pass · 2 fail · 3 unknown | 24 pass · 0 fail · 0 unknown |
| Desirable | 5 (score 40.00) | 8 (score 25.00) | 9 (score 44.44) |
| Status | `assessed` | `assessed`, at v2 | `bidding` |

`mandatoryTotal` counts mandatory requirements the evaluator could actually rule on.
The method statements, dates and the exclusion-grounds declaration are mandatory but
`not_applicable` to eligibility (spec §9), so they sit inside the requirement count
without inflating the gate count — which is why NHS is 26 gates inside 40 rows.

### Where these numbers came from, and one place they differ from the spec

The mandatory and desirable counts on the NHS assessment screen are exactly the ones
in spec §10.2 — *21 pass · 2 fail · 3 unknown · 8 desirable*. The **total** requirement
count differs: §10.1's pipeline sketch shows 34/27/41 and these fixtures carry
40/27/41.

The reason is the six NHS rows that are neither an eligibility gate nor a desirable
criterion — four method statements and two dates. A real ITT pack has them, the
Workspace and `KeyDate` need them, and leaving them out to make a sketch's arithmetic
work would have meant a fixture that disagrees with itself. The screen counts, which
are the ones §12.4 renders, are exact.

---

## The demo clock

`DEMO_ASOF` is `2026-09-03T09:00:00Z`. Every date is absolute and measured from it, so
importing a fixture gives the same value in June as in December.

What matters is the *distances*, because they are what the demo shows:

- Camden closes in 4 days, NHS in 11, Leeds in 19.
- The CHAS certificate expires 21 days after the NHS deadline — inside the 30-day
  warning window, so all three tenders show a pass with a dated warning.
- The modern slavery statement was reviewed 31 months ago, past the 24-month mark.

To keep those true on the day a reviewer opens the URL, the seed shifts everything
by one offset:

```ts
import { demoOffsetDays, shift } from './fixtures';

const offset = demoOffsetDays();          // whole days from DEMO_ASOF to today
const deadline = shift(keyDate.occursAt, offset);
```

Shift **every** date by the same offset or not at all. Shifting deadlines but not
certificate expiries silently changes verdicts.

---

## How to read a requirement fixture

```ts
{
  key: 'nhs-iso27001',                    // stable; how other fixtures reference it
  kind: 'certification',
  obligation: 'mandatory',
  summary: 'ISO 27001 certification',
  constraint: { kind: 'certification', credential_code: 'ISO27001' },
  document: 'psq',                        // TenderDocumentFixture.key
  pageNumber: 31,
  clauseReference: '4.2.1',
  quotedClause: 'Bidders must hold current certification to ISO/IEC 27001 …',
  extractionConfidence: 0.96,
  alsoCitedIn: [ /* → requirement_citations */ ],
  expected: { verdict: 'fail', rationale: 'Not held. No certificate on your profile.' },
}
```

**`expected.verdict` is normative.** It is what `evaluate()` must return for this
requirement against `demoSnapshot` at `DEMO_ASOF`, and the engine's test suite asserts
against it.

**`expected.rationale` and `expected.warning` are present only where they matter** —
fails, unknowns, and passes carrying a warning. Those strings are rendered verbatim by
the UI (spec §12.5), so they are worth pinning. Plain passes carry no rationale here:
pinning a generated sentence for each of the sixty-three of them would be a drift
trap, not a test.

In `evaluation.ts` the assertions are on substrings (`rationaleIncludes`), because the
numbers in a rationale are the contract and the prose around them is not.

---

## The self-check

`fixtureProblems()` recomputes every tender's headline counts from its own requirement
rows using the frozen `tallyMandatory` and `desirableCoverage`, and reports anything
that disagrees with the assessment as written. It also checks Invariant 1 (every
requirement resolves to a document, a positive page and a 1–1200 character clause),
that each constraint body agrees with its row's `kind`, that keys are unique, that task
and response references resolve, and that assessment versions are contiguous.

```ts
import { fixtureProblems } from './fixtures';
expect(fixtureProblems()).toEqual([]);
```

A fixture that claims *"21 pass · 2 fail · 3 unknown"* and contains something else is
worse than no fixture, because three sessions will build against the claim.

As committed, this dataset has been checked to:

- typecheck clean under `strict` against **zod 3.25 and zod 4.5**;
- return no problems from `fixtureProblems()`;
- parse all **108** requirement constraints against `RequirementConstraintSchema`, and
  serialise every one as a valid `RequirementDraft`;
- reject `malformedDraft` (a `certification` with no `credential_code`);
- match `planChunks`, `hasTextLayer` and `constraintDedupeKey` on every case;
- agree with `countWords` on every seeded response body.

---

## Edge cases the fixtures carry, and where

Spec §14 lists fourteen. Eleven are represented here as data rather than described:

| Case | Where |
|---|---|
| Scanned PDF, no text layer | `camden.documents.appendix`, `extraction.scannedDocumentCase` |
| One extraction chunk fails | `extraction.sampleChunkFailure`, `nhsPsqOutcome.chunksFailed` |
| Extraction returns zero requirements | `extraction.emptyResultOutcome` |
| Credential code not in `CredentialType` | `extraction.unknownCredentialDraft` |
| Currency mismatch (EUR vs GBP) | `evaluation.financialCases`, `insuranceCases` |
| Credential expires between today and the deadline | `evaluation.certificationCases` |
| Credential with `expiresOn = null` | `profile.demoCredentials['cred-iso14001']` |
| Profile edited after assessment | `nhs.assessments` v1 → v2, `events.demoEvents` |
| Two documents state the same requirement | `nhs-iso27001.alsoCitedIn`, `extraction.duplicateDraftPair` |
| Empty response body | `leeds.responses['leeds-ms1']`, `evaluation.wordCountCases` |
| Uploaded pack's source file requested | `camden.documents.spec` (`filePath: null`) |

The three not represented are runtime behaviours with no data to seed: a submission
deadline in the past, a response over its word limit, and an upload over 20MB.

---

## What is deliberately absent

The absences are load-bearing. Do not "complete" the profile.

- **No ISO 27001 certificate.** The NHS blocking failure, and the reason the demo lands.
- **No employers' liability policy.** The `unknown` the reviewer resolves at step 4 of
  the 90-second path — after which the NHS verdict is still `no_bid`. That is the
  moment that proves the engine is arithmetic and not a model being agreeable, and
  `evaluation.tenderEvaluationCases` asserts it.
- **No FY2023 accounts, and a null `profitBeforeTax` on FY2024.** The two shapes of
  "we cannot see what was never entered".
- **No data protection policy.** No seeded tender asks for one; adding a requirement
  that does would add a third mandatory failure and break the NHS counts.
- **No `current_ratio` or `credit_score` anywhere.** `FinancialYear` has no column for
  either, so they are permanently `unknown` — see `METRICS_NOT_IN_SNAPSHOT`.

If you add a credential, an insurance line or a past project, re-run
`fixtureProblems()` and expect the assessment counts to need updating with it.

---

## Using them

```ts
// Seed
import { demoOrganisation, demoUsers, demoTenders, demoLibraryAnswers, demoEvents } from './fixtures';

// Engine tests
import { allRequirementCases, toEvaluationInput, tenderEvaluationCases } from './fixtures';

// UI, before the database exists
import { nhsTender, currentAssessment } from './fixtures';
const assessment = currentAssessment(nhsTender);
```
