"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getOrgContext } from "@/lib/auth/session";
import { resetStore } from "@/lib/db/_placeholder/store";

/**
 * Placeholder-only: throw away runtime changes and return to the seeded demo.
 * Removed when the real database lands (a seed script does this job then).
 */
export async function resetDemoAction(): Promise<void> {
  await getOrgContext();
  resetStore();
  revalidatePath("/", "layout");
  redirect("/");
}
