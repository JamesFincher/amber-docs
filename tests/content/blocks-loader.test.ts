import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

function mkTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "amber-docs-blocks-"));
}

function write(file: string, body: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body, "utf8");
}

describe("blocks loaders", () => {
  const prev = process.env.AMBER_DOCS_CONTENT_DIR;

  afterEach(() => {
    if (prev === undefined) delete process.env.AMBER_DOCS_CONTENT_DIR;
    else process.env.AMBER_DOCS_CONTENT_DIR = prev;
  });

  test("loadDisclaimers defaults tags to []", async () => {
    const dir = mkTmpDir();
    try {
      process.env.AMBER_DOCS_CONTENT_DIR = dir;
      write(
        path.join(dir, "blocks", "disclaimers.json"),
        JSON.stringify([{ id: "d1", title: "T", body: "B" }], null, 2),
      );
      write(path.join(dir, "blocks", "glossary.json"), "[]\n");

      const { loadDisclaimers } = await import("../../src/lib/content/blocks.server");
      const out = loadDisclaimers();
      expect(out).toHaveLength(1);
      expect(out[0].tags).toEqual([]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("loadGlossary defaults synonyms/tags to []", async () => {
    const dir = mkTmpDir();
    try {
      process.env.AMBER_DOCS_CONTENT_DIR = dir;
      write(path.join(dir, "blocks", "disclaimers.json"), "[]\n");
      write(
        path.join(dir, "blocks", "glossary.json"),
        JSON.stringify([{ term: "X", definition: "Y" }], null, 2),
      );

      const { loadGlossary } = await import("../../src/lib/content/blocks.server");
      const out = loadGlossary();
      expect(out).toHaveLength(1);
      expect(out[0].synonyms).toEqual([]);
      expect(out[0].tags).toEqual([]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

