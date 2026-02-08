import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

function mkTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "amber-docs-synonyms-"));
}

function write(file: string, body: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body, "utf8");
}

describe("synonyms loader", () => {
  const prev = process.env.AMBER_DOCS_CONTENT_DIR;

  afterEach(() => {
    if (prev === undefined) delete process.env.AMBER_DOCS_CONTENT_DIR;
    else process.env.AMBER_DOCS_CONTENT_DIR = prev;
  });

  test("returns {} when synonyms.json is missing", async () => {
    const dir = mkTmpDir();
    try {
      process.env.AMBER_DOCS_CONTENT_DIR = dir;
      const { loadSynonyms } = await import("../../src/lib/content/search.server");
      expect(loadSynonyms()).toEqual({});
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("parses a synonyms mapping", async () => {
    const dir = mkTmpDir();
    try {
      process.env.AMBER_DOCS_CONTENT_DIR = dir;
      write(path.join(dir, "search", "synonyms.json"), JSON.stringify({ ai: ["artificial intelligence"] }, null, 2));
      const { loadSynonyms } = await import("../../src/lib/content/search.server");
      expect(loadSynonyms()).toEqual({ ai: ["artificial intelligence"] });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

