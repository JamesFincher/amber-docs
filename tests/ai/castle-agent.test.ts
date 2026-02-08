import { describe, expect, test, vi } from "vitest";
import { extractJsonObject, parseAgentResponse, runAgentLoop, type ToolDescriptor } from "../../src/lib/ai/castleAgent";

describe("castleAgent helpers", () => {
  test("extractJsonObject pulls JSON out of prose and code fences", () => {
    expect(extractJsonObject('{"type":"final","message":"ok"}')).toContain('"type"');
    expect(extractJsonObject("Here:\n```json\n{\"type\":\"final\",\"message\":\"ok\"}\n```")).toContain('"message"');
    // Missing closing fence should still work.
    expect(extractJsonObject("```json\n{\"type\":\"final\",\"message\":\"ok\"}\n")).toContain('"final"');
    // Fence with no newline should not crash.
    expect(extractJsonObject("```json")).toBeNull();
    expect(extractJsonObject("no json")).toBeNull();
  });

  test("parseAgentResponse parses tool calls and final messages", () => {
    const tool = parseAgentResponse('{"type":"tool_calls","calls":[{"tool":"search_docs","args":{"query":"x"}}]}');
    expect(tool.type).toBe("tool_calls");
    if (tool.type !== "tool_calls") throw new Error("expected tool_calls");
    expect(tool.calls[0]?.tool).toBe("search_docs");

    const fin = parseAgentResponse('{"type":"final","message":"done"}');
    expect(fin.type).toBe("final");
    if (fin.type !== "final") throw new Error("expected final");
    expect(fin.message).toBe("done");
  });

  test("parseAgentResponse rejects invalid JSON and invalid type", () => {
    expect(() => parseAgentResponse('{"type":"final","message":}')).toThrow(/parse failed/i);
    expect(() => parseAgentResponse(JSON.stringify(["nope"]))).toThrow(/did not contain a JSON object/i);
    expect(() => parseAgentResponse(JSON.stringify({ type: "nope" }))).toThrow(/missing valid \"type\"/i);
  });

  test("parseAgentResponse parses optional draft payload on final", () => {
    const fin = parseAgentResponse(
      JSON.stringify({
        type: "final",
        message: "ok",
        draft: { docText: "---\nslug: x\n---\n# X\n", markdown: "# X\n", suggested: { slug: "x" } },
      }),
    );
    expect(fin.type).toBe("final");
    if (fin.type !== "final") throw new Error("expected final");
    expect(fin.draft?.docText).toContain("slug: x");
    expect((fin.draft?.suggested as Record<string, unknown>)?.slug).toBe("x");
  });

  test("parseAgentResponse rejects invalid tool_calls", () => {
    expect(() => parseAgentResponse(JSON.stringify({ type: "tool_calls", calls: [{}] }))).toThrow(/no valid tool calls/i);
  });

  test("runAgentLoop executes tool calls and returns a final", async () => {
    const llm = vi
      .fn<(prompt: string) => Promise<string>>()
      // First: ask for a tool.
      .mockResolvedValueOnce(
        JSON.stringify({
          type: "tool_calls",
          calls: [{ tool: "search_docs", args: { query: "treasury", limit: 2 } }],
        }),
      )
      // Second: final response
      .mockResolvedValueOnce(JSON.stringify({ type: "final", message: "Found 2 docs." }));

    const tools: ToolDescriptor[] = [
      {
        name: "search_docs",
        description: "Search docs",
        args: "{ query: string, limit?: number }",
        returns: "{ results: Array<{ slug: string }> }",
      },
    ];

    const searchFn = vi.fn(async () => ({ results: [{ slug: "a" }, { slug: "b" }] }));

    const r = await runAgentLoop({
      system: "You are Amber AI.",
      tools,
      transcript: [{ role: "user", content: "Find docs about treasury." }],
      llm,
      toolFns: { search_docs: searchFn },
      maxSteps: 4,
    });

    expect(r.final.message).toContain("Found 2 docs");
    expect(searchFn).toHaveBeenCalledTimes(1);
    expect(llm).toHaveBeenCalledTimes(2);
  });

  test("runAgentLoop recovers from a parse error by adding a __parse_error__ tool message", async () => {
    const llm = vi
      .fn<(prompt: string) => Promise<string>>()
      .mockResolvedValueOnce("not json at all")
      .mockResolvedValueOnce(JSON.stringify({ type: "final", message: "ok after parse error" }));

    const r = await runAgentLoop({
      system: "You are Amber AI.",
      tools: [],
      transcript: [{ role: "user", content: "hello" }],
      llm,
      toolFns: {},
      maxSteps: 3,
    });

    expect(r.final.message).toContain("ok after parse error");
    expect(r.transcript.some((m) => m.role === "tool" && m.content.includes("__parse_error__"))).toBe(true);
    expect(llm).toHaveBeenCalledTimes(2);
  });

  test("runAgentLoop records unknown tools as tool errors and continues", async () => {
    const llm = vi
      .fn<(prompt: string) => Promise<string>>()
      .mockResolvedValueOnce(JSON.stringify({ type: "tool_calls", calls: [{ tool: "nope", args: {} }] }))
      .mockResolvedValueOnce(JSON.stringify({ type: "final", message: "done" }));

    const r = await runAgentLoop({
      system: "You are Amber AI.",
      tools: [{ name: "nope", description: "missing fn", args: "{}", returns: "{}" }],
      transcript: [{ role: "user", content: "call an unknown tool" }],
      llm,
      toolFns: {},
      maxSteps: 3,
    });

    expect(r.final.message).toBe("done");
    expect(r.transcript.some((m) => m.role === "tool" && m.content.includes("\"ok\": false") && m.content.includes("Unknown tool"))).toBe(true);
  });

  test("runAgentLoop records tool exceptions as tool errors and continues", async () => {
    const llm = vi
      .fn<(prompt: string) => Promise<string>>()
      .mockResolvedValueOnce(JSON.stringify({ type: "tool_calls", calls: [{ tool: "boom", args: {} }] }))
      .mockResolvedValueOnce(JSON.stringify({ type: "final", message: "done" }));

    const boom = vi.fn(async () => {
      throw new Error("kaboom");
    });

    const r = await runAgentLoop({
      system: "You are Amber AI.",
      tools: [{ name: "boom", description: "throws", args: "{}", returns: "{}" }],
      transcript: [{ role: "user", content: "call boom" }],
      llm,
      toolFns: { boom },
      maxSteps: 3,
    });

    expect(r.final.message).toBe("done");
    expect(r.transcript.some((m) => m.role === "tool" && m.content.includes("kaboom"))).toBe(true);
    expect(boom).toHaveBeenCalledTimes(1);
  });

  test("runAgentLoop throws if it does not reach final within maxSteps", async () => {
    const llm = vi.fn<(prompt: string) => Promise<string>>().mockResolvedValue(
      JSON.stringify({ type: "tool_calls", calls: [{ tool: "nope", args: {} }] }),
    );

    await expect(
      runAgentLoop({
        system: "You are Amber AI.",
        tools: [{ name: "nope", description: "unknown", args: "{}", returns: "{}" }],
        transcript: [{ role: "user", content: "loop forever" }],
        llm,
        toolFns: {},
        maxSteps: 2,
      }),
    ).rejects.toThrow(/did not complete/i);
    expect(llm).toHaveBeenCalledTimes(2);
  });
});
