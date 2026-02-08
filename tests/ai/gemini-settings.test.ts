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
    process.env.NEXT_PUBLIC_GEMINI_DEFAULT_MODEL = " gemini-3-pro ";
    const { defaultGeminiModel } = await import("../../src/lib/ai/geminiSettings");
    expect(defaultGeminiModel()).toBe("gemini-3-pro");
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

  test("model presets include Gemini 3 Flash and Gemini 3 Pro at the top", async () => {
    const { DEFAULT_GEMINI_FLASH_MODEL, DEFAULT_GEMINI_PRO_MODEL, GEMINI_MODEL_PRESETS } = await import(
      "../../src/lib/ai/geminiSettings"
    );
    expect(GEMINI_MODEL_PRESETS[0]).toBe(DEFAULT_GEMINI_FLASH_MODEL);
    expect(GEMINI_MODEL_PRESETS[1]).toBe(DEFAULT_GEMINI_PRO_MODEL);
  });
});
