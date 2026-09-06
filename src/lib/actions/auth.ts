"use server";

import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/auth/next-path";
import { signInDemo, signInWithPassword } from "@/lib/auth/sign-in";
import { signOut } from "@/lib/auth/sign-out";
import { fail, type ActionState, str } from "./shared";

/**
 * Both sign-in paths run on the server. The demo one has to: `DEMO_EMAIL` and
 * `DEMO_PASSWORD` are server-side env and must never reach the client bundle
 * (§12.2).
 *
 * Success goes to /auth/callback rather than straight to `next`, because that
 * route is the single place the users mirror row is created (§7.3).
 */
function callbackUrl(formData: FormData): string {
  const next = safeNextPath(str(formData, "next") || null);
  return `/auth/callback?next=${encodeURIComponent(next)}`;
}

export async function signInAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = str(formData, "email");
  const password = str(formData, "password");
  const fieldErrors: Record<string, string> = {};
  if (!email) fieldErrors.email = "Enter your email address.";
  if (!password) fieldErrors.password = "Enter your password.";
  if (Object.keys(fieldErrors).length) return fail("Fill in both fields to sign in.", fieldErrors);

  const result = await signInWithPassword(email, password);
  if (!result.ok) return fail(result.error);
  redirect(callbackUrl(formData));
}

export async function viewDemoAction(formData: FormData): Promise<void> {
  const result = await signInDemo();
  if (!result.ok) redirect("/login?error=demo");
  redirect(callbackUrl(formData));
}

export async function signOutAction(): Promise<void> {
  await signOut();
  redirect("/login");
}
