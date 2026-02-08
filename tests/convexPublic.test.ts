import { describe, expect, test } from "vitest";

describe("convexPublic", () => {
  test("throws a clear error when NEXT_PUBLIC_CONVEX_URL is missing", async () => {
    const prev = process.env.NEXT_PUBLIC_CONVEX_URL;
    try {
      delete process.env.NEXT_PUBLIC_CONVEX_URL;
      const { listOfficialDocs } = await import("../src/lib/convexPublic");
      await expect(listOfficialDocs()).rejects.toThrow(/NEXT_PUBLIC_CONVEX_URL/);
    } finally {
      if (prev === undefined) delete process.env.NEXT_PUBLIC_CONVEX_URL;
      else process.env.NEXT_PUBLIC_CONVEX_URL = prev;
    }
  });
});

