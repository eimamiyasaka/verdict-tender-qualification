"use client";

import { useActionState } from "react";
import { ConfirmButton, FormMessage, SubmitButton } from "@/components/common/form";
import { setTenderStatusAction } from "@/lib/actions/tenders";
import { idleState } from "@/lib/actions/shared";
import type { BidRecommendation, TenderStatus } from "@/lib/types";

/**
 * The status transitions a bid manager actually makes: assessed → bidding
 * (opens the workspace), bidding → submitted, and abandon. Read-only once the
 * deadline has passed (§14).
 */
export function StatusControls({
  tenderId,
  status,
  closed,
  hasAssessment,
  recommendation,
}: {
  tenderId: string;
  status: TenderStatus;
  closed: boolean;
  hasAssessment: boolean;
  recommendation: BidRecommendation | null;
}) {
  const [state, action] = useActionState(setTenderStatusAction, idleState);
  if (closed && status !== "submitted") return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "assessed" && hasAssessment && !closed ? (
        <form action={action}>
          <input type="hidden" name="tenderId" value={tenderId} />
          <input type="hidden" name="status" value="bidding" />
          <SubmitButton size="sm" variant={recommendation === "bid" ? "default" : "outline"} pendingLabel="Marking as bid…">
            Mark as bid
          </SubmitButton>
        </form>
      ) : null}
      {status === "bidding" && !closed ? (
        <>
          <form action={action}>
            <input type="hidden" name="tenderId" value={tenderId} />
            <input type="hidden" name="status" value="submitted" />
            <SubmitButton size="sm" variant="outline" pendingLabel="Marking…">
              Mark as submitted
            </SubmitButton>
          </form>
          <form action={action}>
            <input type="hidden" name="tenderId" value={tenderId} />
            <input type="hidden" name="status" value="assessed" />
            <SubmitButton size="sm" variant="ghost" pendingLabel="Moving…">
              Back to assessed
            </SubmitButton>
          </form>
        </>
      ) : null}
      {status === "submitted" ? (
        <>
          <form action={action}>
            <input type="hidden" name="tenderId" value={tenderId} />
            <input type="hidden" name="status" value="won" />
            <SubmitButton size="sm" variant="outline" pendingLabel="Marking…">
              Won
            </SubmitButton>
          </form>
          <form action={action}>
            <input type="hidden" name="tenderId" value={tenderId} />
            <input type="hidden" name="status" value="lost" />
            <SubmitButton size="sm" variant="outline" pendingLabel="Marking…">
              Lost
            </SubmitButton>
          </form>
        </>
      ) : null}
      {(status === "assessed" || status === "extracted" || status === "bidding" || status === "draft") && !closed ? (
        <form action={action}>
          <input type="hidden" name="tenderId" value={tenderId} />
          <input type="hidden" name="status" value="abandoned" />
          <ConfirmButton size="sm" variant="ghost" confirmLabel="Confirm abandon" pendingLabel="Abandoning…">
            Abandon
          </ConfirmButton>
        </form>
      ) : null}
      <FormMessage state={state} className="basis-full text-[13px]" />
    </div>
  );
}
