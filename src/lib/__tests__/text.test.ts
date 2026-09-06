import { describe, expect, it } from "vitest";
import { countWords, excerpt, searchTerms } from "../text";

describe("countWords", () => {
  it("returns 0 for the empty string", () => {
    expect(countWords("")).toBe(0);
  });
  it("returns 0 for whitespace only", () => {
    expect(countWords("   \n\t ")).toBe(0);
  });
  it("counts words separated by any whitespace", () => {
    expect(countWords("one two")).toBe(2);
    expect(countWords("  one\n two\tthree  ")).toBe(3);
  });
  it("treats hyphenated words as one word", () => {
    expect(countWords("public-sector experience")).toBe(2);
  });
});

describe("excerpt", () => {
  it("returns short text unchanged", () => {
    expect(excerpt("short")).toBe("short");
  });
  it("cuts on a word boundary and appends an ellipsis", () => {
    const out = excerpt("a".repeat(50) + " " + "b".repeat(50) + " " + "c".repeat(100), 120);
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(121);
  });
});

describe("searchTerms", () => {
  it("lower-cases, strips short tokens and de-duplicates", () => {
    expect(searchTerms("Social Value and social VALUE plans")).toEqual(["social", "value", "and", "plans"]);
  });
});
