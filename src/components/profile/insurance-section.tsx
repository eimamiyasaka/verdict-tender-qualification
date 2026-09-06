"use client";

import { CurrencySelectNative, Field } from "@/components/common/form";
import { Money } from "@/components/common/typography";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EntityDialog, nativeSelectClass, RemoveForm, RowActions } from "@/components/profile/entity-dialog";
import { ExpiryText, GapList, ProfileSection, UsageText } from "@/components/profile/section";
import { deleteInsuranceAction, saveInsuranceAction } from "@/lib/actions/profile";
import { toDateInputValue } from "@/lib/format";
import { INSURANCE_TYPE_LABEL } from "@/lib/labels";
import { INSURANCE_TYPES, type Insurance, type InsuranceType, type ProfileGap, type UsageCount } from "@/lib/types";

type Row = Insurance & { usage: UsageCount };

function InsuranceFields({
  held,
  existing,
  presetKind,
  errors,
}: {
  held: Set<InsuranceType>;
  existing?: Row;
  presetKind?: string;
  errors: Record<string, string>;
}) {
  const options = INSURANCE_TYPES.filter((k) => !held.has(k) || k === existing?.kind);
  return (
    <>
      {existing ? <input type="hidden" name="id" value={existing.id} /> : null}
      <Field label="Type of cover" htmlFor="ins-kind" error={errors.kind}>
        <select name="kind" defaultValue={existing?.kind ?? presetKind ?? ""} className={nativeSelectClass} disabled={Boolean(existing)}>
          <option value="">Choose…</option>
          {options.map((k) => (
            <option key={k} value={k}>
              {INSURANCE_TYPE_LABEL[k]}
            </option>
          ))}
        </select>
      </Field>
      {existing ? <input type="hidden" name="kind" value={existing.kind} /> : null}
      <div className="grid gap-4 sm:grid-cols-[1fr_6rem]">
        <Field label="Cover amount" htmlFor="ins-cover" error={errors.coverAmount} hint="Per occurrence or per claim, as the policy states it.">
          <Input name="coverAmount" inputMode="numeric" defaultValue={existing?.coverAmount ?? ""} placeholder="10000000" />
        </Field>
        <Field label="Currency" htmlFor="ins-currency" error={errors.currency}>
          <CurrencySelectNative id="ins-currency" defaultValue={existing?.currency ?? "GBP"} className="w-full" />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Insurer" htmlFor="ins-insurer" error={errors.insurer} optional>
          <Input name="insurer" defaultValue={existing?.insurer ?? ""} maxLength={80} />
        </Field>
        <Field label="Expires on" htmlFor="ins-expires" error={errors.expiresOn} optional>
          <Input name="expiresOn" type="date" defaultValue={toDateInputValue(existing?.expiresOn)} className="font-mono" />
        </Field>
      </div>
    </>
  );
}

export function InsuranceSection({ rows, gaps, now }: { rows: Row[]; gaps: ProfileGap[]; now: Date }) {
  const held = new Set(rows.map((r) => r.kind));
  return (
    <ProfileSection
      id="insurance"
      title="Insurance"
      description="Cover levels the evaluator compares against each tender's minimums. A kind of cover that isn't recorded is an unknown, not a fail — an uninsured company and one that hasn't filled in the form look identical from here."
      count={rows.length}
      action={
        <EntityDialog
          title="Add insurance policy"
          trigger={<Button variant="outline" size="sm">+ Add policy</Button>}
          action={saveInsuranceAction}
          submitLabel="Save policy"
          pendingLabel="Saving…"
        >
          {(state) => <InsuranceFields held={held} errors={state.fieldErrors ?? {}} />}
        </EntityDialog>
      }
    >
      <GapList
        gaps={gaps}
        noun="insurance"
        onAddLabel="add the cover you hold to resolve the unknowns"
        render={(gap) => (
          <EntityDialog
            title={`Add ${gap.label.toLowerCase()} cover`}
            trigger={
              <button type="button" className="rounded-sm font-mono text-[12px] text-ink/70 underline-offset-4 hover:text-ink hover:underline">
                [add]
              </button>
            }
            action={saveInsuranceAction}
            submitLabel="Save policy"
            pendingLabel="Saving…"
          >
            {(state) => <InsuranceFields held={held} presetKind={gap.key} errors={state.fieldErrors ?? {}} />}
          </EntityDialog>
        )}
      />
      {rows.length === 0 ? (
        <p className="rounded-sm border border-dashed border-rule px-4 py-6 text-center text-sm text-ink/70">
          No insurance recorded. Every insurance requirement will be unknown until your policies are added.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-sm border border-rule">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-rule text-left font-mono text-[11px] tracking-wide text-ink/60 uppercase">
                <th scope="col" className="px-4 py-2.5 font-medium">Cover</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Amount</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Insurer</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Expires</th>
                <th scope="col" className="px-4 py-2.5"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {rows.map((row) => (
                <tr key={row.id} className="align-top">
                  <td className="px-4 py-3">
                    <p className="text-ink">{INSURANCE_TYPE_LABEL[row.kind]}</p>
                    <UsageText usage={row.usage} />
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Money amount={row.coverAmount} currency={row.currency} className="font-mono text-[13px]" />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-ink/80">{row.insurer ?? "—"}</td>
                  <td className="px-4 py-3 text-[13px] whitespace-nowrap">
                    <ExpiryText date={row.expiresOn} now={now} nullLabel="No expiry recorded" />
                  </td>
                  <td className="px-4 py-3">
                    <RowActions>
                      <EntityDialog
                        title={`Edit ${INSURANCE_TYPE_LABEL[row.kind].toLowerCase()} cover`}
                        trigger={<Button variant="ghost" size="sm" aria-label={`Edit ${INSURANCE_TYPE_LABEL[row.kind]}`}>Edit</Button>}
                        action={saveInsuranceAction}
                        submitLabel="Save changes"
                        pendingLabel="Saving…"
                      >
                        {(state) => <InsuranceFields held={held} existing={row} errors={state.fieldErrors ?? {}} />}
                      </EntityDialog>
                      <RemoveForm action={deleteInsuranceAction} id={row.id} label={`Remove ${INSURANCE_TYPE_LABEL[row.kind]}`} />
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
