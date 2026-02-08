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
});
