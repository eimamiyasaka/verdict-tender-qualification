/**
 * Tenancy (§6.3): a second organisation must see nothing belonging to the
 * first through any exported read function. The server branch's version of
 * this test runs against Prisma; the function names and shapes are the same.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { DEMO_ORG_ID } from "../_placeholder/seed";
import { getStore, resetStore } from "../_placeholder/store";
import { listTenderEvents } from "../events";
import { listLibraryAnswers, suggestLibraryAnswers } from "../library";
import { getProfile } from "../profile";
import { getSubmissionDeadline, getTenderDetail, listPipeline, listTenderSummaries } from "../tenders";
import { getMembershipForUser, listOrgMembers } from "../users";
import { listWorkspaceTasks } from "../workspace";

const OTHER_ORG = "org-other";
const OTHER_USER = "user-other";

beforeEach(() => {
  resetStore();
  const store = getStore();
  store.organisations.push({
    id: OTHER_ORG,
    name: "Other Contractors Ltd",
    companiesHouseNumber: null,
    headcount: 12,
    registeredRegion: "Wales",
    sicCodes: [],
    createdAt: new Date(),
  });
  store.users.push({ id: OTHER_USER, email: "someone@other.example", displayName: "Someone Else", createdAt: new Date() });
  store.memberships.push({ id: "mem-other", orgId: OTHER_ORG, userId: OTHER_USER, role: "owner", createdAt: new Date() });
});

describe("a second organisation sees nothing of the first", () => {
  it("pipeline and tender reads", async () => {
    expect(await listPipeline(OTHER_ORG)).toEqual([]);
    expect(await listTenderSummaries(OTHER_ORG)).toEqual([]);
    expect(await getTenderDetail(OTHER_ORG, "tender-nhs")).toBeNull();
    expect(await getSubmissionDeadline(OTHER_ORG, "tender-nhs")).toBeNull();
  });

  it("profile, library, workspace and events", async () => {
    const profile = await getProfile(OTHER_ORG);
    expect(profile!.credentials).toEqual([]);
    expect(profile!.financialYears).toEqual([]);
    expect(profile!.insurances).toEqual([]);
    expect(profile!.pastProjects).toEqual([]);
    expect(profile!.policies).toEqual([]);
    expect(profile!.gaps).toEqual({ credentials: [], insurances: [], policies: [] });
    expect(await listLibraryAnswers(OTHER_ORG)).toEqual([]);
    expect(await suggestLibraryAnswers(OTHER_ORG, "social value apprenticeships")).toEqual([]);
    expect(await listWorkspaceTasks(OTHER_ORG, "tender-leeds")).toEqual([]);
    expect(await listTenderEvents(OTHER_ORG, "tender-nhs")).toEqual([]);
  });

  it("membership resolves to exactly one organisation", async () => {
    const membership = await getMembershipForUser(OTHER_USER);
    expect(membership?.organisation.id).toBe(OTHER_ORG);
    expect((await listOrgMembers(OTHER_ORG)).map((m) => m.id)).toEqual([OTHER_USER]);
    expect((await listOrgMembers(DEMO_ORG_ID)).map((m) => m.id)).not.toContain(OTHER_USER);
  });
});
