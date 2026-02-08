import { describe, expect, test } from "vitest";
import { extractH2Sections, extractToc, toSearchText } from "@/lib/markdown";

describe("markdown helpers", () => {
  test("extractToc ignores headings inside code fences", () => {
    const md = [
      "# Title",
      "",
      "```",
      "## Not real",
      "```",
      "",
      "## Real",
      "### Child",
    ].join("\n");

    const toc = extractToc(md);
    expect(toc.map((t) => `${t.depth}:${t.text}:${t.id}`)).toEqual([
      "2:Real:real",
      "3:Child:child",
    ]);
  });

  test("extractToc dedupes ids for repeated headings", () => {
    const md = ["# T", "## Same", "## Same"].join("\n");
    const toc = extractToc(md);
    expect(toc.map((t) => t.id)).toEqual(["same", "same-1"]);
  });

  test("extractH2Sections splits content by H2 and ignores fenced headings", () => {
    const md = [
      "# T",
      "",
      "## A",
      "Line 1",
      "",
      "```",
      "## not a heading",
      "```",
      "",
      "## B ### trailing",
      "Line 2",
    ].join("\n");

    const sections = extractH2Sections(md);
    expect(sections.map((s) => s.heading)).toEqual(["A", "B ### trailing"]);
    expect(sections[0].body).toContain("Line 1");
    // Fenced content remains part of the section body; it just shouldn't start a new section.
    expect(sections[0].body).toContain("not a heading");
  });

  test("toSearchText strips links, images, code fences, headings, and collapses whitespace", () => {
    const md = [
      "# Title",
      "",
      "Hello **world**.",
      "",
      "[link](https://example.com) ![img](/x.png)",
      "",
      "```",
      "code block",
      "```",
      "",
      "`inline`",
    ].join("\n");
    const text = toSearchText(md);
    expect(text).toContain("Title");
    expect(text).toContain("Hello world");
    expect(text).not.toContain("https://example.com");
    expect(text).not.toContain("code block");
    expect(text).not.toContain("inline");
  });
});
