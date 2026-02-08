// @vitest-environment jsdom

import { afterEach, describe, expect, test, vi } from "vitest";

describe("geminiSettings", () => {
  const prev = process.env.NEXT_PUBLIC_GEMINI_DEFAULT_MODEL;

  afterEach(() => {
    localStorage.clear();
    if (prev === undefined) delete process.env.NEXT_PUBLIC_GEMINI_DEFAULT_MODEL;
    else process.env.NEXT_PUBLIC_GEMINI_DEFAULT_MODEL = prev;
    vi.resetModules();
  });

  test("defaultGeminiModel uses NEXT_PUBLIC_GEMINI_DEFAULT_MODEL when set", async () => {
    process.env.NEXT_PUBLIC_GEMINI_DEFAULT_MODEL = " gemini-3-flash-preview ";
    const { defaultGeminiModel } = await import("../../src/lib/ai/geminiSettings");
    expect(defaultGeminiModel()).toBe("gemini-3-flash-preview");
  });

  test("defaultGeminiModel falls back when env is missing/blank", async () => {
    delete process.env.NEXT_PUBLIC_GEMINI_DEFAULT_MODEL;
    const { defaultGeminiModel, FALLBACK_GEMINI_MODEL } = await import("../../src/lib/ai/geminiSettings");
    expect(defaultGeminiModel()).toBe(FALLBACK_GEMINI_MODEL);
  });

  test("read/writeGeminiSettings round-trip localStorage", async () => {
    const { readGeminiSettings, writeGeminiSettings } = await import("../../src/lib/ai/geminiSettings");
    expect(readGeminiSettings()).toEqual({ apiKey: "", model: "" });

    expect(writeGeminiSettings({ apiKey: "k", model: "m" })).toBe(true);
    expect(readGeminiSettings()).toEqual({ apiKey: "k", model: "m" });
  });
});

