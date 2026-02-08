import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";

function mkTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "amber-docs-scripts-"));
}

function write(file: string, body: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body, "utf8");
}

function baseContent(dir: string) {
  write(path.join(dir, "blocks", "disclaimers.json"), "[]\n");
  write(path.join(dir, "blocks", "glossary.json"), "[]\n");
}

describe("scripts (import-safe wrappers)", () => {
  const prevContent = process.env.AMBER_DOCS_CONTENT_DIR;
  const prevUrl = process.env.DOCS_WEBHOOK_URL;
  const prevSecret = process.env.DOCS_WEBHOOK_SECRET;
  const prevEvent = process.env.DOCS_WEBHOOK_EVENT;
  const prevOutDir = process.env.OUT_DIR;
  const prevExitCode = process.exitCode;

  afterEach(() => {
    if (prevContent === undefined) delete process.env.AMBER_DOCS_CONTENT_DIR;
    else process.env.AMBER_DOCS_CONTENT_DIR = prevContent;
    if (prevUrl === undefined) delete process.env.DOCS_WEBHOOK_URL;
    else process.env.DOCS_WEBHOOK_URL = prevUrl;
    if (prevSecret === undefined) delete process.env.DOCS_WEBHOOK_SECRET;
    else process.env.DOCS_WEBHOOK_SECRET = prevSecret;
    if (prevEvent === undefined) delete process.env.DOCS_WEBHOOK_EVENT;
    else process.env.DOCS_WEBHOOK_EVENT = prevEvent;
    if (prevOutDir === undefined) delete process.env.OUT_DIR;
    else process.env.OUT_DIR = prevOutDir;

    process.exitCode = prevExitCode;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  test("scripts/content-qa sets exitCode=1 on failures", async () => {
    const root = mkTmpDir();
    try {
      process.exitCode = undefined;
      process.env.AMBER_DOCS_CONTENT_DIR = path.join(root, "content");
      baseContent(process.env.AMBER_DOCS_CONTENT_DIR);
      write(
        path.join(process.env.AMBER_DOCS_CONTENT_DIR, "docs", "a.md"),
        `---\nslug: a\nversion: \"1\"\ntitle: A\nstage: official\nsummary: s\nupdatedAt: \"2026-01-01\"\nlastReviewedAt: \"2026-01-02\"\nowners: [\"o\"]\ntopics: [\"t\"]\ncitations:\n  - label: \"Source\"\n---\n\n# A\n\n## H2\nok\n`,
      );

      const log = vi.spyOn(console, "log").mockImplementation(() => {});
      const err = vi.spyOn(console, "error").mockImplementation(() => {});

      const { main } = await import("../scripts/content-qa");
      await main();
      expect(process.exitCode).toBe(1);
      expect(err).toHaveBeenCalled();
      expect(log).not.toHaveBeenCalled();
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test("scripts/content-qa logs success on clean content", async () => {
    const root = mkTmpDir();
    try {
      process.exitCode = undefined;
      process.env.AMBER_DOCS_CONTENT_DIR = path.join(root, "content");
      baseContent(process.env.AMBER_DOCS_CONTENT_DIR);
      write(
        path.join(process.env.AMBER_DOCS_CONTENT_DIR, "docs", "a.md"),
        `---\nslug: a\nversion: \"1\"\ntitle: A\nstage: draft\nsummary: s\nupdatedAt: \"2026-01-01\"\n---\n\n# A\n\n## H2\nok\n`,
      );

      const log = vi.spyOn(console, "log").mockImplementation(() => {});
      const err = vi.spyOn(console, "error").mockImplementation(() => {});

      const { main } = await import("../scripts/content-qa");
      await main();
      expect(process.exitCode).toBeUndefined();
      expect(err).not.toHaveBeenCalled();
      expect(log).toHaveBeenCalled();
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test("scripts/send-webhook posts and does not set exitCode on success", async () => {
    const root = mkTmpDir();
    try {
      process.exitCode = undefined;
      process.env.AMBER_DOCS_CONTENT_DIR = path.join(root, "content");
      baseContent(process.env.AMBER_DOCS_CONTENT_DIR);
      write(
        path.join(process.env.AMBER_DOCS_CONTENT_DIR, "docs", "a.md"),
        `---\nslug: a\nversion: \"1\"\ntitle: A\nstage: draft\nsummary: s\nupdatedAt: \"2026-01-01\"\n---\n\n# A\n\n## H2\nok\n`,
      );

      process.env.DOCS_WEBHOOK_URL = "https://example.test/webhook";
      process.env.DOCS_WEBHOOK_SECRET = "secret";
      process.env.DOCS_WEBHOOK_EVENT = "docs.updated";

      const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
        async () => new Response("ok", { status: 200 }),
      );
      vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
      const log = vi.spyOn(console, "log").mockImplementation(() => {});

      const { main } = await import("../scripts/send-webhook");
      await main();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(process.exitCode).toBeUndefined();
      expect(log).toHaveBeenCalled();
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test("scripts/docs-workflow new creates an unpublished doc file", async () => {
    const root = mkTmpDir();
    try {
      process.exitCode = undefined;
      process.env.AMBER_DOCS_CONTENT_DIR = path.join(root, "content");

      const log = vi.spyOn(console, "log").mockImplementation(() => {});
      const err = vi.spyOn(console, "error").mockImplementation(() => {});

      const { main } = await import("../scripts/docs-workflow");
      await main([
        "new",
        "--slug",
        "a",
        "--title",
        "A",
        "--summary",
        "s",
        "--updated-at",
        "2026-01-01",
      ]);

      expect(process.exitCode).toBeUndefined();
      expect(err).not.toHaveBeenCalled();
      expect(log).toHaveBeenCalled();

      const created = path.join(process.env.AMBER_DOCS_CONTENT_DIR, "docs", "a--2026-01-01.md");
      expect(fs.existsSync(created)).toBe(true);
      const body = fs.readFileSync(created, "utf8");
      expect(body).toContain("archived: true");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test("scripts/docs-workflow supports publish, stage changes, clone, update, and deletes", async () => {
    const root = mkTmpDir();
    try {
      process.env.AMBER_DOCS_CONTENT_DIR = path.join(root, "content");
      process.exitCode = undefined;

      const log = vi.spyOn(console, "log").mockImplementation(() => {});
      const err = vi.spyOn(console, "error").mockImplementation(() => {});

      const { main } = await import("../scripts/docs-workflow");

      // Create (unpublished by default).
      await main(["new", "--slug=a", "--title=A", "--summary=s", "--updated-at=2026-01-01"]);
      expect(err).not.toHaveBeenCalled();
      expect(process.exitCode).toBeUndefined();

      const file = path.join(process.env.AMBER_DOCS_CONTENT_DIR, "docs", "a--2026-01-01.md");
      expect(fs.existsSync(file)).toBe(true);

      // Publish.
      await main(["publish", "--slug", "a", "--version", "2026-01-01"]);
      expect(fs.readFileSync(file, "utf8")).toContain("archived: false");

      // Finalize and then Official (with reviewedAt).
      await main(["finalize", "--slug", "a", "--version", "2026-01-01"]);
      expect(fs.readFileSync(file, "utf8")).toContain("stage: final");

      await main([
        "official",
        "--slug",
        "a",
        "--version",
        "2026-01-01",
        "--reviewed-at",
        "2026-01-02",
        "--approvals",
        "alice:2026-01-02",
      ]);
      const afterOfficial = fs.readFileSync(file, "utf8");
      expect(afterOfficial).toContain("stage: official");
      expect(afterOfficial).toMatch(/lastReviewedAt:\s+['"]?2026-01-02['"]?/);

      // Update summary + lists and explicitly unpublish via --published=false.
      await main([
        "update",
        "--slug",
        "a",
        "--version",
        "2026-01-01",
        "--summary",
        "s2",
        "--owners",
        "bob",
        "--topics",
        "t1,t2",
        "--published",
        "false",
      ]);
      const afterUpdate = fs.readFileSync(file, "utf8");
      expect(afterUpdate).toContain("summary: s2");
      expect(afterUpdate).toContain("archived: true");
      expect(afterUpdate).toContain("- bob");
      expect(afterUpdate).toContain("- t1");

      // Clone and delete.
      await main(["clone", "--slug", "a", "--new-version", "2026-01-03", "--from-archived"]);
      const cloneFile = path.join(process.env.AMBER_DOCS_CONTENT_DIR, "docs", "a--2026-01-03.md");
      expect(fs.existsSync(cloneFile)).toBe(true);

      await main(["delete", "--slug", "a", "--version", "2026-01-03"]);
      expect(fs.existsSync(cloneFile)).toBe(false);

      await main(["delete-all", "--slug", "a"]);
      expect(fs.existsSync(file)).toBe(false);

      // Unknown command should set exit code (and print usage).
      process.exitCode = undefined;
      await main(["nope"]);
      expect(process.exitCode).toBe(1);
      expect(log).toHaveBeenCalled();
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test("scripts/docs-workflow covers edge-case parsing and error handling", async () => {
    const root = mkTmpDir();
    try {
      process.env.AMBER_DOCS_CONTENT_DIR = path.join(root, "content");
      process.exitCode = undefined;

      const log = vi.spyOn(console, "log").mockImplementation(() => {});
      const err = vi.spyOn(console, "error").mockImplementation(() => {});

      const { main } = await import("../scripts/docs-workflow");

      // Usage (no args).
      await main([]);
      expect(log).toHaveBeenCalled();
      expect(process.exitCode).toBeUndefined();

      // Missing required flags triggers an error path.
      process.exitCode = undefined;
      await main(["new"]);
      expect(process.exitCode).toBe(1);
      expect(err).toHaveBeenCalled();

      // Create a doc so we can hit update/archiving branches.
      process.exitCode = undefined;
      await main(["new", "--slug", "a", "--title", "A", "--summary", "s", "--updated-at", "2026-01-01"]);
      await main(["publish", "--slug", "a", "--version", "2026-01-01"]);

      const file = path.join(process.env.AMBER_DOCS_CONTENT_DIR, "docs", "a--2026-01-01.md");
      const mdFile = path.join(root, "patch.md");
      write(mdFile, "# Patched\n\n## H2\nok\n");

      // --markdown-file branch + --archived boolean flag branch.
      await main(["update", "--slug", "a", "--version", "2026-01-01", "--archived", "--markdown-file", mdFile]);
      const updated = fs.readFileSync(file, "utf8");
      expect(updated).toContain("archived: true");
      expect(updated).toContain("# Patched");

      // --published boolean flag branch.
      await main(["update", "--slug", "a", "--version", "2026-01-01", "--published"]);
      expect(fs.readFileSync(file, "utf8")).toContain("archived: false");

      // archive alias (unpublish).
      await main(["archive", "--slug", "a", "--version", "2026-01-01"]);
      expect(fs.readFileSync(file, "utf8")).toContain("archived: true");

      // Invalid stage and invalid order both surface helpful errors.
      process.exitCode = undefined;
      await main(["update", "--slug", "a", "--version", "2026-01-01", "--stage", "nope"]);
      expect(process.exitCode).toBe(1);

      // Valid order assignment hits the happy path.
      process.exitCode = undefined;
      await main(["update", "--slug", "a", "--version", "2026-01-01", "--order", "2"]);
      expect(process.exitCode).toBeUndefined();
      expect(fs.readFileSync(file, "utf8")).toContain("order: 2");

      process.exitCode = undefined;
      await main(["update", "--slug", "a", "--version", "2026-01-01", "--order", "0"]);
      expect(process.exitCode).toBe(1);

      // Invalid boolean values are rejected.
      process.exitCode = undefined;
      await main(["update", "--slug", "a", "--version", "2026-01-01", "--archived", "wat"]);
      expect(process.exitCode).toBe(1);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test("scripts/perf-budget sets exitCode=1 when out dir is missing", async () => {
    const root = mkTmpDir();
    try {
      process.exitCode = undefined;
      process.env.OUT_DIR = path.join(root, "missing-out");
      const err = vi.spyOn(console, "error").mockImplementation(() => {});
      const log = vi.spyOn(console, "log").mockImplementation(() => {});

      const { main } = await import("../scripts/perf-budget");
      await main();

      expect(process.exitCode).toBe(1);
      expect(err).toHaveBeenCalled();
      expect(log).not.toHaveBeenCalled();
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test("scripts/perf-budget passes on small exports and fails on an oversized file", async () => {
    const root = mkTmpDir();
    try {
      const outDir = path.join(root, "out");
      fs.mkdirSync(outDir, { recursive: true });
      process.env.OUT_DIR = outDir;

      const small = JSON.stringify({ ok: true }) + "\n";
      write(path.join(outDir, "docs.json"), small);
      write(path.join(outDir, "search-index.json"), "[]\n");
      write(path.join(outDir, "chunks.json"), "[]\n");
      write(path.join(outDir, "embeddings-manifest.json"), "[]\n");
      write(path.join(outDir, "claims.json"), "[]\n");
      write(path.join(outDir, "updates.json"), "[]\n");
      write(path.join(outDir, "synonyms.json"), "{}\n");

      const err = vi.spyOn(console, "error").mockImplementation(() => {});
      const log = vi.spyOn(console, "log").mockImplementation(() => {});

      const { main } = await import("../scripts/perf-budget");
      process.exitCode = undefined;
      await main();
      expect(process.exitCode).toBeUndefined();
      expect(err).not.toHaveBeenCalled();
      expect(log).toHaveBeenCalled();

      // updates.json has a 256KB budget: exceed it.
      write(path.join(outDir, "updates.json"), "x".repeat(300 * 1024));
      process.exitCode = undefined;
      await main();
      expect(process.exitCode).toBe(1);
      expect(err).toHaveBeenCalled();
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
