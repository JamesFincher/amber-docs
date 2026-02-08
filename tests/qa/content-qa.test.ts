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
});
