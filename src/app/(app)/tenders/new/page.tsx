import type { Metadata } from "next";
import { BackLink, PageHeader } from "@/components/common/layout";
import { NewTenderForm } from "@/components/tender/new-tender-form";
import { getOrgContext } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Add tender" };

export default async function NewTenderPage() {
  await getOrgContext();
  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <PageHeader
        eyebrow={<BackLink href="/">Pipeline</BackLink>}
        title="Add tender"
        description="Name the opportunity first. You'll upload the pack on the next screen, and Verdict fills in what it can read from the documents."
      />
      <NewTenderForm />
    </div>
  );
}
