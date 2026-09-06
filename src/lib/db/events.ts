/**
 * The append-only audit log (§7.7, §10.5). Nothing updates or deletes here.
 *
 * `appendEvent` is the single writer, and it takes a transaction client rather
 * than the bare `prisma` singleton on purpose: spec §7.7 requires every write
 * path that changes state to append exactly one event **in the same transaction
 * as the change**. An event committed separately from the row it describes will
 * eventually describe something that was rolled back, which is worse than no
 * audit log at all because it is believed.
 */

import type { ActorKind, EventAction } from "../../../contracts";
import type { EventWithActor, EventAction as ViewEventAction } from "@/lib/types";
import { asJsonObject, eventId, prisma, type Db, type Tx } from "./client";
import { toUser } from "./org";

/**
 * `action` is widened past `contracts.EventAction` because the workspace screens
 * on `main` render two actions the frozen list does not name (`task.updated`,
 * `library.answer_used`). Spec §7.7 gives its action list as examples, and
 * `events.action` is a plain text column, so both sets coexist; every action
 * `contracts.ts` does name is written with that exact string.
 */
export type AnyEventAction =
  | EventAction
  | "task.updated"
  | "library.updated"
  | "library.answer_used";

export interface EventInput {
  orgId: string;
  actorId: string | null;
  actorKind: ActorKind;
  action: AnyEventAction;
  subjectTable: string | null;
  subjectId: string | null;
  payload: Record<string, unknown>;
  /** Only the seed sets this. Every other caller lets the column default to now(). */
  createdAt?: Date;
}

/**
 * Appends exactly one event. Pass the `tx` from the enclosing
 * `prisma.$transaction(...)` — never the singleton.
 */
export async function appendEvent(tx: Tx, input: EventInput): Promise<void> {
  await tx.event.create({
    data: {
      orgId: input.orgId,
      actorId: input.actorId,
      actorKind: input.actorKind,
      action: input.action,
      subjectTable: input.subjectTable,
      subjectId: input.subjectId,
      payload: input.payload as never,
      ...(input.createdAt ? { createdAt: input.createdAt } : {}),
    },
  });
}

interface EventRow {
  id: bigint;
  orgId: string;
  actorId: string | null;
  actorKind: string;
  action: string;
  subjectTable: string | null;
  subjectId: string | null;
  payload: unknown;
  createdAt: Date;
  actor: { id: string; email: string; displayName: string | null; createdAt: Date } | null;
}

function toEventView(row: EventRow): EventWithActor {
  return {
    // BigInt never crosses this boundary — `JSON.stringify` throws on one, and a
    // Server → Client Component payload is JSON.
    id: eventId(row.id),
    orgId: row.orgId,
    actorId: row.actorId,
    actorKind: row.actorKind as EventWithActor["actorKind"],
    action: row.action as ViewEventAction,
    subjectTable: row.subjectTable,
    subjectId: row.subjectId,
    payload: asJsonObject(row.payload as never),
    createdAt: row.createdAt,
    actor: row.actor ? toUser(row.actor) : null,
  };
}

/**
 * Everything that happened to one tender, newest first (§10.5).
 *
 * An event points at the row it describes — a document, an assessment, a result
 * — not at the tender, so the subjects are gathered first and the log is read
 * against them. Two queries, no N+1. Events that carry `tenderId` in their
 * payload are picked up as well, which is what the workspace and library writes
 * use to attach themselves to a tender they do not otherwise reference.
 */
export async function listTenderEvents(orgId: string, tenderId: string): Promise<EventWithActor[]> {
  const tender = await prisma.tender.findFirst({
    where: { id: tenderId, orgId },
    select: {
      id: true,
      documents: { select: { id: true } },
      requirements: { select: { id: true, response: { select: { id: true } } } },
      assessments: { select: { id: true, results: { select: { id: true } } } },
      bidTasks: { select: { id: true } },
    },
  });
  if (!tender) return [];

  const subjectIds = [
    tender.id,
    ...tender.documents.map((d) => d.id),
    ...tender.requirements.flatMap((r) => [r.id, ...(r.response ? [r.response.id] : [])]),
    ...tender.assessments.flatMap((a) => [a.id, ...a.results.map((r) => r.id)]),
    ...tender.bidTasks.map((t) => t.id),
  ];

  const rows = await prisma.event.findMany({
    where: {
      orgId,
      OR: [
        { subjectId: { in: subjectIds } },
        { payload: { path: ["tenderId"], equals: tenderId } },
      ],
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: { actor: true },
  });
  return rows.map(toEventView);
}

/**
 * When the profile was last edited. Drives "this assessment may be stale" (§14)
 * and the profile screen's list of tenders worth re-running. Null when the
 * organisation has never recorded a profile change.
 */
export async function getLastProfileChangeAt(orgId: string, db: Db = prisma): Promise<Date | null> {
  const row = await db.event.findFirst({
    where: { orgId, action: "profile.updated" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  return row?.createdAt ?? null;
}
