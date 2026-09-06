"use client";

import * as React from "react";
import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/common/form";
import { Chip, DateMono } from "@/components/common/typography";
import { SourceLink, ViewSourceButton } from "@/components/tender/citation-drawer";
import { SuggestFromLibrary } from "@/components/tender/suggest-from-library";
import { Textarea } from "@/components/ui/textarea";
import { saveResponseAction, updateTaskAction } from "@/lib/actions/workspace";
import { idleState } from "@/lib/actions/shared";
import { describeDeadline, toDateInputValue } from "@/lib/format";
import { TASK_STATUS_LABEL } from "@/lib/labels";
import { countWords } from "@/lib/text";
import { TASK_STATUSES, type OrgRole, type User, type WorkspaceTask } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * One ITT question as a task card (§10.2): assignee, status, due date, word
 * limit and a live word count that turns --flag at 100% without blocking
 * anything — bid managers overwrite then cut (§14).
 */
export function TaskCard({
  task,
  members,
  tenderId,
  closed,
  now,
}: {
  task: WorkspaceTask;
  members: Array<User & { role: OrgRole }>;
  tenderId: string;
  closed: boolean;
  now: Date;
}) {
  const [taskState, taskAction] = useActionState(updateTaskAction, idleState);
  const [responseState, responseAction] = useActionState(saveResponseAction, idleState);
  const taskFormRef = React.useRef<HTMLFormElement>(null);

  const savedBody = task.response?.body ?? "";
  const [body, setBody] = React.useState(savedBody);
  const [sourceAnswerId, setSourceAnswerId] = React.useState<string>(task.response?.sourceAnswerId ?? "");
  const [insertedFrom, setInsertedFrom] = React.useState<string | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // A successful save makes the current body the new baseline.
  const lastToken = React.useRef<number | undefined>(undefined);
  const [baseline, setBaseline] = React.useState(savedBody);
  React.useEffect(() => {
    if (responseState.status === "success" && responseState.successToken !== lastToken.current) {
      lastToken.current = responseState.successToken;
      setBaseline(body);
      setInsertedFrom(null);
    }
  }, [responseState, body]);

  const requirement = task.requirement;
  const wordLimit = requirement?.wordLimit ?? null;
  const words = countWords(body);
  const over = wordLimit !== null && words > wordLimit;
  const atLimit = wordLimit !== null && words === wordLimit;
  const dirty = body !== baseline;
  const due = describeDeadline(task.dueOn, now);

  function submitTaskForm() {
    taskFormRef.current?.requestSubmit();
  }

  const selectClass =
    "h-8 rounded-sm border border-rule bg-paper px-2 text-[13px] text-ink hover:border-ink/60 focus:border-ink disabled:opacity-50";

  return (
    <li className="rounded-sm border border-rule bg-paper">
      <div className="flex flex-col gap-3 border-b border-rule px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <h3 className="text-[15px] font-medium text-ink">{task.title}</h3>
            {requirement ? (
              <p className="mt-1 flex flex-wrap items-center gap-1.5">
                {requirement.questionRef ? <Chip>{requirement.questionRef}</Chip> : null}
                {wordLimit !== null ? <Chip>{wordLimit.toLocaleString("en-GB")} words</Chip> : null}
                {requirement.weighting !== null ? <Chip>{requirement.weighting}% of score</Chip> : null}
                <SourceLink requirement={requirement} className="ml-1" />
                <ViewSourceButton requirement={requirement} />
              </p>
            ) : null}
          </div>
          <form ref={taskFormRef} action={taskAction} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="taskId" value={task.id} />
            <input type="hidden" name="tenderId" value={tenderId} />
            <label className="flex items-center gap-1.5 text-[12px] text-ink/60">
              <span className="sr-only sm:not-sr-only">Owner</span>
              <select
                name="assigneeId"
                defaultValue={task.assigneeId ?? ""}
                onChange={submitTaskForm}
                disabled={closed}
                className={cn(selectClass, !task.assigneeId && "text-pending")}
                aria-label="Assignee"
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName ?? m.email}
                  </option>
                ))}
              </select>
            </label>
            <select
              name="status"
              defaultValue={task.status}
              onChange={submitTaskForm}
              disabled={closed}
              className={selectClass}
              aria-label="Status"
            >
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {TASK_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-[12px] text-ink/60">
              <span className="sr-only sm:not-sr-only">Due</span>
              <input
                type="date"
                name="dueOn"
                defaultValue={toDateInputValue(task.dueOn)}
                onChange={submitTaskForm}
                disabled={closed}
                aria-label="Due date"
                className={cn("h-8 rounded-sm border border-rule bg-paper px-2 font-mono text-[12px] text-ink hover:border-ink/60 focus:border-ink", due?.urgent && "text-flag")}
              />
            </label>
            <SubmitButton size="sm" variant="ghost" pendingLabel="Saving…" className="sr-only focus:not-sr-only">
              Save task
            </SubmitButton>
          </form>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink/60">
          {task.assignee ? <span>Owned by {task.assignee.displayName ?? task.assignee.email}</span> : <span className="text-pending">Nobody owns this yet</span>}
          {task.dueOn ? (
            <span className={cn(due?.urgent && "text-flag")}>
              Due <DateMono date={task.dueOn} />
              {due?.closed ? " (overdue)" : due ? ` (${due.short})` : ""}
            </span>
          ) : null}
          {task.response ? (
            <span>
              Draft updated <DateMono date={task.response.updatedAt} withTime />
            </span>
          ) : null}
          <FormMessage state={taskState} className="text-[12px]" />
        </div>
      </div>

      {requirement ? (
        <form action={responseAction} className="flex flex-col gap-3 px-4 py-4 sm:px-5">
          <input type="hidden" name="requirementId" value={requirement.id} />
          <input type="hidden" name="tenderId" value={tenderId} />
          <input type="hidden" name="sourceAnswerId" value={sourceAnswerId} />
          <label htmlFor={`response-${task.id}`} className="sr-only">
            Draft response for {task.title}
          </label>
          <Textarea
            id={`response-${task.id}`}
            ref={textareaRef}
            name="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={closed}
            placeholder={`Draft your answer to ${requirement.questionRef ?? "this question"} here, or seed it from the library.`}
            className="min-h-40 font-sans"
            aria-describedby={`count-${task.id}`}
          />
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <p id={`count-${task.id}`} className={cn("tabular font-mono text-[12px]", over ? "font-medium text-flag" : atLimit ? "text-pending" : "text-ink/60")} aria-live="polite">
              {words.toLocaleString("en-GB")}
              {wordLimit !== null ? ` / ${wordLimit.toLocaleString("en-GB")}` : ""} words
              {over ? ` — ${(words - wordLimit!).toLocaleString("en-GB")} over the limit` : ""}
              {insertedFrom ? <span className="ml-3 text-ink/50">seeded from “{insertedFrom}”</span> : null}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {dirty ? <span className="font-mono text-[12px] text-pending">Unsaved changes</span> : null}
              <FormMessage state={responseState} className="text-[12px]" />
              <SuggestFromLibrary
                query={`${requirement.summary} ${requirement.quotedClause}`}
                requirementId={requirement.id}
                tenderId={tenderId}
                disabled={closed}
                onUse={(answer) => {
                  setBody((current) => (current.trim() === "" ? answer.body : `${current.trimEnd()}\n\n${answer.body}`));
                  setSourceAnswerId(answer.id);
                  setInsertedFrom(answer.title);
                  // After the dialog has unmounted, so its focus trap cannot pull focus back.
                  setTimeout(() => textareaRef.current?.focus(), 0);
                }}
              />
              <SubmitButton size="sm" disabled={closed || !dirty} pendingLabel="Saving draft…">
                Save draft
              </SubmitButton>
            </div>
          </div>
        </form>
      ) : null}
    </li>
  );
}
