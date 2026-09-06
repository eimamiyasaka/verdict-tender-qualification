import { describe, expect, it } from "vitest";
import {
  daysUntil,
  describeDeadline,
  formatDate,
  formatMoney,
  formatMoneyAbbrev,
  fromDateInputValue,
  monthsBetween,
  toDateInputValue,
} from "../format";

describe("formatMoneyAbbrev", () => {
  it("abbreviates millions to one decimal", () => {
    expect(formatMoneyAbbrev(2_400_000)).toBe("£2.4m");
    expect(formatMoneyAbbrev(1_100_000)).toBe("£1.1m");
    expect(formatMoneyAbbrev(5_000_000)).toBe("£5m");
  });
  it("abbreviates thousands to whole k", () => {
    expect(formatMoneyAbbrev(780_000)).toBe("£780k");
    expect(formatMoneyAbbrev(180_000)).toBe("£180k");
  });
  it("uses the currency symbol", () => {
    expect(formatMoneyAbbrev(500_000, "EUR")).toBe("€500k");
  });
  it("renders a dash for missing values", () => {
    expect(formatMoneyAbbrev(null)).toBe("—");
  });
});

describe("formatMoney", () => {
  it("renders full GBP with thousands separators and no pence", () => {
    expect(formatMoney(4_120_000)).toBe("£4,120,000");
  });
});

describe("dates", () => {
  it("formats en-GB short dates", () => {
    expect(formatDate(new Date(2026, 8, 14))).toMatch(/^14 Sept? 2026$/);
    expect(formatDate(null)).toBe("—");
  });
  it("round-trips date input values", () => {
    const d = fromDateInputValue("2026-09-14");
    expect(d).not.toBeNull();
    expect(toDateInputValue(d)).toBe("2026-09-14");
  });
  it("counts calendar days regardless of time of day", () => {
    const now = new Date(2026, 8, 6, 23, 30);
    expect(daysUntil(new Date(2026, 8, 7, 1, 0), now)).toBe(1);
    expect(daysUntil(new Date(2026, 8, 6, 1, 0), now)).toBe(0);
    expect(daysUntil(new Date(2026, 8, 3), now)).toBe(-3);
  });
  it("describes deadlines with urgency inside seven days", () => {
    const now = new Date(2026, 8, 6);
    expect(describeDeadline(new Date(2026, 8, 17), now)).toMatchObject({ label: "Closes in 11 days", urgent: false, closed: false });
    expect(describeDeadline(new Date(2026, 8, 10), now)).toMatchObject({ label: "Closes in 4 days", urgent: true });
    expect(describeDeadline(new Date(2026, 8, 6), now)).toMatchObject({ label: "Closes today", urgent: true });
    expect(describeDeadline(new Date(2026, 8, 1), now)).toMatchObject({ label: "Closed 5 days ago", closed: true });
    expect(describeDeadline(null, now)).toBeNull();
  });
  it("counts whole months between dates", () => {
    expect(monthsBetween(new Date(2024, 1, 10), new Date(2026, 8, 6))).toBe(30);
    expect(monthsBetween(new Date(2024, 1, 1), new Date(2026, 8, 6))).toBe(31);
  });
});
