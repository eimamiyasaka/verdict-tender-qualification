"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { ActionState } from "@/lib/actions/shared";
import { cn } from "@/lib/utils";

/**
 * Label + control + hint + error, wired with aria-describedby so screen
 * readers hear the error next to the field, and the control is marked
 * invalid so the --flag border appears.
 */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  optional,
  children,
  className,
}: {
  label: React.ReactNode;
  htmlFor: string;
  hint?: React.ReactNode;
  error?: string;
  optional?: boolean;
  children: React.ReactElement<{ id?: string; "aria-describedby"?: string; "aria-invalid"?: boolean }>;
  className?: string;
}) {
  const hintId = hint ? `${htmlFor}-hint` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;
  const control = React.cloneElement(children, {
    id: htmlFor,
    "aria-describedby": describedBy,
    "aria-invalid": error ? true : undefined,
  });
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {optional ? <span className="font-normal text-ink/50">optional</span> : null}
      </Label>
      {control}
      {error ? (
        <p id={errorId} className="text-[13px] text-flag">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-[13px] text-ink/60">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Error or success line under a form. Errors say what happened and what to do (§12.7). */
export function FormMessage({ state, className }: { state: ActionState; className?: string }) {
  if (state.status === "idle" || !state.message) return null;
  const isError = state.status === "error";
  return (
    <p
      role={isError ? "alert" : "status"}
      className={cn("text-sm", isError ? "text-flag" : "text-ink/80", className)}
    >
      {state.message}
    </p>
  );
}

/** Buttons keep their verb through the flow: "Run assessment" → "Running assessment…" (§11). */
export function SubmitButton({
  children,
  pendingLabel,
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof Button> & { pendingLabel?: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending} className={className} variant={variant} size={size} {...props}>
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}

/**
 * Two-step destructive control: first click arms it, second confirms. No
 * modal, no browser confirm(), and it disarms itself after a few seconds.
 */
export function ConfirmButton({
  children,
  confirmLabel = "Confirm",
  pendingLabel,
  ...props
}: React.ComponentProps<typeof Button> & { confirmLabel?: React.ReactNode; pendingLabel?: React.ReactNode }) {
  const [armed, setArmed] = React.useState(false);
  const { pending } = useFormStatus();
  React.useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  if (!armed) {
    return (
      <Button
        type="button"
        {...props}
        onClick={(e) => {
          e.preventDefault();
          setArmed(true);
        }}
      >
        {children}
      </Button>
    );
  }
  const label = props["aria-label"];
  return (
    <Button
      type="submit"
      variant="flag"
      disabled={pending}
      aria-busy={pending}
      {...props}
      aria-label={label ? `Confirm: ${label}` : undefined}
    >
      {pending && pendingLabel ? pendingLabel : confirmLabel}
    </Button>
  );
}

/** Currency + amount pair used across the profile forms. */
export function CurrencySelectNative({
  id,
  name = "currency",
  defaultValue = "GBP",
  className,
}: {
  id: string;
  name?: string;
  defaultValue?: string;
  className?: string;
}) {
  return (
    <select
      id={id}
      name={name}
      defaultValue={defaultValue}
      className={cn(
        "h-9 rounded-sm border border-rule bg-paper px-2 font-mono text-sm text-ink hover:border-ink/60 focus:border-ink",
        className,
      )}
    >
      <option value="GBP">GBP</option>
      <option value="EUR">EUR</option>
      <option value="USD">USD</option>
    </select>
  );
}
