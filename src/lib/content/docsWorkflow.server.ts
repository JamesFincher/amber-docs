import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import type { Approval, AuditEntry, Citation, DocRecord, DocStage, DocVisibility } from "../docs";
import { getDocVersion, listDocVersions, resetDocsCache } from "./docs.server";
import { isoDate, resolveVersionAndUpdatedAt, suggestedDocFileName } from "./docsWorkflow.shared";

type DocFrontmatter = {
  slug: string;
  version?: string;
  title: string;
  stage: DocStage;
  archived?: boolean;
  visibility?: DocVisibility;
  summary: string;
  updatedAt: string;
  lastReviewedAt?: string;
  owners?: string[];
  topics?: string[];
  collection?: string;
  order?: number;
  aiChecks?: string[];
  relatedContext?: string[];
  relatedSlugs?: string[];
  canonicalFor?: string[];
  facts?: Record<string, string>;
  citations?: Citation[];
  approvals?: Approval[];
  audit?: AuditEntry[];
};

function contentRoot() {
  return process.env.AMBER_DOCS_CONTENT_DIR ?? path.join(process.cwd(), "content");
}

function docsDir() {
  return path.join(contentRoot(), "docs");
}

function ensureDocsDir() {
  fs.mkdirSync(docsDir(), { recursive: true });
}
export { suggestedDocFileName };

export function readDocFile(filePath: string): { frontmatter: Record<string, unknown>; markdown: string } {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = matter(raw);
  return {
    frontmatter: (parsed.data ?? {}) as Record<string, unknown>,
    markdown: (parsed.content ?? "").trimEnd() + "\n",
  };
}

function stripUndefined(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) {
    const cleaned = value.map(stripUndefined).filter((v) => v !== undefined);
    return cleaned;
  }
  if (typeof value === "object" && value !== null) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const cleaned = stripUndefined(v);
      if (cleaned === undefined) continue;
      out[k] = cleaned;
    }
    return out;
  }
  return value;
}

function nowIso(): string {
  return new Date().toISOString();
}

function actorFromEnv(): string | undefined {
  const raw = (process.env.AMBER_DOCS_ACTOR ?? "").trim();
  return raw ? raw : undefined;
}

function safeAuditArray(v: unknown): AuditEntry[] {
  if (!Array.isArray(v)) return [];
  const out: AuditEntry[] = [];
  for (const item of v) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    if (typeof obj.at !== "string" || typeof obj.action !== "string") continue;
    out.push({
      at: obj.at,
      action: obj.action,
      actor: typeof obj.actor === "string" ? obj.actor : undefined,
      note: typeof obj.note === "string" ? obj.note : undefined,
      fromStage: obj.fromStage === "draft" || obj.fromStage === "final" || obj.fromStage === "official" ? obj.fromStage : undefined,
      toStage: obj.toStage === "draft" || obj.toStage === "final" || obj.toStage === "official" ? obj.toStage : undefined,
      fromArchived: typeof obj.fromArchived === "boolean" ? obj.fromArchived : undefined,
      toArchived: typeof obj.toArchived === "boolean" ? obj.toArchived : undefined,
    });
  }
  return out;
}

export function writeDocFile(filePath: string, args: { frontmatter: DocFrontmatter; markdown: string }) {
  const markdown = args.markdown.trimEnd() + "\n";
  // gray-matter uses js-yaml, which rejects `undefined` values anywhere in the object.
  const safeFrontmatter = stripUndefined(args.frontmatter) as Record<string, unknown>;
  const body = matter.stringify(markdown, safeFrontmatter);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, body, "utf8");
}

export function createDocFile(args: {
  slug: string;
  title: string;
  summary: string;
  stage?: DocStage;
  updatedAt?: string;
  version?: string;
  markdown?: string;
  // Lifecycle: archived=true means unpublished (not shown in the app / static export).
  archived?: boolean;
  // Convenience alias for archived (published=true => archived=false).
  published?: boolean;
  visibility?: DocVisibility;
  owners?: string[];
  topics?: string[];
  collection?: string;
  order?: number;
  actor?: string;
}): { filePath: string; version: string } {
  resetDocsCache();
  ensureDocsDir();
  const { version, updatedAt } = resolveVersionAndUpdatedAt({
    version: args.version ?? null,
    updatedAt: args.updatedAt ?? null,
  });
  const stage = args.stage ?? "draft";

  if (args.archived !== undefined && args.published !== undefined) {
    throw new Error("Pass only one of: archived, published");
  }
  const archived = args.archived ?? (args.published !== undefined ? !args.published : true);

  const existing = getDocVersion(args.slug, version, { includeArchived: true, includeHidden: true, raw: true });
  if (existing) {
    throw new Error(`Doc already exists: ${args.slug}@${version}`);
  }

  const filePath = path.join(docsDir(), suggestedDocFileName(args.slug, version));
  if (fs.existsSync(filePath)) {
    throw new Error(`File already exists: ${path.relative(process.cwd(), filePath)}`);
  }

  const markdown =
    args.markdown ??
    `# ${args.title}\n\n## Overview\n\n_TODO: Write an overview._\n`;

  writeDocFile(filePath, {
    frontmatter: {
      slug: args.slug,
      version,
      title: args.title,
      stage,
      archived,
      visibility: args.visibility ?? "internal",
      summary: args.summary,
      updatedAt,
      lastReviewedAt: stage === "official" ? updatedAt : undefined,
      owners: args.owners ?? [],
      topics: args.topics ?? [],
      collection: args.collection,
      order: args.order,
      audit: [
        {
          at: nowIso(),
          action: "create",
          actor: args.actor?.trim() || actorFromEnv(),
        },
      ],
    },
    markdown,
  });

  resetDocsCache();
  return { filePath, version };
}

export function cloneLatestToNewVersion(args: {
  slug: string;
  newVersion?: string;
  newUpdatedAt?: string;
  stage?: DocStage;
  fromArchived?: boolean;
  // Lifecycle for the new version.
  archived?: boolean;
  published?: boolean;
  visibility?: DocVisibility;
  actor?: string;
}): { filePath: string; version: string; from: Pick<DocRecord, "version" | "updatedAt" | "sourcePath"> } {
  resetDocsCache();
  ensureDocsDir();
  const all = listDocVersions(args.slug, { includeArchived: true, includeHidden: true, raw: true });
  const base = (args.fromArchived ? all : all.filter((d) => !d.archived))[0] ?? all[0];
  if (!base) throw new Error(`No doc versions found for slug: ${args.slug}`);

  const { version, updatedAt } = resolveVersionAndUpdatedAt({
    version: args.newVersion ?? null,
    updatedAt: args.newUpdatedAt ?? null,
  });
  if (getDocVersion(args.slug, version, { includeArchived: true, includeHidden: true, raw: true })) {
    throw new Error(`Doc already exists: ${args.slug}@${version}`);
  }

  if (args.archived !== undefined && args.published !== undefined) {
    throw new Error("Pass only one of: archived, published");
  }
  const archived = args.archived ?? (args.published !== undefined ? !args.published : true);

  const { frontmatter, markdown } = readDocFile(base.sourcePath);
  const nextFm: DocFrontmatter = {
    ...(frontmatter as unknown as DocFrontmatter),
    slug: args.slug,
    version,
    updatedAt,
    stage: args.stage ?? "draft",
    archived,
    visibility: args.visibility ?? (frontmatter as unknown as DocFrontmatter).visibility ?? "internal",
    audit: [
      {
        at: nowIso(),
        action: "clone",
        actor: args.actor?.trim() || actorFromEnv(),
        note: `from ${base.version}`,
      },
    ],
  };

  const filePath = path.join(docsDir(), suggestedDocFileName(args.slug, version));
  writeDocFile(filePath, { frontmatter: nextFm, markdown });
  resetDocsCache();
  return { filePath, version, from: { version: base.version, updatedAt: base.updatedAt, sourcePath: base.sourcePath } };
}

export function updateDocFile(args: {
  slug: string;
  version: string;
  patchFrontmatter?: Partial<DocFrontmatter>;
  patchMarkdown?: string;
  auditEntry?: AuditEntry;
}): { filePath: string } {
  resetDocsCache();
  const doc = getDocVersion(args.slug, args.version, { includeArchived: true, includeHidden: true, raw: true });
  if (!doc) throw new Error(`Doc not found: ${args.slug}@${args.version}`);

  const { frontmatter, markdown } = readDocFile(doc.sourcePath);
  const nextFm = { ...(frontmatter as Record<string, unknown>), ...(args.patchFrontmatter ?? {}) } as DocFrontmatter;
  const nextMd = args.patchMarkdown ?? markdown;

  if (args.auditEntry) {
    const prev = safeAuditArray((nextFm as unknown as { audit?: unknown }).audit);
    const next = [...prev, args.auditEntry].slice(-200);
    nextFm.audit = next;
  }

  writeDocFile(doc.sourcePath, { frontmatter: nextFm, markdown: nextMd });
  resetDocsCache();
  return { filePath: doc.sourcePath };
}

export function setDocStage(args: {
  slug: string;
  version: string;
  stage: DocStage;
  reviewedAt?: string;
  approvals?: Approval[];
  actor?: string;
}): { filePath: string } {
  const reviewedAt = args.reviewedAt ?? isoDate(new Date());
  const before = getDocVersion(args.slug, args.version, { includeArchived: true, includeHidden: true, raw: true });
  if (!before) throw new Error(`Doc not found: ${args.slug}@${args.version}`);
  const patch: Partial<DocFrontmatter> = {
    stage: args.stage,
    // Official docs should always have a review date.
    lastReviewedAt: args.stage === "official" ? reviewedAt : undefined,
    approvals: args.approvals,
  };
  return updateDocFile({
    slug: args.slug,
    version: args.version,
    patchFrontmatter: patch,
    auditEntry: {
      at: nowIso(),
      action: "set_stage",
      actor: args.actor?.trim() || actorFromEnv(),
      fromStage: before.stage,
      toStage: args.stage,
    },
  });
}

export function archiveDocVersion(args: {
  slug: string;
  version: string;
  archived: boolean;
  actor?: string;
}): { filePath: string } {
  const before = getDocVersion(args.slug, args.version, { includeArchived: true, includeHidden: true, raw: true });
  if (!before) throw new Error(`Doc not found: ${args.slug}@${args.version}`);
  return updateDocFile({
    slug: args.slug,
    version: args.version,
    patchFrontmatter: { archived: args.archived },
    auditEntry: {
      at: nowIso(),
      action: args.archived ? "unpublish" : "publish",
      actor: args.actor?.trim() || actorFromEnv(),
      fromArchived: before.archived,
      toArchived: args.archived,
    },
  });
}

export function publishDocVersion(args: { slug: string; version: string; actor?: string }): { filePath: string } {
  return archiveDocVersion({ slug: args.slug, version: args.version, archived: false, actor: args.actor });
}

export function unpublishDocVersion(args: { slug: string; version: string; actor?: string }): { filePath: string } {
  return archiveDocVersion({ slug: args.slug, version: args.version, archived: true, actor: args.actor });
}

export function finalizeDocVersion(args: { slug: string; version: string; actor?: string }): { filePath: string } {
  return setDocStage({ slug: args.slug, version: args.version, stage: "final", actor: args.actor });
}

export function promoteDocVersionToOfficial(args: {
  slug: string;
  version: string;
  reviewedAt?: string;
  approvals?: Approval[];
  actor?: string;
}): { filePath: string } {
  return setDocStage({
    slug: args.slug,
    version: args.version,
    stage: "official",
    reviewedAt: args.reviewedAt,
    approvals: args.approvals,
    actor: args.actor,
  });
}

export function deleteDocVersion(args: { slug: string; version: string }): { deleted: string } {
  resetDocsCache();
  const doc = getDocVersion(args.slug, args.version, { includeArchived: true });
  if (!doc) throw new Error(`Doc not found: ${args.slug}@${args.version}`);
  fs.rmSync(doc.sourcePath);
  resetDocsCache();
  return { deleted: doc.sourcePath };
}

export function deleteAllDocVersions(args: { slug: string }): { deleted: string[] } {
  resetDocsCache();
  const versions = listDocVersions(args.slug, { includeArchived: true });
  if (!versions.length) throw new Error(`No doc versions found for slug: ${args.slug}`);
  const deleted: string[] = [];
  for (const v of versions) {
    fs.rmSync(v.sourcePath);
    deleted.push(v.sourcePath);
  }
  resetDocsCache();
  return { deleted };
}

export function parseStage(value: string): DocStage {
  if (value === "draft" || value === "final" || value === "official") return value;
  throw new Error(`Invalid stage: ${value}`);
}
