import { describe, expect, test } from "vitest";
import { slugFromFilename, summaryFromMarkdown, titleFromMarkdown } from "../src/lib/studio/importFiles";

describe("studio/importFiles", () => {
  test("titleFromMarkdown uses the first H1", () => {
    const md = "\n\n# Hello World\n\nBody\n";
    expect(titleFromMarkdown(md, "fallback")).toBe("Hello World");
  });

  test("titleFromMarkdown falls back when there is no H1", () => {
    const md = "## Not H1\n\nBody\n";
    expect(titleFromMarkdown(md, "fallback")).toBe("fallback");
  });

  test("summaryFromMarkdown picks the first real sentence-like line", () => {
    const md = [
      "# Title",
      "",
      "> Quote",
      "",
      "- Bullet",
      "",
      "This is the summary line.",
      "",
      "More text.",
    ].join("\n");
    expect(summaryFromMarkdown(md)).toBe("This is the summary line.");
  });

  test("summaryFromMarkdown trims formatting and length", () => {
    const md = `# T\n\n**Hello** _world_ \`ok\` ${"x".repeat(500)}\n`;
    const s = summaryFromMarkdown(md);
    expect(s).toMatch(/^Hello world ok/);
    expect(s.length).toBeLessThanOrEqual(180);
  });

  test("slugFromFilename normalizes and strips extensions", () => {
    expect(slugFromFilename("My Doc (v1).md")).toBe("my-doc-v1");
    expect(slugFromFilename("My Doc (v1).mdx")).toBe("my-doc-v1");
    expect(slugFromFilename("My Doc (v1).txt")).toBe("my-doc-v1");
  });

  test("slugFromFilename falls back when the name is empty", () => {
    expect(slugFromFilename(".md")).toBe("new-doc");
    expect(slugFromFilename("   .md")).toBe("new-doc");
  });
});

