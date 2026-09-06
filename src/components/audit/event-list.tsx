import { DateMono, VerdictWord } from "@/components/common/typography";
import { DOCUMENT_TYPE_LABEL, EVENT_ACTION_LABEL } from "@/lib/labels";
import type { DocumentType } from "@/lib/types";
import type { BidRecommendation, EventWithActor } from "@/lib/types";

/**
 * Reverse-chronological Event rows (§10.5). Each row: when, who, what, and
 * the facts from the payload that make it re-explainable later — model and
 * chunk counts for extractions, version and counts for assessments.
 */
function describe(event: EventWithActor): React.ReactNode {
  const p = event.payload;
  switch (event.action) {
    case "tender.created":
      return <>Tender created{p.source ? <> from {String(p.source).replace(/_/g, " ")}</> : null}.</>;
    case "tender.status_changed":
      return (
        <>
          Status changed from <span className="font-mono text-[12px]">{String(p.from)}</span> to{" "}
          <span className="font-mono text-[12px]">{String(p.to)}</span>.
        </>
      );
    case "document.uploaded":
      if (p.change === "removed") {
        return (
          <>
            <span className="font-mono text-[12px]">{String(p.filename)}</span> removed
            {typeof p.requirementsRemoved === "number" && p.requirementsRemoved > 0 ? <> with {p.requirementsRemoved} requirements</> : null}.
          </>
        );
      }
      return (
        <>
          <span className="font-mono text-[12px]">{String(p.filename)}</span> uploaded as{" "}
          {DOCUMENT_TYPE_LABEL[p.docType as DocumentType] ?? String(p.docType).replace(/_/g, " ")}
          {p.pageCount ? <>, {String(p.pageCount)} pages</> : null}.
        </>
      );
    case "extraction.completed": {
      const failed = Number(p.failedChunks ?? 0);
      return (
        <>
          <span className="font-mono text-[12px]">{String(p.filename)}</span>: {String(p.requirementsFound)} requirements from{" "}
          {String(p.chunkCount)} chunks with <span className="font-mono text-[12px]">{String(p.model)}</span>
          {typeof p.heldForReview === "number" && p.heldForReview > 0 ? <>, {p.heldForReview} held for review</> : null}
          {typeof p.citationsAdded === "number" && p.citationsAdded > 0 ? <>, {p.citationsAdded} merged as extra citations</> : null}
          {failed > 0 ? (
            <>
              . <span className="text-flag">{failed} {failed === 1 ? "chunk" : "chunks"} failed and were not retried.</span>
            </>
          ) : (
            "."
          )}
        </>
      );
    }
    case "extraction.failed":
      return (
        <>
          <span className="font-mono text-[12px]">{String(p.filename)}</span>: <span className="text-flag">{String(p.error)}</span>
        </>
      );
    case "assessment.run":
      return (
        <>
          Assessment v{String(p.version)} · <VerdictWord recommendation={p.recommendation as BidRecommendation} className="text-[12px]" /> ·{" "}
          <span className="tabular">
            {String(p.mandatoryPassed)} pass · {String(p.mandatoryFailed)} fail · {String(p.mandatoryUnknown)} unknown
          </span>
          {p.deadlineUsed ? (
            <>
              {" "}
              · deadline <DateMono date={String(p.deadlineUsed)} />
            </>
          ) : null}
        </>
      );
    case "result.overridden":
      return <>Result overridden{p.note ? <>: {String(p.note)}</> : null}.</>;
    case "profile.updated":
      return (
        <>
          Profile {String(p.change ?? "updated")}: {String(p.label)} ({String(p.section).replace(/_/g, " ")}).
        </>
      );
    case "task.updated":
      if (p.change === "created") return <>Task added: {String(p.title)}.</>;
      return (
        <>
          Task updated: {String(p.title)}
          {p.to && typeof p.to === "object" ? (
            <>
              {" "}
              → <span className="font-mono text-[12px]">{String((p.to as Record<string, unknown>).status).replace(/_/g, " ")}</span>
            </>
          ) : null}
          .
        </>
      );
    case "response.saved":
      return (
        <>
          Draft saved for {String(p.questionRef)} · <span className="tabular">{String(p.words)} words</span>.
        </>
      );
    case "library.answer_used":
      return (
        <>
          Library answer “{String(p.answerTitle)}” used to seed {String(p.questionRef)}.
        </>
      );
    default:
      return <>{EVENT_ACTION_LABEL[event.action] ?? event.action}</>;
  }
}

export function EventList({ events }: { events: EventWithActor[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-ink/70">Nothing has happened on this tender yet.</p>;
  }
  return (
    <ol className="divide-y divide-rule border-y border-rule">
      {events.map((event) => (
        <li key={event.id} className="grid gap-x-6 gap-y-1 py-3.5 sm:grid-cols-[10.5rem_1fr]">
          <div className="flex flex-col gap-0.5">
            <DateMono date={event.createdAt} withTime className="text-[12px] text-ink/60" />
            <span className="text-[12px] text-ink/60">
              {event.actor?.displayName ?? (event.actorKind === "model" ? "Model" : event.actorKind === "system" ? "System" : "Unknown user")}
            </span>
          </div>
          <div className="min-w-0 text-sm text-ink">
            <p className="font-mono text-[11px] tracking-wide text-ink/50 uppercase">{EVENT_ACTION_LABEL[event.action] ?? event.action}</p>
            <p className="mt-0.5 leading-relaxed">{describe(event)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
