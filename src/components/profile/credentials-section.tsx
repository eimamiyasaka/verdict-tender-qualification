"use client";

import { Field } from "@/components/common/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EntityDialog, nativeSelectClass, RemoveForm, RowActions } from "@/components/profile/entity-dialog";
import { ExpiryText, GapList, ProfileSection, UsageText } from "@/components/profile/section";
import { deleteCredentialAction, saveCredentialAction } from "@/lib/actions/profile";
import { formatDate, toDateInputValue } from "@/lib/format";
import type { Credential, CredentialType, ProfileGap, UsageCount } from "@/lib/types";

type Row = Credential & { type: CredentialType; usage: UsageCount };

function CredentialFields({
  types,
  held,
  existing,
  presetCode,
  errors,
}: {
  types: CredentialType[];
  held: Set<string>;
  existing?: Row;
  presetCode?: string;
  errors: Record<string, string>;
}) {
  const options = types.filter((t) => !held.has(t.code) || t.code === existing?.code);
  return (
    <>
      {existing ? <input type="hidden" name="id" value={existing.id} /> : null}
      <Field label="Certification" htmlFor="cred-code" error={errors.code} hint="From the reference list. If yours isn't here, it isn't one tenders ask for by code.">
        <select name="code" defaultValue={existing?.code ?? presetCode ?? ""} className={nativeSelectClass} disabled={Boolean(existing)}>
          <option value="">Choose…</option>
          {options.map((t) => (
            <option key={t.code} value={t.code}>
              {t.label}
            </option>
          ))}
        </select>
      </Field>
      {existing ? <input type="hidden" name="code" value={existing.code} /> : null}
      <Field label="Certificate number" htmlFor="cred-reference" error={errors.reference} optional>
        <Input name="reference" defaultValue={existing?.reference ?? ""} className="font-mono" maxLength={60} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Issued on" htmlFor="cred-issued" error={errors.issuedOn} optional>
          <Input name="issuedOn" type="date" defaultValue={toDateInputValue(existing?.issuedOn)} className="font-mono" />
        </Field>
        <Field label="Expires on" htmlFor="cred-expires" error={errors.expiresOn} optional hint="Leave blank if it does not expire.">
          <Input name="expiresOn" type="date" defaultValue={toDateInputValue(existing?.expiresOn)} className="font-mono" />
        </Field>
      </div>
      <Field label="Evidence link" htmlFor="cred-url" error={errors.evidenceUrl} optional>
        <Input name="evidenceUrl" type="url" inputMode="url" defaultValue={existing?.evidenceUrl ?? ""} placeholder="https://" />
      </Field>
    </>
  );
}

export function CredentialsSection({
  rows,
  types,
  gaps,
  now,
}: {
  rows: Row[];
  types: CredentialType[];
  gaps: ProfileGap[];
  now: Date;
}) {
  const held = new Set(rows.map((r) => r.code));
  return (
    <ProfileSection
      id="credentials"
      title="Certifications"
      description="A missing certification is a fail, not an unknown: this list is treated as complete. Expiry is checked against each tender's submission deadline."
      count={rows.length}
      action={
        <EntityDialog
          title="Add certification"
          trigger={<Button variant="outline" size="sm">+ Add certification</Button>}
          action={saveCredentialAction}
          submitLabel="Save certification"
          pendingLabel="Saving…"
        >
          {(state) => <CredentialFields types={types} held={held} errors={state.fieldErrors ?? {}} />}
        </EntityDialog>
      }
    >
      <GapList
        gaps={gaps}
        noun="certification"
        onAddLabel="add it if you hold it"
        render={(gap) => (
          <EntityDialog
            title={`Add ${gap.label}`}
            trigger={
              <button type="button" className="rounded-sm font-mono text-[12px] text-ink/70 underline-offset-4 hover:text-ink hover:underline">
                [add]
              </button>
            }
            action={saveCredentialAction}
            submitLabel="Save certification"
            pendingLabel="Saving…"
          >
            {(state) => <CredentialFields types={types} held={held} presetCode={gap.key} errors={state.fieldErrors ?? {}} />}
          </EntityDialog>
        )}
      />
      {rows.length === 0 ? (
        <p className="rounded-sm border border-dashed border-rule px-4 py-6 text-center text-sm text-ink/70">
          No certifications recorded. Every certification requirement will fail until the ones you hold are added.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-sm border border-rule">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-rule text-left font-mono text-[11px] tracking-wide text-ink/60 uppercase">
                <th scope="col" className="px-4 py-2.5 font-medium">Certification</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Number</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Issued</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Expires</th>
                <th scope="col" className="px-4 py-2.5"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {rows.map((row) => (
                <tr key={row.id} className="align-top">
                  <td className="px-4 py-3">
                    <p className="text-ink">{row.type.label}</p>
                    <UsageText usage={row.usage} />
                  </td>
                  <td className="px-4 py-3 font-mono text-[13px] whitespace-nowrap text-ink/80">{row.reference ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-[13px] whitespace-nowrap text-ink/80">{row.issuedOn ? formatDate(row.issuedOn) : "—"}</td>
                  <td className="px-4 py-3 text-[13px] whitespace-nowrap">
                    <ExpiryText date={row.expiresOn} now={now} />
                  </td>
                  <td className="px-4 py-3">
                    <RowActions>
                      <EntityDialog
                        title={`Edit ${row.type.label}`}
                        trigger={<Button variant="ghost" size="sm" aria-label={`Edit ${row.type.label}`}>Edit</Button>}
                        action={saveCredentialAction}
                        submitLabel="Save changes"
                        pendingLabel="Saving…"
                      >
                        {(state) => <CredentialFields types={types} held={held} existing={row} errors={state.fieldErrors ?? {}} />}
                      </EntityDialog>
                      <RemoveForm action={deleteCredentialAction} id={row.id} label={`Remove ${row.type.label}`} />
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
