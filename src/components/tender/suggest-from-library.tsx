"use client";

import * as React from "react";
import { Chip } from "@/components/common/typography";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { suggestFromLibraryAction, applyLibraryAnswerAction } from "@/lib/actions/workspace";
import type { Suggestion } from "@/lib/db/library";
import { countWords } from "@/lib/text";

/**
 * "Suggest from library" (§10.2). Keyword + tag retrieval over the answer
 * library, top three, ranked by matched terms then reuse count. Choosing one
 * records the reuse and hands the body back to the editor.
 */
export function SuggestFromLibrary({
  query,
  requirementId,
  tenderId,
  disabled,
  onUse,
}: {
  query: string;
  requirementId: string;
  tenderId: string;
  disabled?: boolean;
  onUse: (answer: { id: string; title: string; body: string }) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [suggestions, setSuggestions] = React.useState<Suggestion[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [usingId, setUsingId] = React.useState<string | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  // When an answer is used, the editor takes focus; otherwise focus returns to the trigger.
  const usedRef = React.useRef(false);

  React.useEffect(() => {
    if (!open) return;
    usedRef.current = false;
    setSuggestions(null);
    setError(null);
    startTransition(async () => {
      try {
        setSuggestions(await suggestFromLibraryAction(query));
      } catch {
        setError("The library couldn't be searched just now. Close this and try again.");
      }
    });
  }, [open, query]);

  function use(s: Suggestion) {
    setUsingId(s.answer.id);
    startTransition(async () => {
      const result = await applyLibraryAnswerAction(s.answer.id, requirementId, tenderId);
      setUsingId(null);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      usedRef.current = true;
      setOpen(false);
      onUse({ id: s.answer.id, title: result.title, body: result.body });
    });
  }

  return (
    <>
      <Button ref={triggerRef} type="button" variant="outline" size="sm" disabled={disabled} onClick={() => setOpen(true)}>
        Suggest from library
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-w-2xl"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (!usedRef.current) triggerRef.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>Suggest from library</DialogTitle>
            <DialogDescription>
              Past answers matching this question by keyword and tag. Using one inserts it into the draft for you to cut down.
            </DialogDescription>
          </DialogHeader>

          {error ? <p role="alert" className="text-sm text-flag">{error}</p> : null}

          {suggestions === null && !error ? (
            <ul className="flex flex-col gap-3" aria-busy aria-label="Searching the library">
              {[0, 1, 2].map((i) => (
                <li key={i} className="flex flex-col gap-2 rounded-sm border border-rule p-4">
                  <div className="h-4 w-1/2 rounded-sm bg-rule/60" />
                  <div className="h-3.5 w-full rounded-sm bg-rule/60" />
                  <div className="h-3.5 w-5/6 rounded-sm bg-rule/60" />
                </li>
              ))}
            </ul>
          ) : null}

          {suggestions && suggestions.length === 0 ? (
            <p className="rounded-sm border border-dashed border-rule px-4 py-6 text-center text-sm text-ink/70">
              Nothing in the library matches this question yet. Add answers on the Library page and they&apos;ll be suggested here.
            </p>
          ) : null}

          {suggestions && suggestions.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {suggestions.map((s) => (
                <li key={s.answer.id} className="flex flex-col gap-3 rounded-sm border border-rule p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-sm font-medium text-ink">{s.answer.title}</h3>
                    <span className="tabular font-mono text-[12px] text-ink/60">
                      {countWords(s.answer.body)} words · used {s.answer.timesUsed}×
                    </span>
                  </div>
                  <p className="line-clamp-4 text-[13px] leading-relaxed text-ink/80">{s.answer.body}</p>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="flex flex-wrap gap-1.5">
                      {s.answer.tags.map((t) => (
                        <Chip key={t}>{t}</Chip>
                      ))}
                      <span className="self-center font-mono text-[11px] text-ink/50">
                        matched {s.matchedTerms.slice(0, 4).join(", ")}
                      </span>
                    </p>
                    <Button type="button" size="sm" disabled={pending} aria-busy={usingId === s.answer.id} onClick={() => use(s)}>
                      {usingId === s.answer.id ? "Inserting…" : "Use this answer"}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
