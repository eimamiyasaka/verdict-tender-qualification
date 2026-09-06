"use client";

import { CurrencySelectNative, Field } from "@/components/common/form";
import { Chip, Money } from "@/components/common/typography";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EntityDialog, nativeSelectClass, RemoveForm, RowActions } from "@/components/profile/entity-dialog";
import { ProfileSection, UsageText } from "@/components/profile/section";
import { deletePastProjectAction, savePastProjectAction } from "@/lib/actions/profile";
import { formatDate, toDateInputValue } from "@/lib/format";
import { SECTOR_LABEL, sectorLabel } from "@/lib/labels";
import type { PastProject, UsageCount } from "@/lib/types";

type Row = PastProject & { usage: UsageCount };

function ProjectFields({ existing, errors }: { existing?: Row; errors: Record<string, string> }) {
  return (
    <>
      {existing ? <input type="hidden" name="id" value={existing.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Client" htmlFor="proj-client" error={errors.clientName}>
          <Input name="clientName" defaultValue={existing?.clientName ?? ""} maxLength={120} />
        </Field>
        <Field label="Contract" htmlFor="proj-title" error={errors.title}>
          <Input name="title" defaultValue={existing?.title ?? ""} maxLength={160} placeholder="Cleaning services, three campuses" />
        </Field>
      </div>
      <Field label="Description" htmlFor="proj-desc" error={errors.description} optional>
        <Textarea name="description" defaultValue={existing?.description ?? ""} className="min-h-20" maxLength={1000} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-[1fr_6rem_1fr]">
        <Field label="Contract value" htmlFor="proj-value" error={errors.contractValue} optional hint="Total value.">
          <Input name="contractValue" inputMode="numeric" defaultValue={existing?.contractValue ?? ""} />
        </Field>
        <Field label="Currency" htmlFor="proj-currency" error={errors.currency}>
          <CurrencySelectNative id="proj-currency" defaultValue={existing?.currency ?? "GBP"} className="w-full" />
        </Field>
        <Field label="Sector" htmlFor="proj-sector" error={errors.sector} optional>
          <select name="sector" defaultValue={existing?.sector ?? ""} className={nativeSelectClass}>
            <option value="">—</option>
            {Object.entries(SECTOR_LABEL).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Started" htmlFor="proj-start" error={errors.startedOn} optional>
          <Input name="startedOn" type="date" defaultValue={toDateInputValue(existing?.startedOn)} className="font-mono" />
        </Field>
        <Field label="Ended" htmlFor="proj-end" error={errors.endedOn} optional hint="Leave blank if ongoing.">
          <Input name="endedOn" type="date" defaultValue={toDateInputValue(existing?.endedOn)} className="font-mono" />
        </Field>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" name="isPublicSector" defaultChecked={existing?.isPublicSector ?? false} className="size-4 accent-ink" />
          Public-sector client
        </label>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" name="refereeContactable" defaultChecked={existing?.refereeContactable ?? false} className="size-4 accent-ink" />
          Referee can be contacted
        </label>
      </div>
    </>
  );
}

export function ProjectsSection({ rows }: { rows: Row[] }) {
  return (
    <ProfileSection
      id="past-projects"
      title="Past projects"
      description="Experience requirements count these by value, recency, sector and public-sector status. Each result lists which projects counted and which fell short."
      count={rows.length}
      action={
        <EntityDialog
          title="Add project"
          trigger={<Button variant="outline" size="sm">+ Add project</Button>}
          action={savePastProjectAction}
          submitLabel="Save project"
          pendingLabel="Saving…"
          wide
        >
          {(state) => <ProjectFields errors={state.fieldErrors ?? {}} />}
        </EntityDialog>
      }
    >
      {rows.length === 0 ? (
        <p className="rounded-sm border border-dashed border-rule px-4 py-6 text-center text-sm text-ink/70">
          No projects recorded. Every experience requirement will fail until your contract history is added.
        </p>
      ) : (
        <ul className="divide-y divide-rule rounded-sm border border-rule">
          {rows.map((row) => (
            <li key={row.id} className="grid gap-x-6 gap-y-2 px-4 py-3.5 sm:grid-cols-[1fr_auto] sm:items-start">
              <div className="min-w-0">
                <p className="text-sm text-ink">
                  <span className="font-medium">{row.clientName}</span>
                  <span className="text-ink/60"> — </span>
                  {row.title}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink/70">
                  <Money amount={row.contractValue} currency={row.currency} abbrev className="font-mono" />
                  <span>{sectorLabel(row.sector)}</span>
                  <span className="font-mono text-[12px]">
                    {row.startedOn ? formatDate(row.startedOn) : "—"} → {row.endedOn ? formatDate(row.endedOn) : "ongoing"}
                  </span>
                  {row.isPublicSector ? <Chip>public sector</Chip> : null}
                  {row.refereeContactable ? <Chip>referee</Chip> : null}
                </p>
                <UsageText usage={row.usage} className="mt-1 block" />
              </div>
              <RowActions>
                <EntityDialog
                  title={`Edit ${row.clientName}`}
                  trigger={<Button variant="ghost" size="sm" aria-label={`Edit ${row.clientName} — ${row.title}`}>Edit</Button>}
                  action={savePastProjectAction}
                  submitLabel="Save changes"
                  pendingLabel="Saving…"
                  wide
                >
                  {(state) => <ProjectFields existing={row} errors={state.fieldErrors ?? {}} />}
                </EntityDialog>
                <RemoveForm action={deletePastProjectAction} id={row.id} label={`Remove ${row.clientName} — ${row.title}`} />
              </RowActions>
            </li>
          ))}
        </ul>
      )}
    </ProfileSection>
  );
}
