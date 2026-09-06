import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AssessmentTab } from "@/components/tender/assessment-tab";
import { CitationProvider } from "@/components/tender/citation-drawer";
import { DocumentsTab } from "@/components/tender/documents-tab";
import { RequirementsTab } from "@/components/tender/requirements-tab";
import { parseTab, TenderHeader } from "@/components/tender/tender-header";
import { WorkspaceTab } from "@/components/tender/workspace-tab";
import { getOrgContext } from "@/lib/auth/session";
import { getTenderDetail } from "@/lib/db/tenders";
import { listOrgMembers } from "@/lib/db/users";
import { listWorkspaceTasks } from "@/lib/db/workspace";
import { describeDeadline } from "@/lib/format";
import type { AssessmentResult } from "@/lib/types";

type Params = Promise<{ id: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const { orgId } = await getOrgContext();
  const detail = await getTenderDetail(orgId, id);
  return { title: detail?.tender.title ?? "Tender" };
}

/**
 * Tender detail (§10.2): four tabs via ?tab=, Assessment by default. Every
 * tab shares one CitationProvider so any [view] control opens the drawer.
 */
export default async function TenderPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  const { orgId } = await getOrgContext();
  const detail = await getTenderDetail(orgId, id);
  if (!detail) notFound();

  const tab = parseTab(typeof search.tab === "string" ? search.tab : undefined);
  const now = new Date();
  const closed = describeDeadline(detail.submissionDeadline, now)?.closed ?? false;

  const results: Record<string, AssessmentResult> = {};
  for (const r of detail.latestAssessment?.results ?? []) results[r.requirementId] = r;

  const [tasks, members] =
    tab === "workspace" && detail.tender.status === "bidding"
      ? await Promise.all([listWorkspaceTasks(orgId, id), listOrgMembers(orgId)])
      : [[], []];

  return (
    <CitationProvider>
      <div className="flex flex-col gap-8">
        <TenderHeader detail={detail} tab={tab} now={now} />
        <section aria-live="polite">
          {tab === "assessment" ? <AssessmentTab detail={detail} closed={closed} /> : null}
          {tab === "requirements" ? (
            <RequirementsTab requirements={detail.requirements} results={results} assessed={Boolean(detail.latestAssessment)} />
          ) : null}
          {tab === "workspace" ? (
            <WorkspaceTab detail={detail} tasks={tasks} members={members} closed={closed} now={now} />
          ) : null}
          {tab === "documents" ? <DocumentsTab detail={detail} closed={closed} /> : null}
        </section>
      </div>
    </CitationProvider>
  );
}
