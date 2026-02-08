import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

function mkTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "amber-docs-routes-"));
}

function write(file: string, body: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body, "utf8");
}

function seedMinimalContent(contentDir: string) {
  write(path.join(contentDir, "blocks", "disclaimers.json"), "[]\n");
  write(path.join(contentDir, "blocks", "glossary.json"), "[]\n");
  write(path.join(contentDir, "search", "synonyms.json"), JSON.stringify({ ai: ["artificial intelligence"] }, null, 2) + "\n");

  write(
    path.join(contentDir, "docs", "a.md"),
    `---\nslug: a\nversion: \"1\"\ntitle: A\nstage: draft\nsummary: s\nupdatedAt: \"2026-01-01\"\n---\n\n# A\n\n## Alpha\nHas 123 and 2026-01-01.\n\n## Beta\nSecond section.\n`,
  );

  write(
    path.join(contentDir, "docs", "b.md"),
    `---\nslug: b\nversion: \"1\"\ntitle: B\nstage: final\nsummary: s\nupdatedAt: \"2026-01-02\"\n---\n\n# B\n\nNo H2 here.\n`,
  );
}

describe("machine endpoints (route handlers)", () => {
  const prevContent = process.env.AMBER_DOCS_CONTENT_DIR;
  const prevSiteUrl = process.env.SITE_URL;

  afterEach(() => {
    if (prevContent === undefined) delete process.env.AMBER_DOCS_CONTENT_DIR;
    else process.env.AMBER_DOCS_CONTENT_DIR = prevContent;
    if (prevSiteUrl === undefined) delete process.env.SITE_URL;
    else process.env.SITE_URL = prevSiteUrl;
  });

  test("docs.json returns schema and versioned raw URLs", async () => {
    const root = mkTmpDir();
    try {
      const contentDir = path.join(root, "content");
      seedMinimalContent(contentDir);
      process.env.AMBER_DOCS_CONTENT_DIR = contentDir;

      const { GET } = await import("../../src/app/docs.json/route");
      const res = GET();
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        schemaVersion: number;
        docsCount: number;
        canonicalCount: number;
        docs: Array<{ versions: Array<{ rawUrl: string }> }>;
      };
      expect(json.schemaVersion).toBe(1);
      expect(json.docsCount).toBe(2);
      expect(json.canonicalCount).toBe(2);
      expect(json.docs[0].versions[0].rawUrl).toMatch(/^\/raw\/v\//);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test("synonyms.json returns the synonyms mapping", async () => {
    const root = mkTmpDir();
    try {
      const contentDir = path.join(root, "content");
      seedMinimalContent(contentDir);
      process.env.AMBER_DOCS_CONTENT_DIR = contentDir;

      const { GET } = await import("../../src/app/synonyms.json/route");
      const res = GET();
      const json = (await res.json()) as Record<string, string[]>;
      expect(Array.isArray(json.ai)).toBe(true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test("raw routes return markdown and 404 when missing", async () => {
    const root = mkTmpDir();
    try {
      const contentDir = path.join(root, "content");
      seedMinimalContent(contentDir);
      process.env.AMBER_DOCS_CONTENT_DIR = contentDir;

      const rawLatest = await import("../../src/app/raw/[slug]/route");
      const paramsLatest = rawLatest.generateStaticParams();
      expect(paramsLatest.some((p) => p.slug === "a")).toBe(true);
      const req = {} as unknown as import("next/server").NextRequest;
      const ok = await rawLatest.GET(req, { params: Promise.resolve({ slug: "a" }) });
      expect(ok.status).toBe(200);
      expect(await ok.text()).toContain("# A");

      const miss = await rawLatest.GET(req, { params: Promise.resolve({ slug: "nope" }) });
      expect(miss.status).toBe(404);

      const rawPinned = await import("../../src/app/raw/v/[slug]/[version]/route");
      const paramsPinned = rawPinned.generateStaticParams();
      expect(paramsPinned.some((p) => p.slug === "a" && p.version === "1")).toBe(true);
      const ok2 = await rawPinned.GET(req, { params: Promise.resolve({ slug: "a", version: "1" }) });
      expect(ok2.status).toBe(200);
      expect(await ok2.text()).toContain("## Alpha");

      const miss2 = await rawPinned.GET(req, { params: Promise.resolve({ slug: "a", version: "999" }) });
      expect(miss2.status).toBe(404);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test("chunks.json returns chunk objects with stable IDs", async () => {
    const root = mkTmpDir();
    try {
      const contentDir = path.join(root, "content");
      seedMinimalContent(contentDir);
      process.env.AMBER_DOCS_CONTENT_DIR = contentDir;

      const { GET } = await import("../../src/app/chunks.json/route");
      const res = GET();
      const json = (await res.json()) as { schemaVersion: number; chunks: Array<{ chunkId: string; url: string }> };
      expect(json.schemaVersion).toBe(1);
      expect(Array.isArray(json.chunks)).toBe(true);
      expect(json.chunks.length).toBeGreaterThan(0);
      const c = json.chunks[0];
      expect(typeof c.chunkId).toBe("string");
      expect(typeof c.url).toBe("string");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test("search-index.json returns latest doc summaries", async () => {
    const root = mkTmpDir();
    try {
      const contentDir = path.join(root, "content");
      seedMinimalContent(contentDir);
      process.env.AMBER_DOCS_CONTENT_DIR = contentDir;

      const { GET } = await import("../../src/app/search-index.json/route");
      const res = GET();
      const json = (await res.json()) as Array<{ slug: string; searchText: string; url: string }>;
      expect(json.length).toBe(2);
      expect(json[0]).toHaveProperty("slug");
      expect(json[0]).toHaveProperty("searchText");
      expect(json[0].url).toMatch(/^\/docs\//);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test("updates.json returns buildId and docs list", async () => {
    const root = mkTmpDir();
    try {
      const contentDir = path.join(root, "content");
      seedMinimalContent(contentDir);
      process.env.AMBER_DOCS_CONTENT_DIR = contentDir;

      const { GET } = await import("../../src/app/updates.json/route");
      const res = GET();
      const json = (await res.json()) as { buildId: string; docs: Array<{ contentHash: string }> };
      expect(typeof json.buildId).toBe("string");
      expect(json.docs).toHaveLength(2);
      expect(json.docs[0]).toHaveProperty("contentHash");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test("claims.json extracts numbers and dates", async () => {
    const root = mkTmpDir();
    try {
      const contentDir = path.join(root, "content");
      seedMinimalContent(contentDir);
      process.env.AMBER_DOCS_CONTENT_DIR = contentDir;

      const { GET } = await import("../../src/app/claims.json/route");
      const res = GET();
      const json = (await res.json()) as { docs: Array<{ slug: string; numbers: string[]; dates: string[] }> };
      const docA = json.docs.find((d) => d.slug === "a");
      if (!docA) throw new Error("missing doc a");
      expect(docA.numbers).toContain("123");
      expect(docA.dates).toContain("2026-01-01");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test("embeddings-manifest.json includes chunk hashes per H2 section and doc fallback", async () => {
    const root = mkTmpDir();
    try {
      const contentDir = path.join(root, "content");
      seedMinimalContent(contentDir);
      process.env.AMBER_DOCS_CONTENT_DIR = contentDir;

      const { GET } = await import("../../src/app/embeddings-manifest.json/route");
      const res = GET();
      const json = (await res.json()) as {
        schemaVersion: number;
        docs: Array<{ slug: string; chunks: Array<{ chunkId: string; heading: string | null }> }>;
      };
      expect(json.schemaVersion).toBe(1);
      expect(json.docs).toHaveLength(2);
      const a = json.docs.find((d) => d.slug === "a");
      if (!a) throw new Error("missing doc a");
      expect(a.chunks.length).toBeGreaterThan(1);
      expect(a.chunks[0]).toHaveProperty("chunkId");
      const b = json.docs.find((d) => d.slug === "b");
      if (!b) throw new Error("missing doc b");
      expect(b.chunks).toHaveLength(1);
      expect(b.chunks[0].heading).toBeNull();
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test("robots and sitemap are deterministic", async () => {
    const root = mkTmpDir();
    try {
      const contentDir = path.join(root, "content");
      seedMinimalContent(contentDir);
      process.env.AMBER_DOCS_CONTENT_DIR = contentDir;
      process.env.SITE_URL = "https://docs.example.test/";

      const robots = await import("../../src/app/robots");
      const r = robots.default();
      const rules = Array.isArray(r.rules) ? r.rules : [r.rules];
      expect(rules[0]?.allow).toBe("/");
      expect(r.sitemap).toBe("/sitemap.xml");

      const sitemap = await import("../../src/app/sitemap");
      const sm = await sitemap.default();
      expect(sm[0].url).toBe("https://docs.example.test/");
      expect(sm.some((x) => String(x.url).includes("/docs/a"))).toBe(true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
