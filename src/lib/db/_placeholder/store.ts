/**
 * PLACEHOLDER DATA STORE.
 *
 * An in-memory stand-in for Supabase Postgres while the server branch builds
 * the Prisma layer. Every exported function in `src/lib/db/*.ts` reads and
 * writes this store today; when Prisma lands, the bodies of those functions
 * change and nothing under `src/app` or `src/components` does.
 *
 * The store lives on `globalThis` so it survives Next.js hot reloads in dev.
 * It resets when the server process restarts. That is the intended behaviour
 * for a placeholder: every restart is the seeded demo again.
 */
import type {
  Assessment,
  AssessmentResult,
  BidTask,
  Credential,
  CredentialType,
  Event,
  FinancialYear,
  Insurance,
  KeyDate,
  LibraryAnswer,
  Membership,
  Organisation,
  PastProject,
  Policy,
  Requirement,
  RequirementCitation,
  Response,
  Tender,
  TenderDocument,
  User,
} from "@/lib/types";
import { buildSeed } from "./seed";

export interface Store {
  users: User[];
  organisations: Organisation[];
  memberships: Membership[];
  credentialTypes: CredentialType[];
  credentials: Credential[];
  financialYears: FinancialYear[];
  insurances: Insurance[];
  pastProjects: PastProject[];
  policies: Policy[];
  tenders: Tender[];
  documents: TenderDocument[];
  requirements: Requirement[];
  citations: RequirementCitation[];
  keyDates: KeyDate[];
  assessments: Assessment[];
  results: AssessmentResult[];
  tasks: BidTask[];
  responses: Response[];
  libraryAnswers: LibraryAnswer[];
  events: Event[];
  /** Monotonic counter standing in for the BigInt autoincrement on events. */
  nextEventId: number;
}

declare global {
  var __verdictPlaceholderStore: Store | undefined;
}

export function getStore(): Store {
  if (!globalThis.__verdictPlaceholderStore) {
    globalThis.__verdictPlaceholderStore = buildSeed();
  }
  return globalThis.__verdictPlaceholderStore;
}

/** Discard all runtime changes and return to the seeded demo. Used by the demo reset control. */
export function resetStore(): void {
  globalThis.__verdictPlaceholderStore = buildSeed();
}

export function newId(): string {
  return crypto.randomUUID();
}

/** Simulates a few milliseconds of database latency so loading states are visible in dev. */
export async function simulateLatency(ms = 0): Promise<void> {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Append exactly one event alongside the state change it describes (§7.7).
 * In the Prisma implementation this happens inside the same transaction.
 */
export function appendEvent(
  store: Store,
  event: Omit<Event, "id" | "createdAt"> & { createdAt?: Date },
): Event {
  const row: Event = {
    ...event,
    id: String(store.nextEventId++),
    createdAt: event.createdAt ?? new Date(),
  };
  store.events.push(row);
  return row;
}

/** Deep-ish clone so callers never hold references into the store. */
export function clone<T>(value: T): T {
  return structuredClone(value);
}
