/**
 * The Decimal and BigInt seams (`src/lib/db/client.ts`).
 *
 * The schema stores money as `Decimal(14,2)` (§7.1) and `contracts.ts` uses
 * `number` in major units. There is one conversion per direction and this is its
 * test, because the failure mode is silent: binary64 represents 4_120_000.10 as
 * 4_120_000.099999999627, and a threshold comparison against a value that lost a
 * penny on the way into the column is a wrong verdict rather than an error.
 *
 * `Event.id` is a BigInt, and `JSON.stringify` throws on one. The second half of
 * this file is the assertion that it never leaves the layer as a BigInt.
 */

import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { compareMoney } from "../../../../contracts";
import { eventId, toDecimal, toDecimalRequired, toNumber, toNumberRequired } from "../client";

const decimal = (value: string) => new Prisma.Decimal(value);

describe("Decimal → number", () => {
  it("reads a 2dp money value in major units", () => {
    expect(toNumberRequired(decimal("4120000.00"))).toBe(4_120_000);
    expect(toNumberRequired(decimal("780000.50"))).toBe(780_000.5);
    expect(toNumberRequired(decimal("0.01"))).toBe(0.01);
  });

  it("keeps null as null — a missing metric is not a zero (§9)", () => {
    // This is the distinction the product is built on: "we cannot see your 2024
    // profit" and "your 2024 profit was nil" are different sentences.
    expect(toNumber(null)).toBeNull();
    expect(toNumber(undefined)).toBeNull();
    expect(toNumber(decimal("0.00"))).toBe(0);
  });

  it("reads the non-money decimals the schema also carries", () => {
    // weighting Decimal(5,2), extractionConfidence Decimal(3,2), desirableScore Decimal(5,2).
    expect(toNumberRequired(decimal("44.44"))).toBe(44.44);
    expect(toNumberRequired(decimal("0.96"))).toBe(0.96);
    expect(toNumberRequired(decimal("100.00"))).toBe(100);
  });
});

describe("number → Decimal", () => {
  it("writes exactly two decimal places", () => {
    // `Decimal.toString()` drops trailing zeros; the column is scale 2 and
    // `toFixed(2)` is what the value is worth in minor units.
    expect(toDecimalRequired(4_120_000).toFixed(2)).toBe("4120000.00");
    expect(toDecimalRequired(0).toFixed(2)).toBe("0.00");
    expect(toDecimalRequired(10_000_000).toFixed(2)).toBe("10000000.00");
  });

  it("rounds through minor units, so binary64's approximation never reaches the column", () => {
    // 4_120_000.10 is really 4_120_000.099999999627 in binary64.
    expect(toDecimalRequired(4_120_000.1).toFixed(2)).toBe("4120000.10");
    expect(toDecimalRequired(0.1 + 0.2).toFixed(2)).toBe("0.30");
  });

  it("rounds the half-way cases the way `toMinorUnits` does, not the way arithmetic would", () => {
    // 1.005 is really 1.00499999999999989, so `Math.round(value * 100)` rounds
    // it DOWN; 2.675 is really 2.67500000000000027 and rounds up. That is what
    // the frozen `toMinorUnits` in contracts.ts does, and this layer uses it
    // rather than a second rounding rule of its own — one rule in the codebase,
    // even where binary64 makes it surprising.
    expect(toDecimalRequired(1.005).toFixed(2)).toBe("1.00");
    expect(toDecimalRequired(2.675).toFixed(2)).toBe("2.68");
    // A value that is exactly representable rounds half away from zero as usual.
    expect(toDecimalRequired(1.25).toFixed(2)).toBe("1.25");
    expect(toDecimalRequired(0.125).toFixed(2)).toBe("0.13");
  });

  it("keeps null and refuses NaN rather than writing a garbage figure", () => {
    expect(toDecimal(null)).toBeNull();
    expect(toDecimal(undefined)).toBeNull();
    expect(toDecimal(Number.NaN)).toBeNull();
  });

  it("survives a round trip at the values the demo turns on", () => {
    // The near miss the whole NHS tender rests on: £4.12m against £5m.
    for (const value of [4_120_000, 3_870_000, 5_000_000, 10_000_000, 890_000, 212_000, 0.01]) {
      expect(toNumberRequired(toDecimalRequired(value))).toBe(value);
    }
  });

  it("agrees with compareMoney after the round trip", () => {
    const turnover = toNumberRequired(toDecimalRequired(4_120_000));
    const threshold = toNumberRequired(toDecimalRequired(5_000_000));
    expect(compareMoney(turnover, threshold)).toBe(-1);
    expect(compareMoney(turnover, turnover)).toBe(0);
  });
});

describe("BigInt → string", () => {
  // `BigInt(...)` rather than a `1n` literal: tsconfig targets ES2017.
  const one = BigInt(1);

  it("serialises an Event id", () => {
    expect(eventId(one)).toBe("1");
    // Past Number.MAX_SAFE_INTEGER, where a number would already have lost the id.
    expect(eventId(BigInt("9007199254740993"))).toBe("9007199254740993");
  });

  it("is what stops JSON.stringify throwing on the audit log", () => {
    // A Server Component hands its props to a Client Component as JSON. A BigInt
    // that reached that boundary would throw "Do not know how to serialize".
    expect(() => JSON.stringify({ id: one })).toThrow(TypeError);
    expect(JSON.stringify({ id: eventId(one) })).toBe('{"id":"1"}');
  });
});
