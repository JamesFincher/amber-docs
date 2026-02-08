import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

function mkTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "amber-docs-audience-"));
}

function write(file: string, body: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body, "utf8");
}

afterEach(() => {
  delete process.env.AMBER_DOCS_CONTENT_DIR;
  delete process.env.AMBER_DOCS_AUDIENCE;
  delete process.env.AMBER_DOCS_PUBLIC_EXPORT;
});

describe("docs visibility + redactions (audience/public export)", () => {
  test("redacts internal/private blocks based on AMBER_DOCS_AUDIENCE", async () => {
    const root = mkTmpDir();
    try {
      const contentDir = path.join(root, "content");
      write(
        path.join(contentDir, "docs", "a.md"),
        `---\nslug: a\nversion: \"1\"\ntitle: A\nstage: draft\nsummary: s\nupdatedAt: \"2026-01-01\"\nowners: [\"o\"]\ntopics: [\"t\"]\n---\n\n# A\n\n## H2\npublic\n\n<!-- audience:internal:start -->\ninternal\n<!-- audience:internal:end -->\n\n<!-- audience:private:start -->\nprivate\n<!-- audience:private:end -->\n`,
      );
      process.env.AMBER_DOCS_CONTENT_DIR = contentDir;

      const mod = await import("../../src/lib/content/docs.server");

      process.env.AMBER_DOCS_AUDIENCE = "public";
      const pub = mod.getLatestDoc("a");
      expect(pub?.markdown).toContain("public");
      expect(pub?.markdown).not.toContain("internal");
      expect(pub?.markdown).not.toContain("private");

      process.env.AMBER_DOCS_AUDIENCE = "internal";
      const internal = mod.getLatestDoc("a");
      expect(internal?.markdown).toContain("public");
      expect(internal?.markdown).toContain("internal");
      expect(internal?.markdown).not.toContain("private");

      process.env.AMBER_DOCS_AUDIENCE = "private";
      const priv = mod.getLatestDoc("a");
      expect(priv?.markdown).toContain("public");
      expect(priv?.markdown).toContain("internal");
      expect(priv?.markdown).toContain("private");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test("redaction markers are resilient to missing end tags (strip to end of doc)", async () => {
    const root = mkTmpDir();
    try {
      const contentDir = path.join(root, "content");
      write(
        path.join(contentDir, "docs", "a.md"),
        `---\nslug: a\nversion: \"1\"\ntitle: A\nstage: draft\nsummary: s\nupdatedAt: \"2026-01-01\"\n---\n\n# A\n\n## H2\npublic\n\n<!-- audience:internal:start -->\ninternal that should be stripped\n`,
      );
      process.env.AMBER_DOCS_CONTENT_DIR = contentDir;
      process.env.AMBER_DOCS_AUDIENCE = "public";

      const mod = await import("../../src/lib/content/docs.server");
      const doc = mod.getLatestDoc("a");
      expect(doc?.markdown).toContain("public");
      expect(doc?.markdown).not.toContain("internal that should be stripped");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test("public export filters to official + public visibility, but tooling can includeHidden", async () => {
    const root = mkTmpDir();
    try {
      const contentDir = path.join(root, "content");
      write(
        path.join(contentDir, "docs", "a.md"),
        `---\nslug: a\nversion: \"1\"\ntitle: A\nstage: official\nsummary: s\nupdatedAt: \"2026-01-01\"\nlastReviewedAt: \"2026-01-01\"\nowners: [\"o\"]\ntopics: [\"t\"]\nvisibility: public\ncitations:\n  - label: \"Source\"\napprovals:\n  - name: \"o\"\n    date: \"2026-01-01\"\n---\n\n# A\n\n## H2\nok\n`,
      );
      write(
        path.join(contentDir, "docs", "b.md"),
        `---\nslug: b\nversion: \"1\"\ntitle: B\nstage: official\nsummary: s\nupdatedAt: \"2026-01-02\"\nlastReviewedAt: \"2026-01-02\"\nowners: [\"o\"]\ntopics: [\"t\"]\nvisibility: internal\ncitations:\n  - label: \"Source\"\napprovals:\n  - name: \"o\"\n    date: \"2026-01-02\"\n---\n\n# B\n\n## H2\nok\n`,
      );
      write(
        path.join(contentDir, "docs", "c.md"),
        `---\nslug: c\nversion: \"1\"\ntitle: C\nstage: final\nsummary: s\nupdatedAt: \"2026-01-03\"\nowners: [\"o\"]\ntopics: [\"t\"]\nvisibility: public\n---\n\n# C\n\n## H2\nok\n`,
      );
      process.env.AMBER_DOCS_CONTENT_DIR = contentDir;
      const mod = await import("../../src/lib/content/docs.server");

      process.env.AMBER_DOCS_AUDIENCE = "public";
      process.env.AMBER_DOCS_PUBLIC_EXPORT = "1";

      expect(mod.listDocSlugs()).toEqual(["a"]);
      expect(mod.getLatestDoc("b")).toBeNull();
      expect(mod.getLatestDoc("c")).toBeNull();

      // Tooling can still find docs in this content dir regardless of export settings.
      const hiddenB = mod.getLatestDoc("b", { includeHidden: true, raw: true, includeArchived: true });
      expect(hiddenB?.slug).toBe("b");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
