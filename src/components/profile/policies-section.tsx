"use client";

import * as React from "react";
import { Field } from "@/components/common/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EntityDialog, nativeSelectClass, RemoveForm, RowActions } from "@/components/profile/entity-dialog";
import { GapList, ProfileSection, ReviewedText, UsageText } from "@/components/profile/section";
import { deletePolicyAction, savePolicyAction } from "@/lib/actions/profile";
import { toDateInputValue } from "@/lib/format";
import { policyTypeLabel } from "@/lib/labels";
import { POLICY_TYPES, type Policy, type ProfileGap, type UsageCount } from "@/lib/types";

type Row = Policy & { usage: UsageCount };

function PolicyFields({
  held,
  existing,
  presetType,
  errors,
}: {
  held: Set<string>;
  existing?: Row;
  presetType?: string;
  errors: Record<string, string>;
}) {
  const known = POLICY_TYPES.filter((t) => !held.has(t) || t === existing?.policyType);
  const initial = existing?.policyType ?? presetType ?? "";
  const initialIsKnown = (POLICY_TYPES as readonly string[]).includes(initial);
  const [other, setOther] = React.useState(initial !== "" && !initialIsKnown);
  return (
    <>
      {existing ? <input type="hidden" name="id" value={existing.id} /> : null}
      <Field label="Policy type" htmlFor="pol-type" error={errors.policyType}>
        <select
          name="policyType"
          defaultValue={initialIsKnown ? initial : other ? "__other" : ""}
          onChange={(e) => setOther(e.target.value === "__other")}
          className={nativeSelectClass}
          disabled={Boolean(existing)}
        >
          <option value="">Choose…</option>
          {known.map((t) => (
            <option key={t} value={t}>
              {policyTypeLabel(t)}
            </option>
          ))}
          <option value="__other">Other…</option>
        </select>
      </Field>
      {existing ? <input type="hidden" name="policyType" value={existing.policyType} /> : null}
      {other && !existing ? (
        <Field label="Other policy type" htmlFor="pol-type-other" error={errors.policyType} hint="As the tender names it: carbon reduction, safeguarding, anti-bribery.">
          <Input name="policyTypeOther" defaultValue={!initialIsKnown ? initial : ""} maxLength={40} />
        </Field>
      ) : null}
      <Field label="Document title" htmlFor="pol-title" error={errors.title} optional>
        <Input name="title" defaultValue={existing?.title ?? ""} maxLength={120} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Last reviewed" htmlFor="pol-reviewed" error={errors.lastReviewed} optional hint="Over 24 months old is flagged.">
          <Input name="lastReviewed" type="date" defaultValue={toDateInputValue(existing?.lastReviewed)} className="font-mono" />
        </Field>
        <Field label="Document link" htmlFor="pol-url" error={errors.documentUrl} optional>
          <Input name="documentUrl" type="url" inputMode="url" defaultValue={existing?.documentUrl ?? ""} placeholder="https://" />
        </Field>
      </div>
    </>
  );
}

export function PoliciesSection({ rows, gaps, now }: { rows: Row[]; gaps: ProfileGap[]; now: Date }) {
  const held = new Set(rows.map((r) => r.policyType));
  return (
    <ProfileSection
      id="policies"
      title="Policies"
      description="A policy that exists passes; one reviewed more than 24 months ago passes with a warning; one that is absent fails."
      count={rows.length}
      action={
        <EntityDialog
          title="Add policy"
          trigger={<Button variant="outline" size="sm">+ Add policy</Button>}
          action={savePolicyAction}
          submitLabel="Save policy"
          pendingLabel="Saving…"
        >
          {(state) => <PolicyFields held={held} errors={state.fieldErrors ?? {}} />}
        </EntityDialog>
      }
    >
      <GapList
        gaps={gaps}
        noun="policy"
        onAddLabel="add it if you have one"
        render={(gap) => (
          <EntityDialog
            title={`Add ${gap.label.toLowerCase()} policy`}
            trigger={
              <button type="button" className="rounded-sm font-mono text-[12px] text-ink/70 underline-offset-4 hover:text-ink hover:underline">
                [add]
              </button>
            }
            action={savePolicyAction}
            submitLabel="Save policy"
            pendingLabel="Saving…"
          >
            {(state) => <PolicyFields held={held} presetType={gap.key} errors={state.fieldErrors ?? {}} />}
          </EntityDialog>
        )}
      />
      {rows.length === 0 ? (
        <p className="rounded-sm border border-dashed border-rule px-4 py-6 text-center text-sm text-ink/70">
          No policies recorded. Every policy requirement will fail until yours are added.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-sm border border-rule">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-rule text-left font-mono text-[11px] tracking-wide text-ink/60 uppercase">
                <th scope="col" className="px-4 py-2.5 font-medium">Policy</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Document</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Last reviewed</th>
                <th scope="col" className="px-4 py-2.5"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {rows.map((row) => (
                <tr key={row.id} className="align-top">
                  <td className="px-4 py-3">
                    <p className="text-ink">{policyTypeLabel(row.policyType)}</p>
                    <UsageText usage={row.usage} />
                  </td>
                  <td className="px-4 py-3 text-ink/80">
                    {row.documentUrl ? (
                      <a href={row.documentUrl} target="_blank" rel="noopener noreferrer" className="rounded-sm underline underline-offset-4 hover:text-ink">
                        {row.title ?? "Open document"}
                      </a>
                    ) : (
                      (row.title ?? "—")
                    )}
                  </td>
                  <td className="px-4 py-3 text-[13px] whitespace-nowrap">
                    <ReviewedText date={row.lastReviewed} now={now} />
                  </td>
                  <td className="px-4 py-3">
                    <RowActions>
                      <EntityDialog
                        title={`Edit ${policyTypeLabel(row.policyType).toLowerCase()} policy`}
                        trigger={<Button variant="ghost" size="sm" aria-label={`Edit ${policyTypeLabel(row.policyType)} policy`}>Edit</Button>}
                        action={savePolicyAction}
                        submitLabel="Save changes"
                        pendingLabel="Saving…"
                      >
                        {(state) => <PolicyFields held={held} existing={row} errors={state.fieldErrors ?? {}} />}
                      </EntityDialog>
                      <RemoveForm action={deletePolicyAction} id={row.id} label={`Remove ${policyTypeLabel(row.policyType)} policy`} />
                    </RowActions>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ProfileSection>
  );
}
