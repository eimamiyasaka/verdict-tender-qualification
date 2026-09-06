"use server";

import { redirect } from "next/navigation";
import { signInDemo, signInWithPassword } from "@/lib/auth/sign-in";
import { signOut } from "@/lib/auth/sign-out";
import { fail, type ActionState, str } from "./shared";

function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
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
  redirect(safeNext(str(formData, "next") || null));
}

export async function viewDemoAction(formData: FormData): Promise<void> {
  const result = await signInDemo();
  if (!result.ok) redirect("/login?error=demo");
  redirect(safeNext(str(formData, "next") || null));
}

export async function signOutAction(): Promise<void> {
  await signOut();
  redirect("/login");
}
