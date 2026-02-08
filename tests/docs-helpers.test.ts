import { describe, expect, test } from "vitest";

describe("docs helpers", () => {
  test("docsTopics trims and drops empty entries", async () => {
    const { docsTopics } = await import("../src/lib/docs");
    const out = docsTopics({ topics: [" a ", "", "  ", "b"] });
    expect(out).toEqual(["a", "b"]);
  });

  test("hasCitations checks length", async () => {
    const { hasCitations } = await import("../src/lib/docs");
    expect(hasCitations({ citations: [] })).toBe(false);
    expect(hasCitations({ citations: [{ label: "x" }] })).toBe(true);
  });

  test("needsReview defaults to true when missing or invalid date", async () => {
    const { needsReview } = await import("../src/lib/docs");
    expect(needsReview({ lastReviewedAt: undefined }, new Date("2026-02-01"))).toBe(true);
    expect(needsReview({ lastReviewedAt: "nope" }, new Date("2026-02-01"))).toBe(true);
  });

  test("needsReview uses 90 day policy", async () => {
    const { needsReview } = await import("../src/lib/docs");
    expect(needsReview({ lastReviewedAt: "2026-02-01" }, new Date("2026-03-01"))).toBe(false);
    expect(needsReview({ lastReviewedAt: "2025-11-01" }, new Date("2026-03-01"))).toBe(true);
  });

  test("stageBadgeClass returns stable class strings", async () => {
    const { stageBadgeClass } = await import("../src/lib/docs");
    expect(stageBadgeClass("draft")).toMatch(/amber/);
    expect(stageBadgeClass("final")).toMatch(/sky/);
    expect(stageBadgeClass("official")).toMatch(/emerald/);
  });

  test("docKey uses slug@version", async () => {
    const { docKey } = await import("../src/lib/docs");
    expect(docKey({ slug: "a", version: "1" })).toBe("a@1");
  });
});
