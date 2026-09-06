/**
 * Answer library (§7.7, §10.4). Retrieval is keyword + tag overlap, ranked by
 * matched-term count then timesUsed, top 3 (§4 says so, on purpose).
 *
 * Prisma seam: `suggestLibraryAnswers` becomes ILIKE over title and body plus
 * `tags && $terms`, ordered in SQL; the ranking below is the same rule.
 */
import { searchTerms } from "@/lib/text";
import type { LibraryAnswer, LibraryAnswerWithSource } from "@/lib/types";
import { appendEvent, clone, getStore, newId } from "./_placeholder/store";

export async function listLibraryAnswers(orgId: string): Promise<LibraryAnswerWithSource[]> {
  const store = getStore();
  return store.libraryAnswers
    .filter((a) => a.orgId === orgId)
    .map((a) => {
      const tender = a.sourceTenderId ? store.tenders.find((t) => t.id === a.sourceTenderId) : null;
      return { ...clone(a), sourceTender: tender ? { id: tender.id, title: tender.title } : null };
    })
    .sort((a, b) => b.timesUsed - a.timesUsed || a.title.localeCompare(b.title));
}

export async function getLibraryAnswer(orgId: string, id: string): Promise<LibraryAnswer | null> {
  const answer = getStore().libraryAnswers.find((a) => a.id === id && a.orgId === orgId);
  return answer ? clone(answer) : null;
}

export interface Suggestion {
  answer: LibraryAnswer;
  matchedTerms: string[];
}

export async function suggestLibraryAnswers(orgId: string, query: string, limit = 3): Promise<Suggestion[]> {
  const terms = searchTerms(query);
  if (terms.length === 0) return [];
  const store = getStore();
  const scored: Suggestion[] = [];
  for (const answer of store.libraryAnswers) {
    if (answer.orgId !== orgId) continue;
    const haystack = `${answer.title} ${answer.body}`.toLowerCase();
    const tagSet = new Set(answer.tags.map((t) => t.toLowerCase().replace(/-/g, " ")));
    const matched = terms.filter((t) => haystack.includes(t) || Array.from(tagSet).some((tag) => tag.includes(t)));
    if (matched.length > 0) scored.push({ answer: clone(answer), matchedTerms: matched });
  }
  return scored
    .sort((a, b) => b.matchedTerms.length - a.matchedTerms.length || b.answer.timesUsed - a.answer.timesUsed)
    .slice(0, limit);
}

export type LibraryAnswerInput = Pick<LibraryAnswer, "title" | "body" | "tags" | "sourceTenderId">;

export async function createLibraryAnswer(orgId: string, userId: string, input: LibraryAnswerInput): Promise<LibraryAnswer> {
  const store = getStore();
  const row: LibraryAnswer = { id: newId(), orgId, ...input, timesUsed: 0, createdAt: new Date() };
  store.libraryAnswers.push(row);
  appendEvent(store, {
    orgId,
    actorId: userId,
    actorKind: "user",
    action: "profile.updated",
    subjectTable: "library_answers",
    subjectId: row.id,
    payload: { section: "library", change: "added", label: row.title, tenderId: input.sourceTenderId ?? undefined },
  });
  return clone(row);
}

export async function updateLibraryAnswer(orgId: string, userId: string, id: string, input: LibraryAnswerInput): Promise<LibraryAnswer> {
  const store = getStore();
  const row = store.libraryAnswers.find((a) => a.id === id && a.orgId === orgId);
  if (!row) throw new Error("Answer not found");
  Object.assign(row, input);
  appendEvent(store, {
    orgId,
    actorId: userId,
    actorKind: "user",
    action: "profile.updated",
    subjectTable: "library_answers",
    subjectId: row.id,
    payload: { section: "library", change: "updated", label: row.title },
  });
  return clone(row);
}

export async function deleteLibraryAnswer(orgId: string, userId: string, id: string): Promise<void> {
  const store = getStore();
  const index = store.libraryAnswers.findIndex((a) => a.id === id && a.orgId === orgId);
  if (index === -1) return;
  const [removed] = store.libraryAnswers.splice(index, 1);
  appendEvent(store, {
    orgId,
    actorId: userId,
    actorKind: "user",
    action: "profile.updated",
    subjectTable: "library_answers",
    subjectId: id,
    payload: { section: "library", change: "removed", label: removed.title },
  });
}

/** Increments timesUsed and records which requirement the answer seeded. */
export async function markLibraryAnswerUsed(
  orgId: string,
  userId: string,
  answerId: string,
  requirementId: string,
): Promise<void> {
  const store = getStore();
  const answer = store.libraryAnswers.find((a) => a.id === answerId && a.orgId === orgId);
  if (!answer) return;
  answer.timesUsed += 1;
  const requirement = store.requirements.find((r) => r.id === requirementId);
  appendEvent(store, {
    orgId,
    actorId: userId,
    actorKind: "user",
    action: "library.answer_used",
    subjectTable: "responses",
    subjectId: requirementId,
    payload: {
      tenderId: requirement?.tenderId,
      questionRef: requirement?.questionRef ?? requirement?.summary,
      answerId,
      answerTitle: answer.title,
    },
  });
}
