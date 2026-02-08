import { describe, expect, test } from "vitest";
import { lintDraftDocText } from "../../src/lib/ai/draftLint";

describe("lintDraftDocText", () => {
  test("flags empty drafts", () => {
    const r = lintDraftDocText("");
    expect(r.ok).toBe(false);
    expect(r.issues[0]?.code).toBe("empty");
  });

  test("accepts a minimally valid draft doc", () => {
    const docText = [
      "---",
      "slug: a",
      "version: \"2026-02-08\"",
      "title: A",
      "summary: s",
      "updatedAt: \"2026-02-08\"",
      "stage: draft",
      "archived: true",
      "visibility: internal",
      "owners: [\"Jane\"]",
      "topics: [\"t1\"]",
      "---",
      "",
      "# A",
      "",
      "## Overview",
      "",
      "Hello",
      "",
    ].join("\n");

    const r = lintDraftDocText(docText);
    expect(r.ok).toBe(true);
    expect(r.issues).toEqual([]);
  });

  test("flags missing required frontmatter fields", () => {
    const docText = "# Hello\n\n## Overview\nx\n";
    const r = lintDraftDocText(docText);
    expect(r.ok).toBe(false);
    const codes = r.issues.map((i) => i.code);
    expect(codes).toContain("missing_slug");
    expect(codes).toContain("missing_title");
    expect(codes).toContain("missing_summary");
    expect(codes).toContain("missing_updatedAt");
    expect(codes).toContain("missing_version");
  });

  test("flags official docs missing governance metadata", () => {
    const docText = [
      "---",
      "slug: a",
      "version: \"2026-02-08\"",
      "title: A",
      "summary: s",
      "updatedAt: \"2026-02-08\"",
      "stage: official",
      "archived: false",
      "visibility: public",
      "---",
      "",
      "# A",
      "",
      "## Overview",
      "",
      "Hello",
      "",
    ].join("\n");
    const r = lintDraftDocText(docText);
    expect(r.ok).toBe(false);
    const codes = r.issues.map((i) => i.code);
    expect(codes).toContain("official_missing_lastReviewedAt");
    expect(codes).toContain("official_missing_owners");
    expect(codes).toContain("official_missing_topics");
    expect(codes).toContain("official_missing_citations");
    expect(codes).toContain("official_missing_approvals");
  });

  test("flags missing H2 heading", () => {
    const docText = [
      "---",
      "slug: a",
      "version: \"2026-02-08\"",
      "title: A",
      "summary: s",
      "updatedAt: \"2026-02-08\"",
      "stage: draft",
      "archived: true",
      "visibility: internal",
      "---",
      "",
      "# A",
      "",
      "No h2 here",
      "",
    ].join("\n");
    const r = lintDraftDocText(docText);
    expect(r.ok).toBe(false);
    expect(r.issues.map((i) => i.code)).toContain("missing_h2");
  });
});
