import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import matter from "gray-matter";
import { z } from "zod";
import type { DocRecord, DocStage } from "../docs";
import { extractToc, toSearchText } from "../markdown";

const CitationSchema = z.object({
  label: z.string().min(1),
  url: z.string().url().optional(),
});

const ApprovalSchema = z.object({
  name: z.string().min(1),
  date: z.string().min(1),
});

const DocFrontmatterSchema = z.object({
  slug: z.string().min(1),
  version: z.string().min(1).optional(),
  title: z.string().min(1),
  stage: z.enum(["draft", "final", "official"]) satisfies z.ZodType<DocStage>,
  summary: z.string().min(1),
  updatedAt: z.string().min(1),
  lastReviewedAt: z.string().min(1).optional(),
  owners: z.array(z.string().min(1)).optional(),
  topics: z.array(z.string().min(1)).optional(),
  collection: z.string().min(1).optional(),
  order: z.number().int().positive().optional(),
  aiChecks: z.array(z.string().min(1)).optional(),
  relatedContext: z.array(z.string().min(1)).optional(),
  relatedSlugs: z.array(z.string().min(1)).optional(),
  citations: z.array(CitationSchema).optional(),
  approvals: z.array(ApprovalSchema).optional(),
});

function contentRoot() {
  // Allows tests/CI to point at a fixture directory without changing process.cwd().
  return process.env.AMBER_DOCS_CONTENT_DIR ?? path.join(process.cwd(), "content");
}

function docsDir() {
  return path.join(contentRoot(), "docs");
}

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function listDocFiles(): string[] {
  const dir = docsDir();
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md") || f.endsWith(".mdx"))
    .map((f) => path.join(dir, f));
}

function parseDocFile(filePath: string): DocRecord {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = matter(raw);
  let fm: z.infer<typeof DocFrontmatterSchema>;
  try {
    fm = DocFrontmatterSchema.parse(parsed.data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Invalid frontmatter in ${path.relative(process.cwd(), filePath)}: ${message}`);
  }

  const markdown = parsed.content.trimEnd() + "\n";
  const toc = extractToc(markdown);
  const headings = toc.map((t) => t.text);
  const searchText = toSearchText(markdown);

  const version = fm.version ?? fm.updatedAt;
  const contentHash = sha256(
    JSON.stringify({
      slug: fm.slug,
      version,
      title: fm.title,
      stage: fm.stage,
      summary: fm.summary,
      updatedAt: fm.updatedAt,
      lastReviewedAt: fm.lastReviewedAt ?? null,
      owners: fm.owners ?? [],
      topics: fm.topics ?? [],
      markdown,
    }),
  );

  return {
    slug: fm.slug,
    version,
    title: fm.title,
    stage: fm.stage,
    summary: fm.summary,
    updatedAt: fm.updatedAt,
    lastReviewedAt: fm.lastReviewedAt,
    owners: fm.owners ?? [],
    topics: fm.topics ?? [],
    collection: fm.collection,
    order: fm.order,
    aiChecks: fm.aiChecks ?? [],
    relatedContext: fm.relatedContext ?? [],
    relatedSlugs: fm.relatedSlugs ?? [],
    citations: fm.citations ?? [],
    approvals: fm.approvals ?? [],
    markdown,
    toc,
    headings,
    searchText,
    contentHash,
    sourcePath: filePath,
  };
}

let _cache: DocRecord[] | null = null;
let _cacheRoot: string | null = null;

export function loadAllDocs(): DocRecord[] {
  const root = contentRoot();
  if (_cache && _cacheRoot === root) return _cache;
  _cacheRoot = root;
  const files = listDocFiles();
  const docs = files.map(parseDocFile);

  // Deterministic ordering for stable exports.
  docs.sort((a, b) => {
    if (a.slug !== b.slug) return a.slug.localeCompare(b.slug);
    return a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : a.version.localeCompare(b.version);
  });

  _cache = docs;
  return docs;
}

export function listDocSlugs(): string[] {
  return Array.from(new Set(loadAllDocs().map((d) => d.slug))).sort((a, b) => a.localeCompare(b));
}

export function listDocVersions(slug: string): DocRecord[] {
  return loadAllDocs()
    .filter((d) => d.slug === slug)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : a.version.localeCompare(b.version)));
}

export function getDocVersion(slug: string, version: string): DocRecord | null {
  return loadAllDocs().find((d) => d.slug === slug && d.version === version) ?? null;
}

export function getLatestDoc(slug: string): DocRecord | null {
  return listDocVersions(slug)[0] ?? null;
}

export function listLatestDocs(): DocRecord[] {
  return listDocSlugs()
    .map((slug) => getLatestDoc(slug))
    .filter((d): d is DocRecord => !!d)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : a.slug.localeCompare(b.slug)));
}

export type Collection = {
  name: string;
  docs: DocRecord[];
};

export function listCollections(): Collection[] {
  const latest = listLatestDocs();
  const map = new Map<string, DocRecord[]>();
  for (const d of latest) {
    const key = d.collection?.trim() || "Uncategorized";
    const arr = map.get(key) ?? [];
    arr.push(d);
    map.set(key, arr);
  }

  const out: Collection[] = [];
  for (const [name, docs] of map.entries()) {
    docs.sort((a, b) => {
      const ao = a.order ?? Number.POSITIVE_INFINITY;
      const bo = b.order ?? Number.POSITIVE_INFINITY;
      if (ao !== bo) return ao - bo;
      return a.title.localeCompare(b.title);
    });
    out.push({ name, docs });
  }

  out.sort((a, b) => {
    if (a.name === "Uncategorized") return 1;
    if (b.name === "Uncategorized") return -1;
    return a.name.localeCompare(b.name);
  });
  return out;
}

export function getPrevNextInCollection(doc: Pick<DocRecord, "slug" | "collection">) {
  const collectionName = doc.collection?.trim();
  if (!collectionName) return { prev: null, next: null };
  const collection = listCollections().find((c) => c.name === collectionName);
  if (!collection) return { prev: null, next: null };
  const idx = collection.docs.findIndex((d) => d.slug === doc.slug);
  if (idx < 0) return { prev: null, next: null };
  return {
    prev: idx > 0 ? collection.docs[idx - 1] : null,
    next: idx < collection.docs.length - 1 ? collection.docs[idx + 1] : null,
  };
}
