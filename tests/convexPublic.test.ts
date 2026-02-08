import { afterEach, describe, expect, test, vi } from "vitest";

const queryMock = vi.fn<
  (fn: unknown, args: Record<string, unknown>) => Promise<unknown>
>(async () => ({ ok: true }));

vi.mock("convex/browser", () => {
  return {
    ConvexHttpClient: class {
      url: string;
      constructor(url: string) {
        this.url = url;
      }
      query = queryMock;
    },
  };
});

describe("convexPublic", () => {
  const prev = process.env.NEXT_PUBLIC_CONVEX_URL;

  afterEach(() => {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_CONVEX_URL;
    else process.env.NEXT_PUBLIC_CONVEX_URL = prev;
    queryMock.mockReset();
    vi.resetModules();
  });

  test("throws a clear error when NEXT_PUBLIC_CONVEX_URL is missing", async () => {
    delete process.env.NEXT_PUBLIC_CONVEX_URL;
    const { listOfficialDocs } = await import("../src/lib/convexPublic");
    await expect(listOfficialDocs()).rejects.toThrow(/NEXT_PUBLIC_CONVEX_URL/);
  });

  test("queries Convex with the public docs APIs when enabled", async () => {
    process.env.NEXT_PUBLIC_CONVEX_URL = "https://convex.example.test";
    queryMock.mockResolvedValueOnce([{ slug: "a" }]);
    queryMock.mockResolvedValueOnce({ slug: "a", markdown: "# A" });

    const { getOfficialDocBySlug, listOfficialDocs } = await import("../src/lib/convexPublic");
    await expect(listOfficialDocs()).resolves.toEqual([{ slug: "a" }]);
    await expect(getOfficialDocBySlug("a")).resolves.toEqual({ slug: "a", markdown: "# A" });

    expect(queryMock).toHaveBeenCalledTimes(2);
    expect(queryMock.mock.calls[0]?.[1]).toEqual({});
    expect(queryMock.mock.calls[1]?.[1]).toEqual({ slug: "a" });
  });
});
