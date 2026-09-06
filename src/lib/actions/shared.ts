import type { ZodError } from "zod";
import { fromDateInputValue } from "@/lib/format";

/**
 * Shape returned by every form-bound Server Action, consumed with
 * `useActionState`. Messages are written in the interface's voice: what
 * happened and what to do (§11 copy rules).
 */
export interface ActionState {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
  /** Bumps on every success so forms can reset or close on change. */
  successToken?: number;
}

export const idleState: ActionState = { status: "idle" };

export function ok(message?: string): ActionState {
  return { status: "success", message, successToken: Date.now() };
}

export function fail(message: string, fieldErrors?: Record<string, string>): ActionState {
  return { status: "error", message, fieldErrors };
}

export function fieldErrorsFrom(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function str(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function optStr(formData: FormData, key: string): string | null {
  const value = str(formData, key);
  return value === "" ? null : value;
}

/** Accepts "4,120,000" or "4120000". Returns null for blank, NaN for garbage. */
export function optNum(formData: FormData, key: string): number | null {
  const raw = str(formData, key).replace(/[£$€,\s]/g, "");
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : Number.NaN;
}

export function optDate(formData: FormData, key: string): Date | null {
  return fromDateInputValue(str(formData, key));
}

export function bool(formData: FormData, key: string): boolean {
  const value = formData.get(key);
  return value === "on" || value === "true" || value === "1";
}
