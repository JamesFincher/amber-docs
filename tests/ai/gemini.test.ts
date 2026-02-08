import { afterEach, describe, expect, test, vi } from "vitest";

describe("geminiGenerateText", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test("returns concatenated text from the first candidate parts", async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async () => {
      return new Response(
        JSON.stringify({
          candidates: [
            {
              finishReason: "STOP",
              content: { parts: [{ text: "Hello " }, { text: "world" }] },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const { geminiGenerateText } = await import("../../src/lib/ai/gemini");
    const out = await geminiGenerateText({
      apiKey: "k",
      model: "gemini-2.0-flash",
      prompt: "Say hi",
    });
    expect(out.text).toBe("Hello world");
    expect(out.finishReason).toBe("STOP");

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain("/v1beta/models/gemini-2.0-flash:generateContent");
    expect(init?.method).toBe("POST");
    expect(String(init?.body)).toContain("Say hi");
  });

  test("throws a helpful error when the API responds with JSON error message", async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async () => {
      return new Response(JSON.stringify({ error: { message: "Bad key", code: 401 } }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const { geminiGenerateText } = await import("../../src/lib/ai/gemini");
    await expect(
      geminiGenerateText({
        apiKey: "bad",
        model: "gemini-2.0-flash",
        prompt: "x",
      }),
    ).rejects.toThrow(/bad key/i);
  });

  test("throws when response contains no candidate text", async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async () => {
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [] } }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const { geminiGenerateText } = await import("../../src/lib/ai/gemini");
    await expect(
      geminiGenerateText({
        apiKey: "k",
        model: "gemini-2.0-flash",
        prompt: "x",
      }),
    ).rejects.toThrow(/no text/i);
  });

  test("throws when the API responds with a non-JSON error body", async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async () => {
      return new Response("nope", { status: 500, statusText: "Bad", headers: { "content-type": "text/plain" } });
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const { geminiGenerateText } = await import("../../src/lib/ai/gemini");
    await expect(
      geminiGenerateText({
        apiKey: "k",
        model: "gemini-2.0-flash",
        prompt: "x",
      }),
    ).rejects.toThrow(/nope/i);
  });

  test("validates required fields before calling fetch", async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async () => {
      return new Response("ok", { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const { geminiGenerateText } = await import("../../src/lib/ai/gemini");
    await expect(geminiGenerateText({ apiKey: "", model: "m", prompt: "x" })).rejects.toThrow(/api key/i);
    await expect(geminiGenerateText({ apiKey: "k", model: " ", prompt: "x" })).rejects.toThrow(/model/i);
    await expect(geminiGenerateText({ apiKey: "k", model: "m", prompt: " " })).rejects.toThrow(/prompt/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
