# `src/lib/db` — the only place data is read or written

Spec §6.3: every Prisma call in the codebase lives here and takes an `orgId`
argument that comes from the session, never from a URL, form field or request
body. Nothing under `src/app` or `src/components` may import Prisma.

## Status on this branch: placeholder

The server branch owns `prisma/schema.prisma`, `contracts.ts`, the seed and
the qualification engine. Until it merges, every function in this directory
reads and writes an in-memory store under `_placeholder/`:

| File | Stands in for | What happens at merge |
|---|---|---|
| `_placeholder/store.ts` | Supabase Postgres | Deleted. Function bodies become Prisma queries. |
| `_placeholder/seed.ts` | `prisma/seed.ts` | Deleted. Same §13 organisation and tenders, from the real seed. |
| `_placeholder/evaluate.ts` | `src/lib/qualify/evaluate.ts` | Deleted. `runAssessment` calls the real pure `evaluate()`. |
| `_placeholder/persist.ts` | `src/lib/ingest/persist.ts` | Deleted or moved. Same dedupe rule. |

The public surface — the exported function names, argument order (`orgId`
first) and return shapes in `src/lib/types.ts` — is what the screens are built
against and is the contract for the swap.

## Conventions the screens rely on

- **Money is `number`.** Prisma returns `Decimal`; convert with `.toNumber()`
  at this boundary. Decimals cannot cross the Server → Client Component seam.
- **Dates are `Date`.** `@db.Date` columns are local-midnight dates.
- **`Event.id` is a string.** BigInt is serialised here.
- **Every write appends exactly one event** in the same transaction (§7.7).
  The placeholder does this in-process; Prisma does it with `$transaction`.
- **View models are assembled here**, not in pages: `PipelineRow`,
  `TenderDetail`, `WorkspaceTask`, `ProfileView`. The pipeline is one query
  with the latest assessment included — no N+1.
- **`getSubmissionDeadline(orgId, tenderId)`** is the single place the
  evaluator's deadline is resolved (§7.5). Nothing re-derives it.

## Tenancy test

`__tests__/tenancy.test.ts` (server branch) creates a second organisation and
asserts every exported read function returns nothing belonging to the first.
The placeholder store already filters every read by `orgId` so that test can
land against these signatures unchanged.
