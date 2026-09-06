"use client";

import * as React from "react";
import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/common/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createTaskAction } from "@/lib/actions/workspace";
import { idleState } from "@/lib/actions/shared";
import type { OrgRole, User } from "@/lib/types";

/** Tasks that aren't ITT questions: pricing schedule, references, form signatures. */
export function AddTaskForm({ tenderId, members }: { tenderId: string; members: Array<User & { role: OrgRole }> }) {
  const [open, setOpen] = React.useState(false);
  const [state, action] = useActionState(createTaskAction, idleState);
  const formRef = React.useRef<HTMLFormElement>(null);
  const lastToken = React.useRef<number | undefined>(undefined);

  React.useEffect(() => {
    if (state.status === "success" && state.successToken !== lastToken.current) {
      lastToken.current = state.successToken;
      formRef.current?.reset();
      setOpen(false);
    }
  }, [state]);

  if (!open) {
    return (
      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
          + Add task
        </Button>
        <FormMessage state={state} className="text-[13px]" />
      </div>
    );
  }

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-4 rounded-sm border border-rule px-4 py-4 sm:px-5" noValidate>
      <input type="hidden" name="tenderId" value={tenderId} />
      <div className="grid gap-4 sm:grid-cols-[1fr_12rem_10rem]">
        <Field label="Task" htmlFor="new-task-title" error={state.fieldErrors?.title}>
          <Input name="title" autoFocus placeholder="Complete the pricing schedule" maxLength={160} />
        </Field>
        <Field label="Owner" htmlFor="new-task-assignee" optional>
          <select
            name="assigneeId"
            defaultValue=""
            className="h-9 w-full rounded-sm border border-rule bg-paper px-2.5 text-sm text-ink hover:border-ink/60 focus:border-ink"
          >
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.displayName ?? m.email}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Due" htmlFor="new-task-due" optional>
          <Input name="dueOn" type="date" className="font-mono" />
        </Field>
      </div>
      <FormMessage state={state} />
      <div className="flex items-center gap-2">
        <SubmitButton size="sm" pendingLabel="Adding…">
          Add task
        </SubmitButton>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
