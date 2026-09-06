"use client";

import * as React from "react";
import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/common/form";
import { runAssessmentAction } from "@/lib/actions/assessments";
import { idleState, type ActionState } from "@/lib/actions/shared";
import { cn } from "@/lib/utils";

/**
 * Run / Re-run assessment. The verb stays through the flow: "Re-run" →
 * "Running assessment…" → "Assessment complete — version n" (§11).
 *
 * One action state is shared by every Run/Re-run control on the tab so the
 * confirmation survives the re-render that removes the "profile changed"
 * banner the user may have clicked from. `RerunMessage` renders it wherever
 * the layout persists — the verdict block.
 */

interface RerunContextValue {
  tenderId: string;
  state: ActionState;
  action: (formData: FormData) => void;
}

const RerunContext = React.createContext<RerunContextValue | null>(null);

export function RerunProvider({ tenderId, children }: { tenderId: string; children: React.ReactNode }) {
  const [state, action] = useActionState(runAssessmentAction, idleState);
  const value = React.useMemo(() => ({ tenderId, state, action }), [tenderId, state, action]);
  return <RerunContext.Provider value={value}>{children}</RerunContext.Provider>;
}

function useRerun(): RerunContextValue {
  const ctx = React.useContext(RerunContext);
  if (!ctx) throw new Error("RerunButton must be used inside RerunProvider");
  return ctx;
}

export function RerunButton({
  label,
  onInk = false,
  size = "sm",
  disabled = false,
  className,
}: {
  label: string;
  onInk?: boolean;
  size?: "sm" | "default";
  disabled?: boolean;
  className?: string;
}) {
  const { tenderId, action } = useRerun();
  return (
    <form action={action} className={cn("inline-flex", className)}>
      <input type="hidden" name="tenderId" value={tenderId} />
      <SubmitButton
        size={size}
        disabled={disabled}
        pendingLabel="Running assessment…"
        variant={onInk ? "outline" : "default"}
        className={onInk ? "border-paper/40 bg-transparent text-paper hover:border-paper hover:bg-paper/10" : undefined}
      >
        {label}
      </SubmitButton>
    </form>
  );
}

export function RerunMessage({ onInk = false, className }: { onInk?: boolean; className?: string }) {
  const { state } = useRerun();
  return (
    <FormMessage
      state={state}
      className={cn("text-[13px]", onInk && state.status === "success" && "text-paper/80", className)}
    />
  );
}
