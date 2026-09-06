"use client";

import { Field } from "@/components/common/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EntityDialog, nativeSelectClass } from "@/components/profile/entity-dialog";
import { saveLibraryAnswerAction } from "@/lib/actions/library";
import type { LibraryAnswer, Tender } from "@/lib/types";

export function AnswerDialog({
  trigger,
  existing,
  tenders,
}: {
  trigger: React.ReactElement;
  existing?: LibraryAnswer;
  tenders: Array<Pick<Tender, "id" | "title">>;
}) {
  return (
    <EntityDialog
      title={existing ? "Edit answer" : "Add answer to the library"}
      description="Past answers are matched to ITT questions by keyword and tag. Title and tags are what the search reads first."
      trigger={trigger}
      action={saveLibraryAnswerAction}
      submitLabel={existing ? "Save changes" : "Add answer"}
      pendingLabel="Saving…"
      wide
    >
      {(state) => {
        const e = state.fieldErrors ?? {};
        return (
          <>
            {existing ? <input type="hidden" name="id" value={existing.id} /> : null}
            <Field label="Title" htmlFor="ans-title" error={e.title} hint="The question it answers, in your words.">
              <Input name="title" defaultValue={existing?.title ?? ""} maxLength={140} autoFocus />
            </Field>
            <Field label="Answer" htmlFor="ans-body" error={e.body}>
              <Textarea name="body" defaultValue={existing?.body ?? ""} className="min-h-56" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tags" htmlFor="ans-tags" error={e.tags} optional hint="Comma-separated: social-value, tupe, iso14001.">
                <Input name="tags" defaultValue={existing?.tags.join(", ") ?? ""} className="font-mono" />
              </Field>
              <Field label="From tender" htmlFor="ans-source" error={e.sourceTenderId} optional>
                <select name="sourceTenderId" defaultValue={existing?.sourceTenderId ?? ""} className={nativeSelectClass}>
                  <option value="">—</option>
                  {tenders.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </>
        );
      }}
    </EntityDialog>
  );
}
