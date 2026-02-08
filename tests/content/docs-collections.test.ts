import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

function mkTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "amber-docs-collections-"));
}

function write(file: string, body: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body, "utf8");
}

function cleanup(dir: string) {
  fs.rmSync(dir, { recursive: true, force: true });
}

afterEach(() => {
  delete process.env.AMBER_DOCS_CONTENT_DIR;
});

describe("collections helpers", () => {
  test("listCollections groups latest docs, sorts by order/title, and puts Uncategorized last", async () => {
    const dir = mkTmpDir();
    try {
      process.env.AMBER_DOCS_CONTENT_DIR = dir;
      write(
        path.join(dir, "docs", "a.md"),
        `---\nslug: a\nversion: \"1\"\ntitle: A\nstage: draft\nsummary: s\nupdatedAt: \"2026-01-01\"\ncollection: \"Path\"\norder: 2\n---\n\n# A\n\n## H2\nx\n`,
      );
      write(
        path.join(dir, "docs", "b.md"),
        `---\nslug: b\nversion: \"1\"\ntitle: B\nstage: draft\nsummary: s\nupdatedAt: \"2026-01-02\"\ncollection: \"Path\"\norder: 1\n---\n\n# B\n\n## H2\nx\n`,
      );
      write(
        path.join(dir, "docs", "c.md"),
        `---\nslug: c\nversion: \"1\"\ntitle: C\nstage: draft\nsummary: s\nupdatedAt: \"2026-01-03\"\n---\n\n# C\n\n## H2\nx\n`,
      );

      const mod = await import("../../src/lib/content/docs.server");
      const cols = mod.listCollections();
      expect(cols.map((c) => c.name)).toEqual(["Path", "Uncategorized"]);

      const pathCol = cols[0];
      if (!pathCol) throw new Error("missing Path collection");
      expect(pathCol.docs.map((d) => d.slug)).toEqual(["b", "a"]);
    } finally {
      cleanup(dir);
    }
  });

  test("getPrevNextInCollection returns prev/next within a collection", async () => {
    const dir = mkTmpDir();
    try {
      process.env.AMBER_DOCS_CONTENT_DIR = dir;
      write(
        path.join(dir, "docs", "a.md"),
        `---\nslug: a\nversion: \"1\"\ntitle: A\nstage: draft\nsummary: s\nupdatedAt: \"2026-01-01\"\ncollection: \"Path\"\norder: 2\n---\n\n# A\n\n## H2\nx\n`,
      );
      write(
        path.join(dir, "docs", "b.md"),
        `---\nslug: b\nversion: \"1\"\ntitle: B\nstage: draft\nsummary: s\nupdatedAt: \"2026-01-02\"\ncollection: \"Path\"\norder: 1\n---\n\n# B\n\n## H2\nx\n`,
      );

      const mod = await import("../../src/lib/content/docs.server");
      const b = mod.getLatestDoc("b");
      const a = mod.getLatestDoc("a");
      if (!a || !b) throw new Error("missing docs");

      const bNav = mod.getPrevNextInCollection(b);
      expect(bNav.prev).toBeNull();
      expect(bNav.next?.slug).toBe("a");

      const aNav = mod.getPrevNextInCollection(a);
      expect(aNav.prev?.slug).toBe("b");
      expect(aNav.next).toBeNull();

      // Missing collection should be safe.
      const none = mod.getPrevNextInCollection({ slug: "x", collection: "Nope" });
      expect(none.prev).toBeNull();
      expect(none.next).toBeNull();
    } finally {
      cleanup(dir);
    }
  });
});

