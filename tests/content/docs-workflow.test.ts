import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";

function mkTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "amber-docs-workflow-"));
}

function cleanup(dir: string) {
  fs.rmSync(dir, { recursive: true, force: true });
}

afterEach(() => {
  delete process.env.AMBER_DOCS_CONTENT_DIR;
  delete process.env.AMBER_DOCS_ACTOR;
  vi.resetModules();
});

describe("docsWorkflow (file lifecycle)", () => {
  test("createDocFile creates an unpublished draft by default with a safe filename", async () => {
    const dir = mkTmpDir();
    try {
      process.env.AMBER_DOCS_CONTENT_DIR = dir;
      const mod = await import("../../src/lib/content/docsWorkflow.server");

      const r = mod.createDocFile({
        slug: "hello world",
        title: "Hello",
        summary: "s",
        updatedAt: "2026-01-03",
      });

      expect(r.version).toBe("2026-01-03");
      expect(path.basename(r.filePath)).toBe("hello-world--2026-01-03.md");
      expect(fs.existsSync(r.filePath)).toBe(true);

      const parsed = mod.readDocFile(r.filePath);
      expect(parsed.frontmatter.slug).toBe("hello world");
      expect(parsed.frontmatter.version).toBe("2026-01-03");
      expect(parsed.frontmatter.stage).toBe("draft");
      expect(parsed.frontmatter.archived).toBe(true);
      expect(parsed.frontmatter.summary).toBe("s");
      expect(parsed.frontmatter.updatedAt).toBe("2026-01-03");

      expect(() =>
        mod.createDocFile({
          slug: "hello world",
          title: "Hello",
          summary: "s",
          updatedAt: "2026-01-03",
          version: "2026-01-03",
        }),
      ).toThrow(/already exists/i);
    } finally {
      cleanup(dir);
    }
  });

  test("createDocFile rejects passing both archived and published", async () => {
    const dir = mkTmpDir();
    try {
      process.env.AMBER_DOCS_CONTENT_DIR = dir;
      const mod = await import("../../src/lib/content/docsWorkflow.server");
      expect(() =>
        mod.createDocFile({
          slug: "a",
          title: "A",
          summary: "s",
          archived: true,
          published: true,
        }),
      ).toThrow(/only one of/i);
    } finally {
      cleanup(dir);
    }
  });

  test("cloneLatestToNewVersion clones latest published by default and can opt into archived base", async () => {
    const dir = mkTmpDir();
    try {
      process.env.AMBER_DOCS_CONTENT_DIR = dir;
      const wf = await import("../../src/lib/content/docsWorkflow.server");
      const docs = await import("../../src/lib/content/docs.server");

      const v1 = wf.createDocFile({
        slug: "a",
        title: "A",
        summary: "s",
        updatedAt: "2026-01-01",
        markdown: "# A\n\n## H2\nv1\n",
        published: true,
      });
      const v2 = wf.createDocFile({
        slug: "a",
        title: "A",
        summary: "s",
        updatedAt: "2026-01-05",
        markdown: "# A\n\n## H2\nv2\n",
        // stays unpublished
      });

      // Sanity: visible latest should be v1 (v2 is archived/unpublished).
      expect(docs.getLatestDoc("a")?.version).toBe(v1.version);

      const c2 = wf.cloneLatestToNewVersion({ slug: "a", newVersion: "2026-01-06", fromArchived: true });
      expect(c2.from.version).toBe(v2.version);
      const p2 = wf.readDocFile(c2.filePath);
      expect(p2.markdown).toContain("v2");

      const c1 = wf.cloneLatestToNewVersion({ slug: "a", newVersion: "2026-01-07" });
      expect(c1.from.version).toBe(v1.version);
      expect(fs.existsSync(c1.filePath)).toBe(true);
      const p1 = wf.readDocFile(c1.filePath);
      expect(p1.frontmatter.version).toBe("2026-01-07");
      expect(p1.frontmatter.stage).toBe("draft");
      expect(p1.frontmatter.archived).toBe(true);
      expect(p1.markdown).toContain("v1");
    } finally {
      cleanup(dir);
    }
  });

  test("updateDocFile patches frontmatter and markdown", async () => {
    const dir = mkTmpDir();
    try {
      process.env.AMBER_DOCS_CONTENT_DIR = dir;
      const wf = await import("../../src/lib/content/docsWorkflow.server");

      const created = wf.createDocFile({
        slug: "a",
        title: "A",
        summary: "s",
        updatedAt: "2026-01-01",
        published: true,
        markdown: "# A\n\n## H2\nold\n",
      });

      wf.updateDocFile({
        slug: "a",
        version: created.version,
        patchFrontmatter: { title: "A2", summary: "s2" },
        patchMarkdown: "# A2\n\n## H2\nnew\n",
      });

      const parsed = wf.readDocFile(created.filePath);
      expect(parsed.frontmatter.title).toBe("A2");
      expect(parsed.frontmatter.summary).toBe("s2");
      expect(parsed.markdown).toContain("new");
    } finally {
      cleanup(dir);
    }
  });

  test("promoteDocVersionToOfficial sets stage, lastReviewedAt, and approvals", async () => {
    const dir = mkTmpDir();
    try {
      process.env.AMBER_DOCS_CONTENT_DIR = dir;
      const wf = await import("../../src/lib/content/docsWorkflow.server");

      const created = wf.createDocFile({
        slug: "a",
        title: "A",
        summary: "s",
        updatedAt: "2026-01-01",
        published: true,
      });

      wf.promoteDocVersionToOfficial({
        slug: "a",
        version: created.version,
        reviewedAt: "2026-01-02",
        approvals: [{ name: "alice", date: "2026-01-02" }],
      });

      const parsed = wf.readDocFile(created.filePath);
      expect(parsed.frontmatter.stage).toBe("official");
      expect(parsed.frontmatter.lastReviewedAt).toBe("2026-01-02");
      expect(Array.isArray(parsed.frontmatter.approvals)).toBe(true);
    } finally {
      cleanup(dir);
    }
  });

  test("audit log entries are appended for lifecycle actions when actor is provided", async () => {
    const dir = mkTmpDir();
    try {
      process.env.AMBER_DOCS_CONTENT_DIR = dir;
      process.env.AMBER_DOCS_ACTOR = "Tester";
      const wf = await import("../../src/lib/content/docsWorkflow.server");

      const created = wf.createDocFile({
        slug: "a",
        title: "A",
        summary: "s",
        updatedAt: "2026-01-01",
      });
      let parsed = wf.readDocFile(created.filePath);
      expect(Array.isArray(parsed.frontmatter.audit)).toBe(true);
      expect((parsed.frontmatter.audit as Array<{ action?: string; actor?: string }>)[0]?.action).toBe("create");
      expect((parsed.frontmatter.audit as Array<{ action?: string; actor?: string }>)[0]?.actor).toBe("Tester");

      wf.publishDocVersion({ slug: "a", version: created.version });
      parsed = wf.readDocFile(created.filePath);
      expect((parsed.frontmatter.audit as Array<{ action?: string }>).some((a) => a.action === "publish")).toBe(true);

      wf.finalizeDocVersion({ slug: "a", version: created.version });
      parsed = wf.readDocFile(created.filePath);
      expect((parsed.frontmatter.audit as Array<{ action?: string }>).some((a) => a.action === "set_stage")).toBe(true);
    } finally {
      cleanup(dir);
    }
  });

  test("publish/unpublish toggles visibility in the docs loader", async () => {
    const dir = mkTmpDir();
    try {
      process.env.AMBER_DOCS_CONTENT_DIR = dir;
      const wf = await import("../../src/lib/content/docsWorkflow.server");
      const docs = await import("../../src/lib/content/docs.server");

      const created = wf.createDocFile({
        slug: "a",
        title: "A",
        summary: "s",
        updatedAt: "2026-01-01",
      });

      expect(docs.getLatestDoc("a")).toBeNull();
      expect(docs.getLatestDoc("a", { includeArchived: true })?.version).toBe(created.version);

      wf.publishDocVersion({ slug: "a", version: created.version });
      expect(docs.getLatestDoc("a")?.version).toBe(created.version);

      wf.unpublishDocVersion({ slug: "a", version: created.version });
      expect(docs.getLatestDoc("a")).toBeNull();
    } finally {
      cleanup(dir);
    }
  });

  test("finalizeDocVersion clears lastReviewedAt when moving from official to final", async () => {
    const dir = mkTmpDir();
    try {
      process.env.AMBER_DOCS_CONTENT_DIR = dir;
      const wf = await import("../../src/lib/content/docsWorkflow.server");

      const created = wf.createDocFile({
        slug: "a",
        title: "A",
        summary: "s",
        updatedAt: "2026-01-01",
        published: true,
      });

      wf.promoteDocVersionToOfficial({
        slug: "a",
        version: created.version,
        reviewedAt: "2026-01-02",
        approvals: [{ name: "alice", date: "2026-01-02" }],
      });

      let parsed = wf.readDocFile(created.filePath);
      expect(parsed.frontmatter.stage).toBe("official");
      expect(parsed.frontmatter.lastReviewedAt).toBe("2026-01-02");

      wf.finalizeDocVersion({ slug: "a", version: created.version });
      parsed = wf.readDocFile(created.filePath);
      expect(parsed.frontmatter.stage).toBe("final");
      expect(parsed.frontmatter.lastReviewedAt).toBeUndefined();
    } finally {
      cleanup(dir);
    }
  });

  test("promoteDocVersionToOfficial defaults reviewedAt to today when omitted", async () => {
    const dir = mkTmpDir();
    try {
      process.env.AMBER_DOCS_CONTENT_DIR = dir;
      const wf = await import("../../src/lib/content/docsWorkflow.server");

      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-02-08T12:00:00"));

      const created = wf.createDocFile({
        slug: "a",
        title: "A",
        summary: "s",
        updatedAt: "2026-02-01",
        published: true,
      });

      wf.promoteDocVersionToOfficial({ slug: "a", version: created.version });
      const parsed = wf.readDocFile(created.filePath);
      expect(parsed.frontmatter.stage).toBe("official");
      expect(parsed.frontmatter.lastReviewedAt).toBe("2026-02-08");
    } finally {
      vi.useRealTimers();
      cleanup(dir);
    }
  });

  test("deleteDocVersion and deleteAllDocVersions remove files", async () => {
    const dir = mkTmpDir();
    try {
      process.env.AMBER_DOCS_CONTENT_DIR = dir;
      const wf = await import("../../src/lib/content/docsWorkflow.server");

      const v1 = wf.createDocFile({ slug: "a", title: "A", summary: "s", updatedAt: "2026-01-01", published: true });
      const v2 = wf.createDocFile({ slug: "a", title: "A", summary: "s", updatedAt: "2026-01-02", published: true });
      expect(fs.existsSync(v1.filePath)).toBe(true);
      expect(fs.existsSync(v2.filePath)).toBe(true);

      wf.deleteDocVersion({ slug: "a", version: v1.version });
      expect(fs.existsSync(v1.filePath)).toBe(false);
      expect(fs.existsSync(v2.filePath)).toBe(true);

      wf.deleteAllDocVersions({ slug: "a" });
      expect(fs.existsSync(v2.filePath)).toBe(false);
    } finally {
      cleanup(dir);
    }
  });

  test("parseStage accepts known stages and rejects others", async () => {
    const mod = await import("../../src/lib/content/docsWorkflow.server");
    expect(mod.parseStage("draft")).toBe("draft");
    expect(mod.parseStage("final")).toBe("final");
    expect(mod.parseStage("official")).toBe("official");
    expect(() => mod.parseStage("nope")).toThrow(/invalid stage/i);
  });

  test("createDocFile fails when the target filename already exists (even if frontmatter does not match)", async () => {
    const dir = mkTmpDir();
    try {
      process.env.AMBER_DOCS_CONTENT_DIR = dir;
      const wf = await import("../../src/lib/content/docsWorkflow.server");

      const existingPath = path.join(dir, "docs", "a--2026-01-01.md");
      fs.mkdirSync(path.dirname(existingPath), { recursive: true });
      fs.writeFileSync(
        existingPath,
        `---\nslug: other\nversion: \"x\"\ntitle: Other\nstage: draft\nsummary: s\nupdatedAt: \"2026-01-01\"\n---\n\n# Other\n\n## H2\nx\n`,
        "utf8",
      );

      expect(() =>
        wf.createDocFile({
          slug: "a",
          title: "A",
          summary: "s",
          updatedAt: "2026-01-01",
          published: true,
        }),
      ).toThrow(/file already exists/i);
    } finally {
      cleanup(dir);
    }
  });

  test("cloneLatestToNewVersion rejects duplicate target versions and conflicting lifecycle flags", async () => {
    const dir = mkTmpDir();
    try {
      process.env.AMBER_DOCS_CONTENT_DIR = dir;
      const wf = await import("../../src/lib/content/docsWorkflow.server");

      wf.createDocFile({ slug: "a", title: "A", summary: "s", updatedAt: "2026-01-01", published: true });

      expect(() => wf.cloneLatestToNewVersion({ slug: "a", newVersion: "2026-01-01" })).toThrow(/already exists/i);

      expect(() =>
        wf.cloneLatestToNewVersion({ slug: "a", newVersion: "2026-01-02", archived: true, published: true }),
      ).toThrow(/only one of/i);
    } finally {
      cleanup(dir);
    }
  });
});
