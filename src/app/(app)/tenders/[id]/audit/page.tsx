import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EventList } from "@/components/audit/event-list";
import { BackLink, PageHeader } from "@/components/common/layout";
import { getOrgContext } from "@/lib/auth/session";
import { listTenderEvents } from "@/lib/db/events";
import { getTenderDetail } from "@/lib/db/tenders";
import { pluralise } from "@/lib/format";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const { orgId } = await getOrgContext();
  const detail = await getTenderDetail(orgId, id);
  return { title: detail ? `Activity · ${detail.tender.title}` : "Activity" };
}

/** Append-only activity log for one tender (§10.5). */
export default async function AuditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { orgId } = await getOrgContext();
  const detail = await getTenderDetail(orgId, id);
  if (!detail) notFound();
  const events = await listTenderEvents(orgId, id);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={<BackLink href={`/tenders/${id}`}>{detail.tender.title}</BackLink>}
        title="Activity"
        description={`${pluralise(events.length, "event")}, newest first. Every upload, extraction, assessment version and override on this tender. Nothing here is edited or deleted.`}
      />
      <EventList events={events} />
    </div>
  );
}
