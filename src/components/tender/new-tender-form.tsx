"use client";

import { useActionState } from "react";
import { CurrencySelectNative, Field, FormMessage, SubmitButton } from "@/components/common/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { createTenderAction } from "@/lib/actions/tenders";
import { idleState } from "@/lib/actions/shared";
import { TENDER_SOURCE_LABEL } from "@/lib/labels";
import { TENDER_SOURCES } from "@/lib/types";

export function NewTenderForm() {
  const [state, action] = useActionState(createTenderAction, idleState);
  const e = state.fieldErrors ?? {};

  return (
    <form action={action} className="flex flex-col gap-8" noValidate>
      <section className="flex flex-col gap-5">
        <h2 className="section-label text-ink/60">The tender</h2>
        <Field label="Title" htmlFor="title" error={e.title} hint="Buyer and service, as you'd say it aloud: “Camden LBC — Grounds Maintenance”.">
          <Input name="title" autoFocus required maxLength={160} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Buyer" htmlFor="buyerName" error={e.buyerName} optional>
            <Input name="buyerName" maxLength={120} />
          </Field>
          <Field label="Lot" htmlFor="lotReference" error={e.lotReference} optional hint="One lot per tender record.">
            <Input name="lotReference" placeholder="Lot 2" maxLength={40} />
          </Field>
        </div>
        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="Source" htmlFor="source" error={e.source} optional>
            <select
              name="source"
              defaultValue=""
              className="h-9 w-full rounded-sm border border-rule bg-paper px-2.5 text-sm text-ink hover:border-ink/60 focus:border-ink"
            >
              <option value="">—</option>
              {TENDER_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {TENDER_SOURCE_LABEL[s]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Notice reference" htmlFor="noticeReference" error={e.noticeReference} optional>
            <Input name="noticeReference" placeholder="ocds-h6vhtk-…" className="font-mono" maxLength={80} />
          </Field>
          <Field label="Notice link" htmlFor="sourceUrl" error={e.sourceUrl} optional>
            <Input name="sourceUrl" type="url" inputMode="url" placeholder="https://" />
          </Field>
        </div>
      </section>

      <section className="flex flex-col gap-5">
        <h2 className="section-label text-ink/60">Value and dates</h2>
        <div className="grid gap-5 sm:grid-cols-[1fr_6rem_1fr]">
          <Field label="Contract value" htmlFor="contractValue" error={e.contractValue} optional hint="Total, not annual. Digits only.">
            <Input name="contractValue" inputMode="numeric" placeholder="2400000" />
          </Field>
          <Field label="Currency" htmlFor="currency">
            <CurrencySelectNative id="currency" className="w-full" />
          </Field>
          <Field label="Duration" htmlFor="durationMonths" error={e.durationMonths} optional hint="Months.">
            <Input name="durationMonths" inputMode="numeric" placeholder="48" />
          </Field>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Submission deadline"
            htmlFor="submissionDeadline"
            error={e.submissionDeadline}
            optional
            hint="Extraction will pick this up from the pack if you leave it blank."
          >
            <Input name="submissionDeadline" type="date" className="font-mono" />
          </Field>
          <Field label="Clarification deadline" htmlFor="clarificationDeadline" error={e.clarificationDeadline} optional>
            <Input name="clarificationDeadline" type="date" className="font-mono" />
          </Field>
        </div>
      </section>

      <FormMessage state={state} />

      <div className="flex flex-wrap items-center gap-3 border-t border-rule pt-6">
        <SubmitButton pendingLabel="Creating tender…">Create tender and add documents</SubmitButton>
        <Button variant="ghost" asChild>
          <Link href="/">Cancel</Link>
        </Button>
        <p className="text-[13px] text-ink/60 sm:ml-auto">Next step: upload the pack, typed by role.</p>
      </div>
    </form>
  );
}
