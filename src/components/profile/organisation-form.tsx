"use client";

import * as React from "react";
import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/common/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveOrganisationAction } from "@/lib/actions/profile";
import { idleState } from "@/lib/actions/shared";
import type { Organisation } from "@/lib/types";

const REGIONS = ["England", "Scotland", "Wales", "Northern Ireland", "Other"];

/** Organisation details: read view with an inline edit form. Headcount and region are evidence the evaluator reads (§7.4). */
export function OrganisationForm({ organisation }: { organisation: Organisation }) {
  const [editing, setEditing] = React.useState(false);
  const [state, action] = useActionState(saveOrganisationAction, idleState);
  const lastToken = React.useRef<number | undefined>(undefined);
  React.useEffect(() => {
    if (state.status === "success" && state.successToken !== lastToken.current) {
      lastToken.current = state.successToken;
      setEditing(false);
    }
  }, [state]);

  if (!editing) {
    return (
      <div className="rounded-sm border border-rule px-4 py-4 sm:px-5">
        <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
          <Item label="Registered name">{organisation.name}</Item>
          <Item label="Companies House">
            {organisation.companiesHouseNumber ? <span className="font-mono">{organisation.companiesHouseNumber}</span> : <Missing />}
          </Item>
          <Item label="Headcount">{organisation.headcount !== null ? <span className="tabular">{organisation.headcount}</span> : <Missing />}</Item>
          <Item label="Registered in">{organisation.registeredRegion ?? <Missing />}</Item>
          <Item label="SIC codes" className="sm:col-span-2 lg:col-span-4">
            {organisation.sicCodes.length ? <span className="font-mono">{organisation.sicCodes.join(" · ")}</span> : <Missing />}
          </Item>
        </dl>
        <div className="mt-4 flex items-center gap-3">
          <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
            Edit details
          </Button>
          <FormMessage state={state} className="text-[13px]" />
        </div>
      </div>
    );
  }

  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="flex flex-col gap-4 rounded-sm border border-rule px-4 py-4 sm:px-5" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Registered name" htmlFor="org-name" error={e.name}>
          <Input name="name" defaultValue={organisation.name} maxLength={120} />
        </Field>
        <Field label="Companies House number" htmlFor="org-ch" error={e.companiesHouseNumber} optional>
          <Input name="companiesHouseNumber" defaultValue={organisation.companiesHouseNumber ?? ""} className="font-mono" maxLength={12} />
        </Field>
        <Field label="Headcount" htmlFor="org-headcount" error={e.headcount} optional hint="Read by resource requirements such as minimum staff numbers.">
          <Input name="headcount" inputMode="numeric" defaultValue={organisation.headcount ?? ""} />
        </Field>
        <Field label="Registered in" htmlFor="org-region" error={e.registeredRegion} optional>
          <select
            name="registeredRegion"
            defaultValue={organisation.registeredRegion ?? ""}
            className="h-9 w-full rounded-sm border border-rule bg-paper px-2.5 text-sm text-ink hover:border-ink/60 focus:border-ink"
          >
            <option value="">—</option>
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </Field>
        <Field label="SIC codes" htmlFor="org-sic" error={e.sicCodes} optional hint="Comma-separated, four or five digits each." className="sm:col-span-2">
          <Input name="sicCodes" defaultValue={organisation.sicCodes.join(", ")} className="font-mono" />
        </Field>
      </div>
      <FormMessage state={state} />
      <div className="flex items-center gap-2">
        <SubmitButton size="sm" pendingLabel="Saving…">
          Save details
        </SubmitButton>
        <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function Item({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-[11px] font-medium tracking-wide text-ink/55 uppercase">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{children}</dd>
    </div>
  );
}

function Missing() {
  return <span className="text-pending">Not entered</span>;
}
