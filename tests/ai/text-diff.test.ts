import { describe, expect, test } from "vitest";

describe("diffTextPreview", () => {
  test("computes added/removed lines and returns a readable diff", async () => {
    const { diffTextPreview } = await import("../../src/lib/ai/textDiff");
    const from = ["a", "b", "c", ""].join("\n");
    const to = ["a", "b2", "c", "d", ""].join("\n");
    const out = diffTextPreview({ from, to, maxLines: 50, maxChars: 10_000 });
    expect(out.addedLines).toBeGreaterThanOrEqual(1);
    expect(out.removedLines).toBeGreaterThanOrEqual(1);
    expect(out.summary).toMatch(/Added/i);
    expect(out.diff).toContain("-b");
    expect(out.diff).toContain("+b2");
    expect(out.diff).toContain("+d");
  });

  test("truncates long diffs by maxLines/maxChars", async () => {
    const { diffTextPreview } = await import("../../src/lib/ai/textDiff");
    const from = Array.from({ length: 1000 }, (_, i) => `line-${i}`).join("\n") + "\n";
    const to = Array.from({ length: 1000 }, (_, i) => `line-${i}-x`).join("\n") + "\n";
    const out = diffTextPreview({ from, to, maxLines: 30, maxChars: 200 });
    expect(out.truncated).toBe(true);
    expect(out.diff.length).toBeLessThanOrEqual(200);
  });
});

