/**
 * The one PrismaClient, and the two type seams that cross this boundary.
 *
 * Spec §6.3: every Prisma call in the codebase lives inside `src/lib/db/`.
 * Nothing under `src/app`, `src/components` or `src/lib/actions` may import
 * `@prisma/client` — this file is the only place it is constructed.
 *
 * The seams, each converted in exactly one place per direction:
 *
 *   - **Money.** The schema stores `Decimal(14,2)` (§7.1); `contracts.ts` uses
 *     `number` in major units. `toNumber` reads, `toDecimal` writes, and both
 *     round through `toMinorUnits` from contracts so there is one rounding rule
 *     in the codebase. A `Decimal` must never reach a Client Component.
 *   - **`Event.id`.** BigInt in Postgres, and `JSON.stringify` throws on a
 *     BigInt. `eventId` is the only way an event id leaves this layer.
 */

import { Prisma, PrismaClient } from "@prisma/client";
import { toMinorUnits } from "../../../contracts";

const globalForPrisma = globalThis as unknown as { verdictPrisma?: PrismaClient };

/**
 * One instance per process. The dev global guard stops Next's hot reload from
 * opening a new pool on every edit until the database refuses connections.
 */
export const prisma: PrismaClient =
  globalForPrisma.verdictPrisma ??
  new PrismaClient({
    log: process.env.PRISMA_LOG === "1" ? ["query", "warn", "error"] : ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.verdictPrisma = prisma;

/**
 * The client inside `prisma.$transaction(async (tx) => ...)`. Every write helper
 * takes one of these so a caller can compose several writes and one Event into a
 * single transaction (§7.7).
 */
export type Tx = Prisma.TransactionClient;

/** Either the client or a transaction — for reads that work in both. */
export type Db = PrismaClient | Tx;

/* ---------------------------------------------------------------------------
 * The Decimal seam. One conversion per direction, unit-tested in
 * `__tests__/decimal.test.ts`.
 * ------------------------------------------------------------------------- */

/** `Decimal` → major units. Null in, null out — a null metric is not a zero (§9). */
export function toNumber(value: Prisma.Decimal | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return value.toNumber();
}

/** `Decimal` → major units where the column is NOT NULL. */
export function toNumberRequired(value: Prisma.Decimal): number {
  return value.toNumber();
}

/**
 * Major units → `Decimal`, rounded to minor units first so binary64's
 * approximation of a 2dp value never reaches the column (`contracts.ts` §3).
 */
export function toDecimal(value: number | null | undefined): Prisma.Decimal | null {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  return new Prisma.Decimal((toMinorUnits(value) / 100).toFixed(2));
}

/** `toDecimal` where the column is NOT NULL. */
export function toDecimalRequired(value: number): Prisma.Decimal {
  return new Prisma.Decimal((toMinorUnits(value) / 100).toFixed(2));
}

/* ---------------------------------------------------------------------------
 * The BigInt seam.
 * ------------------------------------------------------------------------- */

/** `Event.id` → string. Never let a BigInt reach `JSON.stringify` or a component. */
export function eventId(id: bigint): string {
  return id.toString();
}

/* ---------------------------------------------------------------------------
 * Json columns. Prisma types them as `Prisma.JsonValue`; the shapes they hold
 * are owned by `contracts.ts`, so reading one is a cast at exactly one place.
 * ------------------------------------------------------------------------- */

export function asJsonObject(value: Prisma.JsonValue | null): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function asJsonArray(value: Prisma.JsonValue | null): unknown[] {
  return Array.isArray(value) ? (value as unknown[]) : [];
}
