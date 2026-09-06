"use client";

import { useActionState } from "react";
import { ConfirmButton, FormMessage } from "@/components/common/form";
import { deleteDocumentAction } from "@/lib/actions/documents";
import { idleState } from "@/lib/actions/shared";

export function DeleteDocumentForm({
  tenderId,
  documentId,
  filename,
  requirementCount,
}: {
  tenderId: string;
  documentId: string;
  filename: string;
  requirementCount: number;
}) {
  const [state, action] = useActionState(deleteDocumentAction, idleState);
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="tenderId" value={tenderId} />
      <input type="hidden" name="documentId" value={documentId} />
      <ConfirmButton
        size="sm"
        variant="ghost"
        aria-label={`Remove ${filename}`}
        confirmLabel={requirementCount > 0 ? `Remove with ${requirementCount} requirements` : "Confirm remove"}
        pendingLabel="Removing…"
      >
        Remove
      </ConfirmButton>
      <FormMessage state={state} className="text-[12px]" />
    </form>
  );
}
