"use client";

import * as React from "react";
import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/common/form";
import { Input } from "@/components/ui/input";
import { signInAction, viewDemoAction } from "@/lib/actions/auth";
import { idleState } from "@/lib/actions/shared";

export function LoginForm({ next, demoFailed }: { next: string | null; demoFailed: boolean }) {
  const [state, action] = useActionState(signInAction, idleState);

  return (
    <div className="flex flex-col gap-6">
      <form action={action} className="flex flex-col gap-4" noValidate>
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <Field label="Email" htmlFor="email" error={state.fieldErrors?.email}>
          <Input name="email" type="email" autoComplete="username" inputMode="email" placeholder="you@company.co.uk" />
        </Field>
        <Field label="Password" htmlFor="password" error={state.fieldErrors?.password}>
          <Input name="password" type="password" autoComplete="current-password" />
        </Field>
        <FormMessage state={state} />
        <SubmitButton pendingLabel="Signing in…" variant="outline" size="lg" className="w-full">
          Sign in
        </SubmitButton>
      </form>

      <div className="relative flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-rule" />
        <span className="font-mono text-[11px] tracking-wide text-ink/50 uppercase">or</span>
        <span className="h-px flex-1 bg-rule" />
      </div>

      <form action={viewDemoAction} className="flex flex-col gap-3">
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <SubmitButton pendingLabel="Opening the demo…" size="lg" className="w-full">
          View demo
        </SubmitButton>
        <p className="text-center text-[13px] text-ink/60">
          Opens Meridian Facilities Ltd: three assessed tenders, a filled-in profile and a small answer library. No account
          needed.
        </p>
        {demoFailed ? (
          <p role="alert" className="text-center text-[13px] text-flag">
            The demo account isn&apos;t configured. Set DEMO_EMAIL and DEMO_PASSWORD and try again.
          </p>
        ) : null}
      </form>
    </div>
  );
}
