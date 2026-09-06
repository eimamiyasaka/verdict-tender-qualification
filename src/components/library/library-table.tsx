"use client";

import * as React from "react";
import Link from "next/link";
import { AnswerDialog } from "@/components/library/answer-dialog";
import { RemoveForm } from "@/components/profile/entity-dialog";
import { Chip, DateMono } from "@/components/common/typography";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteLibraryAnswerAction } from "@/lib/actions/library";
import { countWords } from "@/lib/text";
import type { LibraryAnswerWithSource, Tender } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Answer library (§10.4): a table of past answers with tags as mono chips
 * and usage counts, a client-side filter over title and body, and rows that
 * expand inline.
 */
export function LibraryTable({
  answers,
  tenders,
}: {
  answers: LibraryAnswerWithSource[];
  tenders: Array<Pick<Tender, "id" | "title">>;
}) {
  const [query, setQuery] = React.useState("");
  const [openId, setOpenId] = React.useState<string | null>(null);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return answers;
    return answers.filter((a) => `${a.title} ${a.body} ${a.tags.join(" ")}`.toLowerCase().includes(q));
  }, [answers, query]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex flex-1 flex-col gap-1 text-[12px] text-ink/60 sm:max-w-sm">
          <span className="sr-only">Filter answers</span>
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter by title, body or tag…" className="h-9" />
        </label>
        <p className="tabular text-[12px] text-ink/60">
          {filtered.length} of {answers.length}
          {query ? (
            <button type="button" onClick={() => setQuery("")} className="ml-3 rounded-sm font-mono underline-offset-4 hover:text-ink hover:underline">
              clear
            </button>
          ) : null}
        </p>
      </div>

      {answers.length === 0 ? (
        <p className="rounded-sm border border-dashed border-rule px-4 py-8 text-center text-sm text-ink/70">
          The library is empty. Add the answers you keep rewriting — social value, TUPE, safeguarding — and Verdict will suggest them in the workspace.
        </p>
      ) : filtered.length === 0 ? (
        <p className="rounded-sm border border-dashed border-rule px-4 py-8 text-center text-sm text-ink/70">
          Nothing matches “{query}”. Try a tag, or one word from the question.
        </p>
      ) : (
        <ul className="divide-y divide-rule rounded-sm border border-rule">
          {filtered.map((a) => {
            const open = openId === a.id;
            return (
              <li key={a.id}>
                <div className="grid gap-x-6 gap-y-2 px-4 py-3.5 sm:grid-cols-[1fr_auto] sm:items-start sm:px-5">
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={`answer-${a.id}`}
                    onClick={() => setOpenId(open ? null : a.id)}
                    className="min-w-0 rounded-sm text-left"
                  >
                    <span className="flex items-baseline gap-2">
                      <span aria-hidden className={cn("inline-block w-3 font-mono text-ink/60 transition-transform", open && "rotate-90")}>
                        ▸
                      </span>
                      <span className="text-sm font-medium text-ink">{a.title}</span>
                    </span>
                    {!open ? <span className="mt-1 line-clamp-2 pl-5 text-[13px] text-ink/70">{a.body}</span> : null}
                    <span className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-5">
                      {a.tags.map((t) => (
                        <Chip key={t}>{t}</Chip>
                      ))}
                      <span className="tabular ml-1 font-mono text-[12px] text-ink/60">
                        {countWords(a.body)} words · used {a.timesUsed}×
                      </span>
                    </span>
                  </button>
                  <div className="flex items-center justify-end gap-1">
                    <AnswerDialog trigger={<Button variant="ghost" size="sm" aria-label={`Edit ${a.title}`}>Edit</Button>} existing={a} tenders={tenders} />
                    <RemoveForm action={deleteLibraryAnswerAction} id={a.id} label={`Remove ${a.title}`} />
                  </div>
                </div>
                <div id={`answer-${a.id}`} hidden={!open} className="border-t border-rule bg-paper px-4 py-4 sm:px-5">
                  <div className="whitespace-pre-line pl-5 text-sm leading-relaxed text-ink">{a.body}</div>
                  <p className="mt-3 flex flex-wrap gap-x-4 pl-5 font-mono text-[12px] text-ink/60">
                    <span>
                      added <DateMono date={a.createdAt} />
                    </span>
                    {a.sourceTender ? (
                      <span>
                        from{" "}
                        <Link href={`/tenders/${a.sourceTender.id}`} className="rounded-sm underline underline-offset-4 hover:text-ink">
                          {a.sourceTender.title}
                        </Link>
                      </span>
                    ) : null}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
