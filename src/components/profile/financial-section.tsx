"use client";

import { CurrencySelectNative, Field } from "@/components/common/form";
import { Money } from "@/components/common/typography";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EntityDialog, RemoveForm, RowActions } from "@/components/profile/entity-dialog";
import { ProfileSection, UsageText } from "@/components/profile/section";
import { deleteFinancialYearAction, saveFinancialYearAction } from "@/lib/actions/profile";
import { fiscalYearLabel, formatDate, toDateInputValue } from "@/lib/format";
import type { FinancialYear, UsageCount } from "@/lib/types";

type Row = FinancialYear & { usage: UsageCount };

function FinancialFields({ existing, errors }: { existing?: Row; errors: Record<string, string> }) {
  return (
    <>
      {existing ? <input type="hidden" name="id" value={existing.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-[1fr_6rem]">
        <Field label="Year ending" htmlFor="fy-end" error={errors.yearEnding}>
          <Input name="yearEnding" type="date" defaultValue={toDateInputValue(existing?.yearEnding)} className="font-mono" />
        </Field>
        <Field label="Currency" htmlFor="fy-currency" error={errors.currency}>
          <CurrencySelectNative id="fy-currency" defaultValue={existing?.currency ?? "GBP"} className="w-full" />
        </Field>
      </div>
      <Field label="Turnover" htmlFor="fy-turnover" error={errors.turnover} optional hint="Leave a figure blank if it isn't filed yet. Blank produces an unknown, never a fail.">
        <Input name="turnover" inputMode="numeric" defaultValue={existing?.turnover ?? ""} placeholder="4120000" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Net assets" htmlFor="fy-net" error={errors.netAssets} optional>
          <Input name="netAssets" inputMode="numeric" defaultValue={existing?.netAssets ?? ""} />
        </Field>
        <Field label="Profit before tax" htmlFor="fy-pbt" error={errors.profitBeforeTax} optional>
          <Input name="profitBeforeTax" inputMode="numeric" defaultValue={existing?.profitBeforeTax ?? ""} />
        </Field>
      </div>
    </>
  );
}

function Figure({ value, currency }: { value: number | null; currency: string }) {
  if (value === null) return <span className="text-pending">Not entered</span>;
  return <Money amount={value} currency={currency} className="font-mono text-[13px]" />;
}

export function FinancialSection({ rows }: { rows: Row[] }) {
  return (
    <ProfileSection
      id="financial-years"
      title="Financial years"
      description="Turnover, net assets and profit before tax as filed. A year that is missing, or a figure left blank, produces an unknown rather than a fail — Verdict cannot see what was never entered."
      count={rows.length}
      action={
        <EntityDialog
          title="Add financial year"
          trigger={<Button variant="outline" size="sm">+ Add year</Button>}
          action={saveFinancialYearAction}
          submitLabel="Save year"
          pendingLabel="Saving…"
        >
          {(state) => <FinancialFields errors={state.fieldErrors ?? {}} />}
        </EntityDialog>
      }
    >
      {rows.length === 0 ? (
        <p className="rounded-sm border border-dashed border-rule px-4 py-6 text-center text-sm text-ink/70">
          No financial years recorded. Every financial requirement will be unknown until at least one is added.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-sm border border-rule">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-rule text-left font-mono text-[11px] tracking-wide text-ink/60 uppercase">
                <th scope="col" className="px-4 py-2.5 font-medium">Year</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Turnover</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Net assets</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Profit before tax</th>
                <th scope="col" className="px-4 py-2.5"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {rows.map((row) => (
                <tr key={row.id} className="align-top">
                  <td className="px-4 py-3">
                    <p className="text-ink">
                      {fiscalYearLabel(row.yearEnding)} <span className="font-mono text-[12px] text-ink/60">to {formatDate(row.yearEnding)}</span>
                    </p>
                    <UsageText usage={row.usage} />
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap"><Figure value={row.turnover} currency={row.currency} /></td>
                  <td className="px-4 py-3 text-right whitespace-nowrap"><Figure value={row.netAssets} currency={row.currency} /></td>
                  <td className="px-4 py-3 text-right whitespace-nowrap"><Figure value={row.profitBeforeTax} currency={row.currency} /></td>
                  <td className="px-4 py-3">
                    <RowActions>
                      <EntityDialog
                        title={`Edit ${fiscalYearLabel(row.yearEnding)}`}
                        trigger={<Button variant="ghost" size="sm" aria-label={`Edit ${fiscalYearLabel(row.yearEnding)}`}>Edit</Button>}
                        action={saveFinancialYearAction}
                        submitLabel="Save changes"
                        pendingLabel="Saving…"
                      >
                        {(state) => <FinancialFields existing={row} errors={state.fieldErrors ?? {}} />}
                      </EntityDialog>
                      <RemoveForm action={deleteFinancialYearAction} id={row.id} label={`Remove ${fiscalYearLabel(row.yearEnding)}`} />
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
