import { describe, expect, test } from "vitest";
import { createSlugger } from "@/lib/slugger";

describe("createSlugger", () => {
  test("normalizes and dedupes headings (GitHub-ish)", () => {
    const s = createSlugger();
    expect(s.slug("Hello world")).toBe("hello-world");
    expect(s.slug("Hello  world")).toBe("hello-world-1");
    expect(s.slug("Hello-world")).toBe("hello-world-2");
  });

  test("handles empty/whitespace input", () => {
    const s = createSlugger();
    expect(s.slug("   ")).toBe("section");
    expect(s.slug("")).toBe("section-1");
  });

  test("strips punctuation and non-ascii-ish chars", () => {
    const s = createSlugger();
    expect(s.slug(`"Quoted" 'Words'`)).toBe("quoted-words");
    expect(s.slug("Café")).toBe("caf");
  });
});

