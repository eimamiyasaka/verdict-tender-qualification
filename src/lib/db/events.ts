/**
 * Append-only audit log (§7.7, §10.5). Nothing updates or deletes here.
 *
 * Prisma seam: `prisma.event.findMany({ where: { orgId, OR: [...] }, orderBy: { createdAt: "desc" } })`.
 */
import type { EventWithActor } from "@/lib/types";
import { clone, getStore } from "./_placeholder/store";

export async function listTenderEvents(orgId: string, tenderId: string): Promise<EventWithActor[]> {
  const store = getStore();
  return store.events
    .filter((e) => e.orgId === orgId && (e.subjectId === tenderId || e.payload.tenderId === tenderId))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || Number(b.id) - Number(a.id))
    .map((e) => ({
      ...clone(e),
      actor: e.actorId ? clone(store.users.find((u) => u.id === e.actorId) ?? null) : null,
    }));
}
