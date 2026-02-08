import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

function mkTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "amber-docs-templates-"));
}

function write(file: string, body: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body, "utf8");
}

describe("templates loader", () => {
  const prev = process.env.AMBER_DOCS_CONTENT_DIR;

  afterEach(() => {
    if (prev === undefined) delete process.env.AMBER_DOCS_CONTENT_DIR;
    else process.env.AMBER_DOCS_CONTENT_DIR = prev;
  });

  test("returns [] when templates/ dir does not exist", async () => {
    const dir = mkTmpDir();
    try {
      process.env.AMBER_DOCS_CONTENT_DIR = dir;
      const { loadTemplates } = await import("../../src/lib/content/templates.server");
      expect(loadTemplates()).toEqual([]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("loads and sorts templates by name and defaults tags", async () => {
    const dir = mkTmpDir();
    try {
      process.env.AMBER_DOCS_CONTENT_DIR = dir;
      write(
        path.join(dir, "templates", "b.json"),
        JSON.stringify(
          {
            id: "b",
            name: "B Template",
            description: "d",
            requiredFields: [{ key: "k", label: "L", placeholder: "P" }],
            sections: [{ title: "One" }],
          },
          null,
          2,
        ),
      );
      write(
        path.join(dir, "templates", "a.json"),
        JSON.stringify(
          {
            id: "a",
            name: "A Template",
            description: "d",
            tags: ["x"],
            requiredFields: [{ key: "k", label: "L", placeholder: "P" }],
            sections: [{ title: "One" }],
          },
          null,
          2,
        ),
      );

      const { loadTemplates } = await import("../../src/lib/content/templates.server");
      const out = loadTemplates();
      expect(out.map((t) => t.name)).toEqual(["A Template", "B Template"]);
      expect(out[1].tags).toEqual([]); // defaulted
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

