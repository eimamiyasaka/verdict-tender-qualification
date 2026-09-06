import type { Metadata } from "next";
import { PageHeader } from "@/components/common/layout";
import { AnswerDialog } from "@/components/library/answer-dialog";
import { LibraryTable } from "@/components/library/library-table";
import { Button } from "@/components/ui/button";
import { getOrgContext } from "@/lib/auth/session";
import { listLibraryAnswers } from "@/lib/db/library";
import { listTenderSummaries } from "@/lib/db/tenders";

export const metadata: Metadata = { title: "Answer library" };

/** Answer library (§10.4). Keyword and tag retrieval only — no embeddings, on purpose (§4). */
export default async function LibraryPage() {
  const { orgId } = await getOrgContext();
  const [answers, tenders] = await Promise.all([listLibraryAnswers(orgId), listTenderSummaries(orgId)]);
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Answer library"
        description="Past answers, tagged. The workspace suggests the three that best match each ITT question by keyword and tag, ranked by how often they've been reused."
        actions={<AnswerDialog trigger={<Button>+ Add answer</Button>} tenders={tenders} />}
      />
      <LibraryTable answers={answers} tenders={tenders} />
    </div>
  );
}
