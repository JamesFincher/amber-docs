import { afterEach, describe, expect, test, vi } from "vitest";

describe("adminRpc", () => {
  const prevEnable = process.env.NEXT_PUBLIC_ENABLE_ADMIN_RPC;

  afterEach(() => {
    if (prevEnable === undefined) delete process.env.NEXT_PUBLIC_ENABLE_ADMIN_RPC;
    else process.env.NEXT_PUBLIC_ENABLE_ADMIN_RPC = prevEnable;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test("throws when not enabled", async () => {
    delete process.env.NEXT_PUBLIC_ENABLE_ADMIN_RPC;
    const { adminRpc } = await import("../src/lib/adminClient");
    await expect(adminRpc("x")).rejects.toThrow(/disabled/i);
  });

  test("posts JSON and returns decoded payload", async () => {
    process.env.NEXT_PUBLIC_ENABLE_ADMIN_RPC = "1";

    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async () => {
      return new Response(JSON.stringify({ ok: true, value: 123 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const { adminRpc } = await import("../src/lib/adminClient");
    const out = await adminRpc<{ ok: boolean; value: number }>("test.method", { a: 1 });
    expect(out).toEqual({ ok: true, value: 123 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/admin/rpc");
    expect(init?.method).toBe("POST");
    expect((init?.headers as Record<string, string> | undefined)?.["content-type"]).toBe("application/json");
    expect(String(init?.body)).toContain("test.method");
  });

  test("throws string error when non-JSON response fails", async () => {
    process.env.NEXT_PUBLIC_ENABLE_ADMIN_RPC = "1";

    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => new Response("nope", { status: 500, statusText: "Bad" }),
    );
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const { adminRpc } = await import("../src/lib/adminClient");
    await expect(adminRpc("x")).rejects.toThrow(/nope/i);
  });
});
