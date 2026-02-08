import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import matter from "gray-matter";
import { z } from "zod";
import type { AuditEntry, DocRecord, DocStage, DocVisibility } from "../docs";
import { extractToc, toSearchText } from "../markdown";

const CitationSchema = z.object({
  label: z.string().min(1),
  url: z.string().url().optional(),
});

const ApprovalSchema = z.object({
  name: z.string().min(1),
  date: z.string().min(1),
});

const AuditEntrySchema = z.object({
  at: z.string().min(1),
  action: z.string().min(1),
  actor: z.string().min(1).optional(),
  note: z.string().min(1).optional(),
  fromStage: z.enum(["draft", "final", "official"]).optional(),
  toStage: z.enum(["draft", "final", "official"]).optional(),
  fromArchived: z.boolean().optional(),
  toArchived: z.boolean().optional(),
});

const DocFrontmatterSchema = z.object({
  slug: z.string().min(1),
  version: z.string().min(1).optional(),
  title: z.string().min(1),
  stage: z.enum(["draft", "final", "official"]) satisfies z.ZodType<DocStage>,
  archived: z.boolean().optional(),
  visibility: z.enum(["public", "internal", "private"]).optional(),
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
  canonicalFor: z.array(z.string().min(1)).optional(),
  facts: z.record(z.string(), z.string().min(1)).optional(),
  citations: z.array(CitationSchema).optional(),
  approvals: z.array(ApprovalSchema).optional(),
  audit: z.array(AuditEntrySchema).optional(),
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

function computeContentHash(input: {
  slug: string;
  version: string;
  title: string;
  stage: DocStage;
  archived: boolean;
  visibility: DocVisibility;
  summary: string;
  updatedAt: string;
  lastReviewedAt: string | null;
  owners: string[];
  topics: string[];
  markdown: string;
}): string {
  return sha256(JSON.stringify(input));
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
  const visibility: DocVisibility = fm.visibility ?? "public";
  const contentHash = computeContentHash({
    slug: fm.slug,
    version,
    title: fm.title,
    stage: fm.stage,
    archived: fm.archived ?? false,
    visibility,
    summary: fm.summary,
    updatedAt: fm.updatedAt,
    lastReviewedAt: fm.lastReviewedAt ?? null,
    owners: fm.owners ?? [],
    topics: fm.topics ?? [],
    markdown,
  });

  return {
    slug: fm.slug,
    version,
    title: fm.title,
    stage: fm.stage,
    archived: fm.archived ?? false,
    visibility,
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
    canonicalFor: fm.canonicalFor ?? [],
    facts: fm.facts ?? {},
    citations: fm.citations ?? [],
    approvals: fm.approvals ?? [],
    audit: (fm.audit ?? []) as AuditEntry[],
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
let _visibleCacheRoot: string | null = null;
const _visibleCache = new Map<string, DocRecord[]>();

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

export function resetDocsCache() {
  _cache = null;
  _cacheRoot = null;
  _visibleCacheRoot = null;
  _visibleCache.clear();
}

export type DocsAudience = "public" | "internal" | "private";

function docsAudienceFromEnv(): DocsAudience {
  const raw = (process.env.AMBER_DOCS_AUDIENCE ?? "").trim().toLowerCase();
  if (raw === "public" || raw === "internal" || raw === "private") return raw;
  return "private";
}

function isPublicExportFromEnv(): boolean {
  const raw = (process.env.AMBER_DOCS_PUBLIC_EXPORT ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

function visibilityRank(v: DocVisibility): number {
  switch (v) {
    case "public":
      return 0;
    case "internal":
      return 1;
    case "private":
      return 2;
  }
}

function audienceRank(a: DocsAudience): number {
  switch (a) {
    case "public":
      return 0;
    case "internal":
      return 1;
    case "private":
      return 2;
  }
}

function isVisibilityAllowed(v: DocVisibility, audience: DocsAudience): boolean {
  return visibilityRank(v) <= audienceRank(audience);
}

function stripAudienceBlock(markdown: string, tag: "internal" | "private"): string {
  const startRe = new RegExp(`<!--\\s*audience:${tag}:start\\s*-->`, "i");
  const endRe = new RegExp(`<!--\\s*audience:${tag}:end\\s*-->`, "i");
  let out = markdown;
  for (let i = 0; i < 5000; i++) {
    const start = startRe.exec(out);
    if (!start) break;
    const startIdx = start.index;
    const afterStart = startIdx + start[0].length;
    const end = endRe.exec(out.slice(afterStart));
    if (!end) {
      out = out.slice(0, startIdx).trimEnd() + "\n";
      break;
    }
    const endIdx = afterStart + end.index + end[0].length;
    out = out.slice(0, startIdx) + "\n\n" + out.slice(endIdx);
  }
  return out;
}

function applyAudienceRedactions(markdown: string, audience: DocsAudience): string {
  if (audience === "private") return markdown;
  let out = markdown;
  // Internal viewers should not see private-only blocks.
  out = stripAudienceBlock(out, "private");
  // Public viewers should not see internal blocks (or private-only, already stripped).
  if (audience === "public") out = stripAudienceBlock(out, "internal");
  return out;
}

function applyAudienceToDoc(doc: DocRecord, audience: DocsAudience): DocRecord {
  const markdown = applyAudienceRedactions(doc.markdown, audience);
  if (markdown === doc.markdown) return doc;
  const toc = extractToc(markdown);
  const headings = toc.map((t) => t.text);
  const searchText = toSearchText(markdown);
  const contentHash = computeContentHash({
    slug: doc.slug,
    version: doc.version,
    title: doc.title,
    stage: doc.stage,
    archived: doc.archived,
    visibility: doc.visibility,
    summary: doc.summary,
    updatedAt: doc.updatedAt,
    lastReviewedAt: doc.lastReviewedAt ?? null,
    owners: doc.owners ?? [],
    topics: doc.topics ?? [],
    markdown,
  });
  return { ...doc, markdown, toc, headings, searchText, contentHash };
}

export type ListOptions = { includeArchived?: boolean; includeHidden?: boolean; raw?: boolean };

function visibleDocs(options: ListOptions = {}): DocRecord[] {
  const root = contentRoot();
  if (_visibleCacheRoot !== root) {
    _visibleCacheRoot = root;
    _visibleCache.clear();
  }

  const audience = docsAudienceFromEnv();
  const publicExport = isPublicExportFromEnv();
  const key = [
    options.includeArchived ? "a1" : "a0",
    options.includeHidden ? "h1" : "h0",
    options.raw ? "r1" : "r0",
    `aud:${audience}`,
    publicExport ? "pub1" : "pub0",
  ].join("|");
  const cached = _visibleCache.get(key);
  if (cached) return cached;

  let docs = loadAllDocs();
  if (!options.includeArchived) docs = docs.filter((d) => !d.archived);
  if (!options.includeHidden) {
    docs = docs.filter((d) => isVisibilityAllowed(d.visibility, audience));
    if (publicExport) docs = docs.filter((d) => d.stage === "official");
  }
  if (!options.raw) docs = docs.map((d) => applyAudienceToDoc(d, audience));

  _visibleCache.set(key, docs);
  return docs;
}

export function listDocSlugs(options: ListOptions = {}): string[] {
  return Array.from(new Set(visibleDocs(options).map((d) => d.slug))).sort((a, b) => a.localeCompare(b));
}

export function listDocVersions(slug: string, options: ListOptions = {}): DocRecord[] {
  return visibleDocs(options)
    .filter((d) => d.slug === slug)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : a.version.localeCompare(b.version)));
}

export function getDocVersion(slug: string, version: string, options: ListOptions = {}): DocRecord | null {
  return visibleDocs(options).find((d) => d.slug === slug && d.version === version) ?? null;
}

export function getLatestDoc(slug: string, options: ListOptions = {}): DocRecord | null {
  return listDocVersions(slug, options)[0] ?? null;
}

export function listLatestDocs(options: ListOptions = {}): DocRecord[] {
  const docs = visibleDocs(options);
  const seen = new Set<string>();
  const latest: DocRecord[] = [];
  for (const d of docs) {
    if (seen.has(d.slug)) continue;
    seen.add(d.slug);
    latest.push(d);
  }
  return latest.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : a.slug.localeCompare(b.slug)));
}

export type Collection = {
  name: string;
  docs: DocRecord[];
};

export function listCollections(options: ListOptions = {}): Collection[] {
  const latest = listLatestDocs(options);
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
