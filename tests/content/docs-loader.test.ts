import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

function mkTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "amber-docs-content-"));
}

function write(file: string, body: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body, "utf8");
}

function withEnv(dir: string, fn: () => void) {
  const prev = process.env.AMBER_DOCS_CONTENT_DIR;
  process.env.AMBER_DOCS_CONTENT_DIR = dir;
  try {
    fn();
  } finally {
    if (prev === undefined) delete process.env.AMBER_DOCS_CONTENT_DIR;
    else process.env.AMBER_DOCS_CONTENT_DIR = prev;
  }
}

function cleanup(dir: string) {
  fs.rmSync(dir, { recursive: true, force: true });
}

afterEach(() => {
  // Ensure cross-test isolation for loaders that cache by env root.
  delete process.env.AMBER_DOCS_CONTENT_DIR;
});

describe("docs loader (file-based)", () => {
  test("loads multiple versions and picks latest by updatedAt", async () => {
    const dir = mkTmpDir();
    try {
      write(
        path.join(dir, "docs", "a-v1.md"),
        `---\nslug: a\nversion: \"1\"\ntitle: A\nstage: draft\nsummary: s\nupdatedAt: \"2026-01-01\"\nowners: [\"o\"]\ntopics: [\"t\"]\n---\n\n# A\n\n## H2\nx\n`,
      );
      write(
        path.join(dir, "docs", "a-v2.md"),
        `---\nslug: a\nversion: \"2\"\ntitle: A\nstage: final\nsummary: s\nupdatedAt: \"2026-02-01\"\nowners: [\"o\"]\ntopics: [\"t\"]\n---\n\n# A\n\n## H2\nx\n`,
      );

      // Import inside env wrapper so the module reads the correct root.
      await (async () => {
        withEnv(dir, () => {});
        const mod = await import("../../src/lib/content/docs.server");
        withEnv(dir, () => {
          const versions = mod.listDocVersions("a");
          expect(versions.map((d) => d.version)).toEqual(["2", "1"]);
          const latest = mod.getLatestDoc("a");
          expect(latest?.version).toBe("2");
          expect(mod.listDocSlugs()).toEqual(["a"]);
        });
      })();
    } finally {
      cleanup(dir);
    }
  });

  test("throws a helpful error on invalid frontmatter", async () => {
    const dir = mkTmpDir();
    try {
      write(path.join(dir, "docs", "bad.md"), `---\ntitle: Missing slug\n---\n\n# T\n\n## H2\nx\n`);
      await (async () => {
        withEnv(dir, () => {});
        const mod = await import("../../src/lib/content/docs.server");
        expect(() => {
          withEnv(dir, () => {
            mod.loadAllDocs();
          });
        }).toThrow(/Invalid frontmatter/);
      })();
    } finally {
      cleanup(dir);
    }
  });
});

