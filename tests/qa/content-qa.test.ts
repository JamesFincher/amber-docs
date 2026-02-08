import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { runContentQa } from "../../src/lib/qa/contentQa";

function mkTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "amber-docs-qa-"));
}

function write(file: string, body: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body, "utf8");
}

function baseBlocks(dir: string) {
  write(path.join(dir, "blocks", "disclaimers.json"), "[]\n");
  write(
    path.join(dir, "blocks", "glossary.json"),
    JSON.stringify(
      [
        {
          term: "Official",
          definition: "Published stance.",
          synonyms: [],
          tags: ["lifecycle"],
        },
      ],
      null,
      2,
    ) + "\n",
  );
}

async function runQa(projectRoot: string, contentDir: string) {
  return await runContentQa({
    projectRoot,
    contentDir,
    skipExternalLinks: true,
  });
}

describe("content QA (edge cases)", () => {
  test("passes on a minimal valid draft doc", async () => {
      const root = mkTmpDir();
    try {
      const contentDir = path.join(root, "content");
      baseBlocks(contentDir);
      fs.mkdirSync(path.join(root, "public"), { recursive: true });
      write(
        path.join(contentDir, "docs", "a.md"),
        `---\nslug: a\nversion: \"1\"\ntitle: A\nstage: draft\nsummary: s\nupdatedAt: \"2026-01-01\"\nowners: [\"o\"]\ntopics: [\"t\"]\n---\n\n# A\n\n## H2\nok\n`,
      );
      const r = await runQa(root, contentDir);
      expect(r.ok).toBe(true);
      expect(r.failures).toHaveLength(0);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test("fails on duplicate slug+version", async () => {
      const root = mkTmpDir();
    try {
      const contentDir = path.join(root, "content");
      baseBlocks(contentDir);
      fs.mkdirSync(path.join(root, "public"), { recursive: true });
      const doc = `---\nslug: a\nversion: \"1\"\ntitle: A\nstage: draft\nsummary: s\nupdatedAt: \"2026-01-01\"\nowners: [\"o\"]\ntopics: [\"t\"]\n---\n\n# A\n\n## H2\nok\n`;
      write(path.join(contentDir, "docs", "a1.md"), doc);
      write(path.join(contentDir, "docs", "a2.md"), doc);
      const r = await runQa(root, contentDir);
      expect(r.ok).toBe(false);
      expect(r.failures.map((f) => f.code)).toContain("duplicate_doc_version");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test("fails on broken internal versioned link", async () => {
      const root = mkTmpDir();
    try {
      const contentDir = path.join(root, "content");
      baseBlocks(contentDir);
      fs.mkdirSync(path.join(root, "public"), { recursive: true });
      write(
        path.join(contentDir, "docs", "a.md"),
        `---\nslug: a\nversion: \"1\"\ntitle: A\nstage: draft\nsummary: s\nupdatedAt: \"2026-01-01\"\nowners: [\"o\"]\ntopics: [\"t\"]\n---\n\n# A\n\n## H2\nSee [missing](/docs/missing/v/1).\n`,
      );
      const r = await runQa(root, contentDir);
      expect(r.ok).toBe(false);
      expect(r.failures.map((f) => f.code)).toContain("broken_internal_link");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test("fails when Official doc is missing approvals", async () => {
      const root = mkTmpDir();
    try {
      const contentDir = path.join(root, "content");
      baseBlocks(contentDir);
      fs.mkdirSync(path.join(root, "public"), { recursive: true });
      write(
        path.join(contentDir, "docs", "a.md"),
        `---\nslug: a\nversion: \"1\"\ntitle: A\nstage: official\nsummary: s\nupdatedAt: \"2026-01-01\"\nlastReviewedAt: \"2026-01-02\"\nowners: [\"o\"]\ntopics: [\"t\"]\ncitations:\n  - label: \"Source\"\n---\n\n# A\n\n## H2\nContains 123.\n`,
      );
      const r = await runQa(root, contentDir);
      expect(r.ok).toBe(false);
      expect(r.failures.map((f) => f.code)).toContain("official_missing_approvals");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test("fails on missing assets referenced from markdown", async () => {
      const root = mkTmpDir();
    try {
      const contentDir = path.join(root, "content");
      baseBlocks(contentDir);
      fs.mkdirSync(path.join(root, "public"), { recursive: true });
      write(
        path.join(contentDir, "docs", "a.md"),
        `---\nslug: a\nversion: \"1\"\ntitle: A\nstage: draft\nsummary: s\nupdatedAt: \"2026-01-01\"\nowners: [\"o\"]\ntopics: [\"t\"]\n---\n\n# A\n\n## H2\n![x](/missing.png)\n`,
      );
      const r = await runQa(root, contentDir);
      expect(r.ok).toBe(false);
      expect(r.failures.map((f) => f.code)).toContain("missing_asset");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test("fails glossary case enforcement for Official docs", async () => {
      const root = mkTmpDir();
    try {
      const contentDir = path.join(root, "content");
      baseBlocks(contentDir);
      fs.mkdirSync(path.join(root, "public"), { recursive: true });
      write(
        path.join(contentDir, "docs", "a.md"),
        `---\nslug: a\nversion: \"1\"\ntitle: A\nstage: official\nsummary: s\nupdatedAt: \"2026-01-01\"\nlastReviewedAt: \"2026-01-02\"\nowners: [\"o\"]\ntopics: [\"t\"]\ncitations:\n  - label: \"Source\"\napprovals:\n  - name: \"o\"\n    date: \"2026-01-02\"\n---\n\n# A\n\n## H2\nThis is official.\n`,
      );
      const r = await runQa(root, contentDir);
      expect(r.ok).toBe(false);
      expect(r.failures.map((f) => f.code)).toContain("glossary_case");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test("missing_h2 ignores headings inside fenced code blocks", async () => {
    const root = mkTmpDir();
    try {
      const contentDir = path.join(root, "content");
      baseBlocks(contentDir);
      fs.mkdirSync(path.join(root, "public"), { recursive: true });
      write(
        path.join(contentDir, "docs", "a.md"),
        `---\nslug: a\nversion: \"1\"\ntitle: A\nstage: draft\nsummary: s\nupdatedAt: \"2026-01-01\"\nowners: [\"o\"]\ntopics: [\"t\"]\n---\n\n# A\n\n\`\`\`\n## Not really an H2\n\`\`\`\n`,
      );
      const r = await runQa(root, contentDir);
      expect(r.ok).toBe(false);
      expect(r.failures.map((f) => f.code)).toContain("missing_h2");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test("external link validation can be enabled and uses HEAD then GET", async () => {
    const root = mkTmpDir();
    try {
      const contentDir = path.join(root, "content");
      baseBlocks(contentDir);
      fs.mkdirSync(path.join(root, "public"), { recursive: true });
      write(
        path.join(contentDir, "docs", "a.md"),
        `---\nslug: a\nversion: \"1\"\ntitle: A\nstage: draft\nsummary: s\nupdatedAt: \"2026-01-01\"\nowners: [\"o\"]\ntopics: [\"t\"]\n---\n\n# A\n\n## H2\nSee [x](https://example.invalid/foo).\n`,
      );

      const calls: Array<{ url: string; method: string }> = [];
      const fetchImpl: typeof fetch = async (url, init) => {
        calls.push({ url: String(url), method: String(init?.method ?? "GET") });
        return new Response("nope", { status: 500, statusText: "Nope" });
      };

      const r = await runContentQa({
        projectRoot: root,
        contentDir,
        skipExternalLinks: false,
        fetchImpl,
      });
      expect(r.ok).toBe(false);
      expect(r.failures.map((f) => f.code)).toContain("external_link");
      expect(calls[0]?.method).toBe("HEAD");
      expect(calls[1]?.method).toBe("GET");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test("ignores archived docs for structure/metadata gates", async () => {
    const root = mkTmpDir();
    try {
      const contentDir = path.join(root, "content");
      baseBlocks(contentDir);
      fs.mkdirSync(path.join(root, "public"), { recursive: true });

      // Visible doc is valid.
      write(
        path.join(contentDir, "docs", "a.md"),
        `---\nslug: a\nversion: \"1\"\ntitle: A\nstage: draft\nsummary: s\nupdatedAt: \"2026-01-01\"\n---\n\n# A\n\n## H2\nok\n`,
      );

      // Archived doc would be invalid if published (no summary, no H2), but should be ignored.
      write(
        path.join(contentDir, "docs", "b.md"),
        `---\nslug: b\nversion: \"1\"\ntitle: B\nstage: draft\narchived: true\nsummary: s\nupdatedAt: \"2026-01-01\"\n---\n\n# B\n\nNo H2.\n`,
      );

      const r = await runQa(root, contentDir);
      expect(r.ok).toBe(true);
      expect(r.failures).toHaveLength(0);
      expect(r.docsCount).toBe(1);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test("fails when a visible doc links to an archived doc", async () => {
    const root = mkTmpDir();
    try {
      const contentDir = path.join(root, "content");
      baseBlocks(contentDir);
      fs.mkdirSync(path.join(root, "public"), { recursive: true });

      write(
        path.join(contentDir, "docs", "a.md"),
        `---\nslug: a\nversion: \"1\"\ntitle: A\nstage: draft\nsummary: s\nupdatedAt: \"2026-01-01\"\n---\n\n# A\n\n## H2\nSee [b](/docs/b).\n`,
      );

      write(
        path.join(contentDir, "docs", "b.md"),
        `---\nslug: b\nversion: \"1\"\ntitle: B\nstage: draft\narchived: true\nsummary: s\nupdatedAt: \"2026-01-01\"\n---\n\n# B\n\n## H2\nhidden\n`,
      );

      const r = await runQa(root, contentDir);
      expect(r.ok).toBe(false);
      expect(r.failures.map((f) => f.code)).toContain("broken_internal_link");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test("fails on bad relatedSlugs entries that do not exist", async () => {
    const root = mkTmpDir();
    try {
      const contentDir = path.join(root, "content");
      baseBlocks(contentDir);
      fs.mkdirSync(path.join(root, "public"), { recursive: true });

      write(
        path.join(contentDir, "docs", "a.md"),
        `---\nslug: a\nversion: \"1\"\ntitle: A\nstage: draft\nsummary: s\nupdatedAt: \"2026-01-01\"\nrelatedSlugs: [\"missing\"]\n---\n\n# A\n\n## H2\nok\n`,
      );

      const r = await runQa(root, contentDir);
      expect(r.ok).toBe(false);
      expect(r.failures.map((f) => f.code)).toContain("bad_related_slug");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test("canonical facts contradiction scan flags mismatched facts for shared topics (optional)", async () => {
    const root = mkTmpDir();
    try {
      const contentDir = path.join(root, "content");
      baseBlocks(contentDir);
      fs.mkdirSync(path.join(root, "public"), { recursive: true });

      write(
        path.join(contentDir, "docs", "canonical.md"),
        `---\nslug: canonical\nversion: \"1\"\ntitle: Canonical\nstage: official\nsummary: s\nupdatedAt: \"2026-01-01\"\nlastReviewedAt: \"2026-01-02\"\nowners: [\"o\"]\ntopics: [\"t\"]\ncanonicalFor: [\"t\"]\nfacts:\n  rate: \"5%\"\ncitations:\n  - label: \"Source\"\napprovals:\n  - name: \"o\"\n    date: \"2026-01-02\"\n---\n\n# Canonical\n\n## H2\nok\n`,
      );

      write(
        path.join(contentDir, "docs", "other.md"),
        `---\nslug: other\nversion: \"1\"\ntitle: Other\nstage: official\nsummary: s\nupdatedAt: \"2026-01-03\"\nlastReviewedAt: \"2026-01-03\"\nowners: [\"o\"]\ntopics: [\"t\"]\nfacts:\n  rate: \"7%\"\ncitations:\n  - label: \"Source\"\napprovals:\n  - name: \"o\"\n    date: \"2026-01-03\"\n---\n\n# Other\n\n## H2\nok\n`,
      );

      const r = await runQa(root, contentDir);
      expect(r.ok).toBe(false);
      expect(r.failures.map((f) => f.code)).toContain("fact_contradiction");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test("fails when Official doc is missing lastReviewedAt (date is required)", async () => {
    const root = mkTmpDir();
    try {
      const contentDir = path.join(root, "content");
      baseBlocks(contentDir);
      fs.mkdirSync(path.join(root, "public"), { recursive: true });

      write(
        path.join(contentDir, "docs", "a.md"),
        `---\nslug: a\nversion: \"1\"\ntitle: A\nstage: official\nsummary: s\nupdatedAt: \"2026-01-01\"\nowners: [\"o\"]\ntopics: [\"t\"]\nvisibility: public\ncitations:\n  - label: \"Source\"\napprovals:\n  - name: \"o\"\n    date: \"2026-01-02\"\n---\n\n# A\n\n## H2\nok\n`,
      );

      const r = await runQa(root, contentDir);
      expect(r.ok).toBe(false);
      expect(r.failures.map((f) => f.code)).toContain("official_missing_lastReviewedAt");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test("official_claims_no_citations flags numeric/date claims when citations are missing", async () => {
    const root = mkTmpDir();
    try {
      const contentDir = path.join(root, "content");
      baseBlocks(contentDir);
      fs.mkdirSync(path.join(root, "public"), { recursive: true });

      write(
        path.join(contentDir, "docs", "a.md"),
        `---\nslug: a\nversion: \"1\"\ntitle: A\nstage: official\nsummary: s\nupdatedAt: \"2026-01-01\"\nlastReviewedAt: \"2026-01-02\"\nowners: [\"o\"]\ntopics: [\"t\"]\napprovals:\n  - name: \"o\"\n    date: \"2026-01-02\"\n---\n\n# A\n\n## H2\nContains 123 and 2026-01-01.\n`,
      );

      const r = await runQa(root, contentDir);
      expect(r.ok).toBe(false);
      expect(r.failures.map((f) => f.code)).toContain("official_missing_citations");
      expect(r.failures.map((f) => f.code)).toContain("official_claims_no_citations");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test("fails on duplicate canonical docs for the same topic", async () => {
    const root = mkTmpDir();
    try {
      const contentDir = path.join(root, "content");
      baseBlocks(contentDir);
      fs.mkdirSync(path.join(root, "public"), { recursive: true });

      write(
        path.join(contentDir, "docs", "a.md"),
        `---\nslug: a\nversion: \"1\"\ntitle: A\nstage: official\nsummary: s\nupdatedAt: \"2026-01-01\"\nlastReviewedAt: \"2026-01-02\"\nowners: [\"o\"]\ntopics: [\"t\"]\ncanonicalFor: [\"t\"]\ncitations:\n  - label: \"Source\"\napprovals:\n  - name: \"o\"\n    date: \"2026-01-02\"\n---\n\n# A\n\n## H2\nok\n`,
      );
      write(
        path.join(contentDir, "docs", "b.md"),
        `---\nslug: b\nversion: \"1\"\ntitle: B\nstage: official\nsummary: s\nupdatedAt: \"2026-01-03\"\nlastReviewedAt: \"2026-01-03\"\nowners: [\"o\"]\ntopics: [\"t\"]\ncanonicalFor: [\"t\"]\ncitations:\n  - label: \"Source\"\napprovals:\n  - name: \"o\"\n    date: \"2026-01-03\"\n---\n\n# B\n\n## H2\nok\n`,
      );

      const r = await runQa(root, contentDir);
      expect(r.ok).toBe(false);
      expect(r.failures.map((f) => f.code)).toContain("duplicate_canonical");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test("restores AMBER_DOCS_CONTENT_DIR when contentDir option overrides it", async () => {
    const root = mkTmpDir();
    const prev = process.env.AMBER_DOCS_CONTENT_DIR;
    try {
      process.env.AMBER_DOCS_CONTENT_DIR = "/tmp/previous-content-dir";

      const contentDir = path.join(root, "content");
      baseBlocks(contentDir);
      fs.mkdirSync(path.join(root, "public"), { recursive: true });
      write(
        path.join(contentDir, "docs", "a.md"),
        `---\nslug: a\nversion: \"1\"\ntitle: A\nstage: draft\nsummary: s\nupdatedAt: \"2026-01-01\"\n---\n\n# A\n\n## H2\nok\n`,
      );

      const r = await runQa(root, contentDir);
      expect(r.ok).toBe(true);
      expect(process.env.AMBER_DOCS_CONTENT_DIR).toBe("/tmp/previous-content-dir");
    } finally {
      if (prev === undefined) delete process.env.AMBER_DOCS_CONTENT_DIR;
      else process.env.AMBER_DOCS_CONTENT_DIR = prev;
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
