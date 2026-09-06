"use client";

import * as React from "react";
import { useActionState } from "react";
import { ConfirmButton, FormMessage, SubmitButton } from "@/components/common/form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { idleState, type ActionState } from "@/lib/actions/shared";

type FormAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * A quiet modal form for one profile row. The form (and its action state)
 * mounts only while the dialog is open, so every opening starts clean, and
 * it closes itself on success.
 */
export function EntityDialog({
  title,
  description,
  trigger,
  action,
  submitLabel,
  pendingLabel,
  wide = false,
  children,
}: {
  title: string;
  description?: string;
  trigger: React.ReactElement;
  action: FormAction;
  submitLabel: string;
  pendingLabel: string;
  wide?: boolean;
  children: (state: ActionState) => React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className={wide ? "max-w-2xl" : undefined}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <EntityForm action={action} submitLabel={submitLabel} pendingLabel={pendingLabel} onDone={() => setOpen(false)}>
          {children}
        </EntityForm>
      </DialogContent>
    </Dialog>
  );
}

function EntityForm({
  action,
  submitLabel,
  pendingLabel,
  onDone,
  children,
}: {
  action: FormAction;
  submitLabel: string;
  pendingLabel: string;
  onDone: () => void;
  children: (state: ActionState) => React.ReactNode;
}) {
  const [state, formAction] = useActionState(action, idleState);
  const lastToken = React.useRef<number | undefined>(undefined);
  React.useEffect(() => {
    if (state.status === "success" && state.successToken !== lastToken.current) {
      lastToken.current = state.successToken;
      onDone();
    }
  }, [state, onDone]);

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <div className="flex flex-col gap-4">{children(state)}</div>
      <FormMessage state={state} />
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <SubmitButton pendingLabel={pendingLabel}>{submitLabel}</SubmitButton>
      </DialogFooter>
    </form>
  );
}

/** Two-click remove, no modal. */
export function RemoveForm({
  action,
  id,
  label,
  confirmLabel = "Confirm remove",
}: {
  action: FormAction;
  id: string;
  label: string;
  confirmLabel?: string;
}) {
  const [state, formAction] = useActionState(action, idleState);
  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="id" value={id} />
      <ConfirmButton size="sm" variant="ghost" aria-label={label} confirmLabel={confirmLabel} pendingLabel="Removing…">
        Remove
      </ConfirmButton>
      <FormMessage state={state} className="text-[12px]" />
    </form>
  );
}

/** Row action cluster: Edit (dialog) + Remove. */
export function RowActions({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-end gap-1">{children}</div>;
}

export const nativeSelectClass =
  "h-9 w-full rounded-sm border border-rule bg-paper px-2.5 text-sm text-ink hover:border-ink/60 focus:border-ink aria-invalid:border-flag disabled:opacity-50";
