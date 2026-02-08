import { describe, expect, test } from "vitest";

describe("workspacePolicy", () => {
  test("computeWriteReady requires connected + allowFileWrites + readwrite", async () => {
    const { computeWriteReady } = await import("../../src/lib/ai/workspacePolicy");
    expect(computeWriteReady({ connected: false, allowFileWrites: true, mode: "readwrite" })).toBe(false);
    expect(computeWriteReady({ connected: true, allowFileWrites: false, mode: "readwrite" })).toBe(false);
    expect(computeWriteReady({ connected: true, allowFileWrites: true, mode: "read" })).toBe(false);
    expect(computeWriteReady({ connected: true, allowFileWrites: true, mode: "readwrite" })).toBe(true);
  });

  test("stagePatch sets lastReviewedAt only for official", async () => {
    const { stagePatch } = await import("../../src/lib/ai/workspacePolicy");
    const now = new Date("2026-02-08T12:00:00.000Z");
    expect(stagePatch("draft", { now })).toEqual({ stage: "draft", lastReviewedAt: undefined });
    expect(stagePatch("final", { now })).toEqual({ stage: "final", lastReviewedAt: undefined });
    expect(stagePatch("official", { reviewedAt: "2026-02-01", now })).toEqual({
      stage: "official",
      lastReviewedAt: "2026-02-01",
    });
    // Falls back to isoDate(now) when reviewedAt is blank/missing.
    expect(stagePatch("official", { reviewedAt: "   ", now })).toEqual({
      stage: "official",
      lastReviewedAt: "2026-02-08",
    });
  });

  test("officialPatch optionally includes approvals", async () => {
    const { officialPatch } = await import("../../src/lib/ai/workspacePolicy");
    const now = new Date("2026-02-08T12:00:00.000Z");

    expect(officialPatch({ now })).toEqual({ stage: "official", lastReviewedAt: "2026-02-08" });

    expect(
      officialPatch({
        reviewedAt: "2026-02-01",
        approvals: [{ name: "alice", date: "2026-02-01" }],
        includeApprovals: true,
        now,
      }),
    ).toEqual({
      stage: "official",
      lastReviewedAt: "2026-02-01",
      approvals: [{ name: "alice", date: "2026-02-01" }],
    });
  });

  test("deletePolicy blocks without writeReady, allowDeletes, and confirm", async () => {
    const { deletePolicy } = await import("../../src/lib/ai/workspacePolicy");
    expect(deletePolicy({ writeReady: false, allowDeletes: true, confirm: true }).ok).toBe(false);
    expect(deletePolicy({ writeReady: true, allowDeletes: false, confirm: true }).ok).toBe(false);
    expect(deletePolicy({ writeReady: true, allowDeletes: true, confirm: false }).ok).toBe(false);
    expect(deletePolicy({ writeReady: true, allowDeletes: true, confirm: true })).toEqual({ ok: true });
  });
});

