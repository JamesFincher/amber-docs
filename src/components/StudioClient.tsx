"use client";

import Link from "next/link";
import matter from "gray-matter";
import { useEffect, useMemo, useState } from "react";
import type { Approval, AuditEntry, Citation, DocStage, DocVisibility } from "@/lib/docs";
import { stageBadgeClass } from "@/lib/docs";
import { isoDate, resolveVersionAndUpdatedAt, safeFilePart, suggestedDocFileName } from "@/lib/content/docsWorkflow.shared";
import { clearStudioImport, readStudioImport, type StudioImportDraft } from "@/lib/studioImport";
import { slugFromFilename, summaryFromMarkdown, titleFromMarkdown } from "@/lib/studio/importFiles";
import { CopyButton } from "@/components/CopyButton";
import { Markdown } from "@/components/Markdown";

type ImportResult = {
  sourceName: string;
  ok: boolean;
  fileName?: string;
  slug?: string;
  version?: string;
  error?: string;
};

type LocalDoc = {
  fileName: string;
  handle: FsFileHandle;
  slug: string;
  version: string;
  title: string;
  stage: DocStage;
  archived: boolean;
  visibility: DocVisibility;
  updatedAt: string;
  lastReviewedAt: string | null;
  summary: string;
  owners: string[];
  topics: string[];
  collection: string | null;
  order: number | null;
  citations: Citation[];
  approvals: Approval[];
  audit: AuditEntry[];
  markdown: string;
  frontmatter: Record<string, unknown>;
};

type FsWritableStream = {
  write(data: string): Promise<void>;
  close(): Promise<void>;
};

type FsFileHandle = {
  kind: "file";
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<FsWritableStream>;
};

type FsDirectoryHandle = {
  kind: "directory";
  name: string;
  entries(): AsyncIterableIterator<[string, FsFileHandle | FsDirectoryHandle]>;
  getFileHandle(name: string, opts?: { create?: boolean }): Promise<FsFileHandle>;
  removeEntry(name: string, opts?: { recursive?: boolean }): Promise<void>;
};

function isStage(v: unknown): v is DocStage {
  return v === "draft" || v === "final" || v === "official";
}

function isVisibility(v: unknown): v is DocVisibility {
  return v === "public" || v === "internal" || v === "private";
}

function stripUndefined(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) return value.map(stripUndefined).filter((v) => v !== undefined);
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

function slugifyTitle(title: string): string {
  const base = title.trim().toLowerCase();
  return safeFilePart(base) || "new-doc";
}

function safeStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x ?? "")).map((x) => x.trim()).filter(Boolean);
}

function safeCitations(v: unknown): Citation[] {
  if (!Array.isArray(v)) return [];
  const out: Citation[] = [];
  for (const item of v) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const label = typeof obj.label === "string" ? obj.label.trim() : "";
    if (!label) continue;
    const url = typeof obj.url === "string" ? obj.url.trim() : "";
    out.push(url ? { label, url } : { label });
  }
  return out;
}

function safeApprovals(v: unknown): Approval[] {
  if (!Array.isArray(v)) return [];
  const out: Approval[] = [];
  for (const item of v) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const name = typeof obj.name === "string" ? obj.name.trim() : "";
    const date = typeof obj.date === "string" ? obj.date.trim() : "";
    if (!name || !date) continue;
    out.push({ name, date });
  }
  return out;
}

function safeAudit(v: unknown): AuditEntry[] {
  if (!Array.isArray(v)) return [];
  const out: AuditEntry[] = [];
  for (const item of v) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const at = typeof obj.at === "string" ? obj.at : null;
    const action = typeof obj.action === "string" ? obj.action : null;
    if (!at || !action) continue;
    out.push({
      at,
      action,
      actor: typeof obj.actor === "string" ? obj.actor : undefined,
      note: typeof obj.note === "string" ? obj.note : undefined,
      fromStage: isStage(obj.fromStage) ? obj.fromStage : undefined,
      toStage: isStage(obj.toStage) ? obj.toStage : undefined,
      fromArchived: typeof obj.fromArchived === "boolean" ? obj.fromArchived : undefined,
      toArchived: typeof obj.toArchived === "boolean" ? obj.toArchived : undefined,
    });
  }
  return out;
}

async function pickDirectoryHandle(): Promise<FsDirectoryHandle | null> {
  const picker = (window as Window & {
    showDirectoryPicker?: (opts?: { mode?: "read" | "readwrite" }) => Promise<unknown>;
  }).showDirectoryPicker;
  if (!picker) return null;
  // Prefer readwrite so we can publish/unpublish and save edits.
  return (await picker({ mode: "readwrite" })) as FsDirectoryHandle;
}

async function readHandleText(fileHandle: FsFileHandle): Promise<string> {
  const file = await fileHandle.getFile();
  return await file.text();
}

async function writeHandleText(fileHandle: FsFileHandle, text: string) {
  const writable = await fileHandle.createWritable();
  await writable.write(text);
  await writable.close();
}

async function scanDocsDir(dirHandle: FsDirectoryHandle): Promise<{ docs: LocalDoc[]; errors: string[] }> {
  const docs: LocalDoc[] = [];
  const errors: string[] = [];

  // FS Access API: async iterable entries()
  for await (const [fileName, handle] of dirHandle.entries()) {
    if (handle.kind !== "file") continue;
    if (!(fileName.endsWith(".md") || fileName.endsWith(".mdx"))) continue;

    try {
      const raw = await readHandleText(handle);
      const parsed = matter(raw);
      const fm = (parsed.data ?? {}) as Record<string, unknown>;
      const markdown = (parsed.content ?? "").trimEnd() + "\n";

      const slug = typeof fm.slug === "string" ? fm.slug : "";
      const updatedAt = typeof fm.updatedAt === "string" ? fm.updatedAt : "";
      const version = typeof fm.version === "string" ? fm.version : updatedAt;
      const stage: DocStage = isStage(fm.stage) ? fm.stage : "draft";
      const title = typeof fm.title === "string" ? fm.title : slug || fileName;
      const summary = typeof fm.summary === "string" ? fm.summary : "";
      const archived = typeof fm.archived === "boolean" ? fm.archived : false;
      const visibility: DocVisibility = isVisibility(fm.visibility) ? fm.visibility : "public";
      const lastReviewedAt = typeof fm.lastReviewedAt === "string" ? fm.lastReviewedAt : null;
      const owners = safeStringArray(fm.owners);
      const topics = safeStringArray(fm.topics);
      const collection = typeof fm.collection === "string" ? fm.collection : null;
      const order = typeof fm.order === "number" ? fm.order : null;
      const citations = safeCitations(fm.citations);
      const approvals = safeApprovals(fm.approvals);
      const audit = safeAudit(fm.audit);

      if (!slug) {
        errors.push(`Skipping "${fileName}": missing frontmatter.slug`);
        continue;
      }

      docs.push({
        fileName,
        handle,
        slug,
        version: version || updatedAt || "",
        title,
        stage,
        archived,
        visibility,
        updatedAt,
        lastReviewedAt,
        summary,
        owners,
        topics,
        collection,
        order,
        citations,
        approvals,
        audit,
        markdown,
        frontmatter: fm,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`Skipping "${fileName}": ${msg}`);
    }
  }

  docs.sort((a, b) => {
    if (a.slug !== b.slug) return a.slug.localeCompare(b.slug);
    return a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : a.version.localeCompare(b.version);
  });

  return { docs, errors };
}

function downloadText(filename: string, text: string, mime = "text/plain") {
  const blob = new Blob([text], { type: `${mime}; charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const STUDIO_ACTOR_KEY = "amber-docs:studio:actor:v1";

type DocTypeTemplate = {
  id: string;
  name: string;
  description: string;
  defaultTopics: string[];
  scaffold: (title: string) => string;
};

const DOC_TYPES: DocTypeTemplate[] = [
  {
    id: "general",
    name: "General doc",
    description: "A normal document with a simple structure.",
    defaultTopics: [],
    scaffold: (title) => `# ${title}\n\n## Overview\n\n_TODO: Write an overview._\n`,
  },
  {
    id: "runbook",
    name: "Runbook",
    description: "Step-by-step operational instructions.",
    defaultTopics: ["runbook"],
    scaffold: (title) =>
      `# ${title}\n\n## Overview\n\n_TODO: What is this runbook for?_\\\n\n## Preconditions\n\n- _TODO:_\n\n## Steps\n\n1. _TODO:_\n\n## Rollback\n\n_TODO: How to undo safely._\n\n## Contacts\n\n- _TODO:_\n\n## References\n\n- _TODO:_\n`,
  },
  {
    id: "policy",
    name: "Policy",
    description: "A policy with definitions and approvals.",
    defaultTopics: ["policy"],
    scaffold: (title) =>
      `# ${title}\n\n## Overview\n\n_TODO: What is this policy and why does it exist?_\\\n\n## Scope\n\n_TODO: What does this apply to?_\\\n\n## Policy\n\n_TODO: The rules._\n\n## Definitions\n\n- _TODO:_\n\n## Approvals\n\n_TODO: Who approved and when (also tracked in frontmatter)._\\\n\n## Change log\n\n- _TODO:_\n`,
  },
  {
    id: "faq",
    name: "FAQ",
    description: "Common questions and answers.",
    defaultTopics: ["faq"],
    scaffold: (title) =>
      `# ${title}\n\n## Overview\n\n_TODO: What is this FAQ about?_\\\n\n## Questions\n\n### Q: _TODO_\n\nA: _TODO_\n`,
  },
];

export function StudioClient() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

  const [dirHandle, setDirHandle] = useState<FsDirectoryHandle | null>(null);
  const [docs, setDocs] = useState<LocalDoc[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const [actorName, setActorName] = useState("");
  const [importDraft, setImportDraft] = useState<StudioImportDraft | null>(null);

  const [selectedFile, setSelectedFile] = useState<string>("");
  const selected = useMemo(() => docs.find((d) => d.fileName === selectedFile) ?? null, [docs, selectedFile]);

  const [editTitle, setEditTitle] = useState("");
  const [editSummary, setEditSummary] = useState("");
  const [editStage, setEditStage] = useState<DocStage>("draft");
  const [editArchived, setEditArchived] = useState<boolean>(true);
  const [editVisibility, setEditVisibility] = useState<DocVisibility>("public");
  const [editUpdatedAt, setEditUpdatedAt] = useState("");
  const [editLastReviewedAt, setEditLastReviewedAt] = useState<string>("");
  const [editOwners, setEditOwners] = useState("");
  const [editTopics, setEditTopics] = useState("");
  const [editCollection, setEditCollection] = useState("");
  const [editOrder, setEditOrder] = useState("");
  const [editCitations, setEditCitations] = useState<Array<{ label: string; url: string }>>([]);
  const [editApprovals, setEditApprovals] = useState<Array<{ name: string; date: string }>>([]);
  const [editMarkdown, setEditMarkdown] = useState("");

  const [newTitle, setNewTitle] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newSummary, setNewSummary] = useState("");
  const [newStage, setNewStage] = useState<DocStage>("draft");
  const [newVersion, setNewVersion] = useState<string>(isoDate(new Date()));
  const [newDocType, setNewDocType] = useState<string>("general");
  const [newVisibility, setNewVisibility] = useState<DocVisibility>("internal");
  const [newOwners, setNewOwners] = useState("");
  const [newTopics, setNewTopics] = useState("");
  const [newCollection, setNewCollection] = useState("");
  const [newOrder, setNewOrder] = useState("");
  const [newMarkdown, setNewMarkdown] = useState("");
  const [newCitations, setNewCitations] = useState<Array<{ label: string; url: string }>>([]);
  const [newApprovals, setNewApprovals] = useState<Array<{ name: string; date: string }>>([]);

  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadPreviewIndex, setUploadPreviewIndex] = useState<number>(0);
  const [uploadPreviewName, setUploadPreviewName] = useState<string>("");
  const [uploadPreviewText, setUploadPreviewText] = useState<string>("");
  const [uploadPreviewMarkdown, setUploadPreviewMarkdown] = useState<string>("");
  const [uploadPreviewRender, setUploadPreviewRender] = useState<boolean>(true);
  const [uploadBusy, setUploadBusy] = useState<boolean>(false);
  const [uploadResults, setUploadResults] = useState<ImportResult[]>([]);

  useEffect(() => {
    try {
      setActorName(localStorage.getItem(STUDIO_ACTOR_KEY) ?? "");
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    setImportDraft(readStudioImport());
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STUDIO_ACTOR_KEY, actorName);
    } catch {
      // ignore
    }
  }, [actorName]);

  useEffect(() => {
    if (!newOwners.trim() && actorName.trim()) setNewOwners(actorName.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actorName]);

  useEffect(() => {
    if (!selected) return;
    setEditTitle(selected.title);
    setEditSummary(selected.summary);
    setEditStage(selected.stage);
    setEditArchived(selected.archived);
    setEditVisibility(selected.visibility);
    setEditUpdatedAt(selected.updatedAt);
    setEditLastReviewedAt(selected.lastReviewedAt ?? "");
    setEditOwners(selected.owners.join(", "));
    setEditTopics(selected.topics.join(", "));
    setEditCollection(selected.collection ?? "");
    setEditOrder(selected.order !== null && selected.order !== undefined ? String(selected.order) : "");
    setEditCitations(selected.citations.map((c) => ({ label: c.label, url: c.url ?? "" })));
    setEditApprovals(selected.approvals.map((a) => ({ name: a.name, date: a.date })));
    setEditMarkdown(selected.markdown);
  }, [selected?.fileName]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!newTitle.trim()) return;
    setNewSlug((prev) => (prev.trim() ? prev : slugifyTitle(newTitle)));
  }, [newTitle]);

  useEffect(() => {
    const f = uploadFiles[uploadPreviewIndex] ?? null;
    if (!f) {
      setUploadPreviewName("");
      setUploadPreviewText("");
      setUploadPreviewMarkdown("");
      return;
    }
    setUploadPreviewName(f.name);
    f.text()
      .then((t) => {
        const raw = String(t ?? "");
        setUploadPreviewText(raw);
        try {
          const parsed = matter(raw);
          setUploadPreviewMarkdown(String(parsed.content ?? ""));
        } catch {
          setUploadPreviewMarkdown(raw);
        }
      })
      .catch(() => {
        setUploadPreviewText("");
        setUploadPreviewMarkdown("");
      });
  }, [uploadFiles, uploadPreviewIndex]);

  function applyImportDraft(draft: StudioImportDraft) {
    let fm: Record<string, unknown> = {};
    let md = (draft.markdown ?? "").trimEnd() + "\n";

    if (draft.docText?.trim()) {
      try {
        const parsed = matter(draft.docText);
        fm = (parsed.data ?? {}) as Record<string, unknown>;
        md = (parsed.content ?? "").trimEnd() + "\n";
      } catch (e: unknown) {
        alert(`Could not read the imported draft: ${e instanceof Error ? e.message : String(e)}`);
        return;
      }
    }

    const suggested = draft.suggested ?? {};
    const title =
      (typeof fm.title === "string" ? fm.title : "") ||
      (typeof suggested.title === "string" ? suggested.title : "") ||
      "";
    const slug =
      (typeof fm.slug === "string" ? fm.slug : "") ||
      (typeof suggested.slug === "string" ? suggested.slug : "") ||
      (title ? slugifyTitle(title) : "");
    const summary =
      (typeof fm.summary === "string" ? fm.summary : "") ||
      (typeof suggested.summary === "string" ? suggested.summary : "") ||
      "";

    const stage: DocStage = isStage(fm.stage) ? fm.stage : suggested.stage ?? "draft";
    const visibility: DocVisibility = isVisibility(fm.visibility) ? fm.visibility : suggested.visibility ?? "internal";

    const updatedAtRaw =
      (typeof fm.updatedAt === "string" ? fm.updatedAt : "") || (typeof suggested.updatedAt === "string" ? suggested.updatedAt : "");
    const versionRaw =
      (typeof fm.version === "string" ? fm.version : "") ||
      (typeof suggested.version === "string" ? suggested.version : "") ||
      updatedAtRaw;

    const { version } = resolveVersionAndUpdatedAt({ version: versionRaw || null, updatedAt: updatedAtRaw || null });

    const owners = safeStringArray((fm as Record<string, unknown>).owners).length
      ? safeStringArray((fm as Record<string, unknown>).owners)
      : (suggested.owners ?? []);
    const topics = safeStringArray((fm as Record<string, unknown>).topics).length
      ? safeStringArray((fm as Record<string, unknown>).topics)
      : (suggested.topics ?? []);
    const collection =
      (typeof fm.collection === "string" ? fm.collection : "") ||
      (typeof suggested.collection === "string" ? suggested.collection : "") ||
      "";
    const order =
      typeof fm.order === "number"
        ? fm.order
        : typeof suggested.order === "number"
          ? suggested.order
          : null;

    const citationsFromFm = safeCitations((fm as Record<string, unknown>).citations);
    const approvalsFromFm = safeApprovals((fm as Record<string, unknown>).approvals);
    const citations = citationsFromFm.length ? citationsFromFm : (suggested.citations ?? []);
    const approvals = approvalsFromFm.length ? approvalsFromFm : (suggested.approvals ?? []);

    setNewTitle(title);
    setNewSlug(slug);
    setNewSummary(summary);
    setNewStage(stage);
    setNewVisibility(visibility);
    setNewVersion(version);
    setNewOwners(owners.join(", "));
    setNewTopics(topics.join(", "));
    setNewCollection(collection);
    setNewOrder(order && Number.isFinite(order) ? String(order) : "");
    setNewDocType("general");
    setNewMarkdown(md);
    setNewCitations(citations.map((c) => ({ label: c.label, url: c.url ?? "" })));
    setNewApprovals(approvals.map((a) => ({ name: a.name, date: a.date })));

    clearStudioImport();
    setImportDraft(null);
  }

  async function onImportFiles() {
    const handle = dirHandle;
    if (!handle) {
      alert("Connect your docs folder first (Step 1), then import files.");
      return;
    }
    if (!uploadFiles.length) return;

    setUploadBusy(true);
    setUploadResults([]);
    const results: ImportResult[] = [];

    async function fileExists(dir: FsDirectoryHandle, name: string): Promise<boolean> {
      try {
        await dir.getFileHandle(name);
        return true;
      } catch {
        return false;
      }
    }

    try {
      for (const file of uploadFiles) {
        const sourceName = file.name;
        try {
          const raw = await file.text();
          let fm: Record<string, unknown> = {};
          let md = "";

          try {
            const parsed = matter(raw);
            fm = (parsed.data ?? {}) as Record<string, unknown>;
            md = (parsed.content ?? "").trimEnd() + "\n";
          } catch {
            // If frontmatter parsing fails, treat the entire file as markdown.
            fm = {};
            md = String(raw ?? "").trimEnd() + "\n";
          }

          const fallbackTitle = slugFromFilename(file.name);
          const title =
            (typeof fm.title === "string" ? fm.title.trim() : "") ||
            titleFromMarkdown(md, fallbackTitle) ||
            fallbackTitle;

          const slug =
            (typeof fm.slug === "string" ? fm.slug.trim() : "") ||
            (title ? slugifyTitle(title) : "") ||
            slugFromFilename(file.name);

          const summary =
            (typeof fm.summary === "string" ? fm.summary.trim() : "") ||
            summaryFromMarkdown(md) ||
            "";

          const stage: DocStage = isStage(fm.stage) ? fm.stage : "draft";
          const archived = typeof fm.archived === "boolean" ? fm.archived : true; // imported docs default to unpublished
          const visibility: DocVisibility = isVisibility(fm.visibility) ? fm.visibility : "internal";

          const updatedAtRaw = typeof fm.updatedAt === "string" ? fm.updatedAt.trim() : "";
          const versionRaw = typeof fm.version === "string" ? fm.version.trim() : updatedAtRaw;
          const { version, updatedAt } = resolveVersionAndUpdatedAt({
            version: versionRaw || null,
            updatedAt: updatedAtRaw || null,
          });

          const owners = safeStringArray(fm.owners);
          const topics = safeStringArray(fm.topics);
          const collection = typeof fm.collection === "string" ? fm.collection.trim() : "";
          const order = typeof fm.order === "number" ? fm.order : null;
          const citations = safeCitations(fm.citations);
          const approvals = safeApprovals(fm.approvals);

          const importAudit: AuditEntry = {
            at: new Date().toISOString(),
            action: "import",
            actor: actorName.trim() || undefined,
            note: `from ${sourceName}`,
          };
          const nextAudit = [...safeAudit(fm.audit), importAudit].slice(-200);

          const outFm: Record<string, unknown> = {
            ...fm,
            slug,
            version,
            title,
            stage,
            archived,
            visibility,
            summary,
            updatedAt,
            owners,
            topics,
            collection: collection || undefined,
            order: typeof order === "number" && Number.isFinite(order) && order > 0 ? Math.trunc(order) : undefined,
            citations: citations.length ? citations : undefined,
            approvals: approvals.length ? approvals : undefined,
            audit: nextAudit.length ? nextAudit : undefined,
          };

          const wantsMdx = file.name.toLowerCase().endsWith(".mdx");
          let candidate = suggestedDocFileName(slug, version);
          if (wantsMdx) candidate = candidate.replace(/\.md$/i, ".mdx");

          // Avoid overwriting existing files.
          let fileName = candidate;
          if (await fileExists(handle, fileName)) {
            const ext = wantsMdx ? ".mdx" : ".md";
            const base = candidate.replace(/\.(md|mdx)$/i, "");
            let n = 1;
            while (await fileExists(handle, `${base}--import-${n}${ext}`)) n += 1;
            fileName = `${base}--import-${n}${ext}`;
          }

          const outHandle = await handle.getFileHandle(fileName, { create: true });
          const body = matter.stringify(md, stripUndefined(outFm) as Record<string, unknown>);
          await writeHandleText(outHandle, body);

          results.push({ sourceName, ok: true, fileName, slug: safeFilePart(slug), version });
        } catch (e: unknown) {
          results.push({
            sourceName,
            ok: false,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }
    } finally {
      setUploadBusy(false);
      setUploadResults(results);
    }

    // Refresh docs list if at least one import succeeded.
    if (results.some((r) => r.ok)) {
      await refresh();
      setUploadFiles([]);
      setUploadPreviewIndex(0);
    }
  }

  async function refresh(handle = dirHandle) {
    if (!handle) return;
    setBusy(true);
    try {
      const r = await scanDocsDir(handle);
      setDocs(r.docs);
      setErrors(r.errors);
      setSelectedFile((prev) => (r.docs.some((d) => d.fileName === prev) ? prev : ""));
    } finally {
      setBusy(false);
    }
  }

  async function onConnect() {
    setErrors([]);
    const handle = await pickDirectoryHandle();
    if (!handle) {
      alert("This browser does not support connecting to a folder. Use Chrome or Edge, or use the CLI scripts.");
      return;
    }
    setDirHandle(handle);
    await refresh(handle);
  }

  function buildEditedFileBody(
    base: LocalDoc,
    overrides: Partial<{
      title: string;
      summary: string;
      stage: DocStage;
      archived: boolean;
      visibility: DocVisibility;
      updatedAt: string;
      lastReviewedAt: string;
      owners: string;
      topics: string;
      collection: string;
      order: string;
      citations: Array<{ label: string; url: string }>;
      approvals: Array<{ name: string; date: string }>;
      markdown: string;
      auditEntry: AuditEntry;
    }> = {},
  ): string {
    const owners = (overrides.owners ?? editOwners)
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    const topics = (overrides.topics ?? editTopics)
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

    const citations: Citation[] = (overrides.citations ?? editCitations)
      .map((c) => ({ label: (c.label ?? "").trim(), url: (c.url ?? "").trim() }))
      .filter((c) => c.label)
      .map((c) => (c.url ? { label: c.label, url: c.url } : { label: c.label }));

    const approvals: Approval[] = (overrides.approvals ?? editApprovals)
      .map((a) => ({ name: (a.name ?? "").trim(), date: (a.date ?? "").trim() }))
      .filter((a) => a.name && a.date);

    const stage = overrides.stage ?? editStage;
    const lastReviewedAt = (overrides.lastReviewedAt ?? editLastReviewedAt).trim();
    const normalizedLastReviewedAt =
      stage === "official" ? (lastReviewedAt || isoDate(new Date())) : lastReviewedAt || undefined;

    const orderRaw = (overrides.order ?? editOrder).trim();
    const order = orderRaw ? Number(orderRaw) : null;
    const orderInt = order !== null && Number.isFinite(order) && order > 0 ? Math.trunc(order) : undefined;

    const auditEntry = overrides.auditEntry;
    const nextAudit = auditEntry
      ? [
          ...safeAudit(base.frontmatter.audit),
          { ...auditEntry, actor: auditEntry.actor ?? (actorName.trim() || undefined) },
        ].slice(-200)
      : safeAudit(base.frontmatter.audit);

    const fm: Record<string, unknown> = {
      ...base.frontmatter,
      slug: base.slug,
      version: base.version,
      title: (overrides.title ?? editTitle).trim() || base.title,
      stage,
      archived: overrides.archived ?? editArchived,
      visibility: overrides.visibility ?? editVisibility,
      summary: (overrides.summary ?? editSummary).trim(),
      updatedAt: (overrides.updatedAt ?? editUpdatedAt).trim() || base.updatedAt,
      lastReviewedAt: normalizedLastReviewedAt,
      owners,
      topics,
      collection: (overrides.collection ?? editCollection).trim() || undefined,
      order: orderInt,
      citations,
      approvals,
      audit: nextAudit.length ? nextAudit : undefined,
    };

    const markdown = (overrides.markdown ?? editMarkdown).trimEnd() + "\n";
    return matter.stringify(markdown, stripUndefined(fm) as Record<string, unknown>);
  }

  async function onSaveEdits() {
    if (!selected || !dirHandle) return;
    if (!editTitle.trim() || !editSummary.trim() || !editUpdatedAt.trim()) {
      alert("Title, summary, and updated date are required.");
      return;
    }
    setBusy(true);
    try {
      const body = buildEditedFileBody(selected, {
        auditEntry: {
          at: new Date().toISOString(),
          action: "update",
        },
      });
      await writeHandleText(selected.handle, body);
      await refresh();
      alert("Saved.");
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onTogglePublish(published: boolean) {
    if (!selected || !dirHandle) return;
    setEditArchived(!published);
    setBusy(true);
    try {
      const nextArchived = !published;
      const body = buildEditedFileBody(selected, {
        archived: nextArchived,
        auditEntry: {
          at: new Date().toISOString(),
          action: nextArchived ? "unpublish" : "publish",
          fromArchived: selected.archived,
          toArchived: nextArchived,
        },
      });
      await writeHandleText(selected.handle, body);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function onSetStage(stage: DocStage) {
    if (!selected || !dirHandle) return;
    setEditStage(stage);
    if (stage === "official" && !editLastReviewedAt.trim()) setEditLastReviewedAt(isoDate(new Date()));
    setBusy(true);
    try {
      const body = buildEditedFileBody(selected, {
        stage,
        auditEntry: {
          at: new Date().toISOString(),
          action: "set_stage",
          fromStage: selected.stage,
          toStage: stage,
        },
      });
      await writeHandleText(selected.handle, body);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function onCloneNewVersion() {
    if (!selected || !dirHandle) return;
    const next = prompt("New version (suggested: YYYY-MM-DD):", isoDate(new Date()));
    if (!next) return;
    const { version, updatedAt } = resolveVersionAndUpdatedAt({ version: next, updatedAt: null });
    const fileName = suggestedDocFileName(selected.slug, version);

    setBusy(true);
    try {
      const handle = await dirHandle.getFileHandle(fileName, { create: true });
      const fm: Record<string, unknown> = {
        ...selected.frontmatter,
        slug: selected.slug,
        version,
        updatedAt,
        stage: "draft",
        archived: true,
        approvals: [],
        lastReviewedAt: undefined,
        audit: [
          {
            at: new Date().toISOString(),
            action: "clone",
            actor: actorName.trim() || undefined,
            note: `from ${selected.version}`,
          } satisfies AuditEntry,
        ],
      };
      const body = matter.stringify(selected.markdown.trimEnd() + "\n", stripUndefined(fm) as Record<string, unknown>);
      await writeHandleText(handle, body);
      await refresh();
      alert(`Created new version: ${fileName}`);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteSelected() {
    if (!selected || !dirHandle) return;
    const ok = confirm(`Delete file "${selected.fileName}"?\n\nThis cannot be undone.`);
    if (!ok) return;
    setBusy(true);
    try {
      await dirHandle.removeEntry(selected.fileName);
      setSelectedFile("");
      await refresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onCreateNew() {
    if (!dirHandle) return;
    const title = newTitle.trim();
    const slug = newSlug.trim();
    const summary = newSummary.trim();
    const { version, updatedAt } = resolveVersionAndUpdatedAt({ version: newVersion.trim(), updatedAt: null });
    if (!title || !slug || !summary || !updatedAt) {
      alert("Title, slug, summary, and version are required.");
      return;
    }

    const fileName = suggestedDocFileName(slug, version);
    const template = DOC_TYPES.find((t) => t.id === newDocType) ?? DOC_TYPES[0]!;
    const md = newMarkdown.trim() ? newMarkdown.trimEnd() + "\n" : template.scaffold(title);
    const owners = newOwners
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    const topics =
      newTopics.trim()
        ? newTopics
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean)
        : template.defaultTopics;
    const orderRaw = newOrder.trim();
    const order = orderRaw ? Number(orderRaw) : null;
    const orderInt = order !== null && Number.isFinite(order) && order > 0 ? Math.trunc(order) : undefined;

    const citations: Citation[] = newCitations
      .map((c) => ({ label: (c.label ?? "").trim(), url: (c.url ?? "").trim() }))
      .filter((c) => c.label)
      .map((c) => (c.url ? { label: c.label, url: c.url } : { label: c.label }));
    const approvals: Approval[] = newApprovals
      .map((a) => ({ name: (a.name ?? "").trim(), date: (a.date ?? "").trim() }))
      .filter((a) => a.name && a.date);

    const fm: Record<string, unknown> = {
      slug,
      version,
      title,
      stage: newStage,
      archived: true,
      visibility: newVisibility,
      summary,
      updatedAt,
      owners,
      topics,
      collection: newCollection.trim() || undefined,
      order: orderInt,
      citations,
      approvals,
      audit: [
        {
          at: new Date().toISOString(),
          action: "create",
          actor: actorName.trim() || undefined,
          note: template.id !== "general" ? `type:${template.id}` : undefined,
        } satisfies AuditEntry,
      ],
    };

    setBusy(true);
    try {
      const handle = await dirHandle.getFileHandle(fileName, { create: true });
      const body = matter.stringify(md, stripUndefined(fm) as Record<string, unknown>);
      await writeHandleText(handle, body);
      setNewTitle("");
      setNewSlug("");
      setNewSummary("");
      setNewStage("draft");
      setNewVersion(isoDate(new Date()));
      setNewDocType("general");
      setNewVisibility("internal");
      setNewOwners(actorName.trim() || "");
      setNewTopics("");
      setNewCollection("");
      setNewOrder("");
      setNewMarkdown("");
      setNewCitations([]);
      setNewApprovals([]);
      await refresh();
      alert(`Created: ${fileName}\n\nIt is currently unpublished. Use Publish when ready.`);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page max-w-6xl">
      <header className="mb-8 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-zinc-700">Write + publish</p>
            <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">Manage document files</h1>
          </div>
          <nav className="flex flex-wrap gap-2">
            <Link href="/docs" className="btn btn-secondary">
              Documents
            </Link>
            <Link href="/templates" className="btn btn-secondary">
              Templates
            </Link>
            <Link href="/assistant" className="btn btn-secondary">
              Ask AI
            </Link>
            <Link href="/blocks" className="btn btn-secondary">
              Reusable text
            </Link>
            <Link href="/help" className="btn btn-secondary">
              Help
            </Link>
          </nav>
        </div>
        <p className="max-w-3xl text-zinc-800">
          This page can <span className="font-semibold">create</span>, <span className="font-semibold">edit</span>,{" "}
          <span className="font-semibold">publish</span>, and <span className="font-semibold">unpublish</span> the Markdown
          files in your <code>content/docs</code> folder.
        </p>
      </header>

      {importDraft ? (
        <section id="import" className="mb-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-950">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-display text-2xl font-semibold">Draft ready to import</div>
              <div className="mt-1 text-sm text-emerald-900">
                A draft was sent here from <span className="font-semibold">{importDraft.source === "assistant" ? "Ask AI" : "Templates"}</span>.
                Click <span className="font-semibold">Load</span> to fill out Step 2 automatically.
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-primary" type="button" disabled={busy} onClick={() => applyImportDraft(importDraft)}>
                Load imported draft
              </button>
              <button
                className="btn btn-secondary"
                type="button"
                disabled={busy}
                onClick={() => {
                  clearStudioImport();
                  setImportDraft(null);
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
          <div className="mt-3 text-sm text-emerald-900">
            After loading, you can edit the title/slug/summary and then click <span className="font-semibold">Create doc file</span>.
            New docs still start unpublished.
          </div>
        </section>
      ) : null}

      <section className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-semibold">Step 1: Connect your docs folder</h2>
            <p className="mt-1 text-zinc-700">
              Click the button, then choose your <span className="font-semibold">content/docs</span> folder.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn btn-primary" type="button" onClick={onConnect} disabled={busy}>
              {dirHandle ? "Reconnect folder" : "Choose docs folder"}
            </button>
            {dirHandle ? (
              <button className="btn btn-secondary" type="button" onClick={() => refresh()} disabled={busy}>
                Refresh list
              </button>
            ) : null}
          </div>
        </div>

        <label className="mt-4 block">
          <div className="text-sm font-semibold text-zinc-800">Your name (optional)</div>
          <input
            className="mt-2 w-full control"
            value={actorName}
            onChange={(e) => setActorName(e.target.value)}
            placeholder="Example: Jane Doe"
            autoComplete="name"
          />
          <div className="mt-2 text-sm text-zinc-600">
            If you fill this in, Studio will write your name into each document’s <span className="font-semibold">audit log</span> when you publish/unpublish or change status.
          </div>
        </label>

        {!dirHandle ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <div className="font-semibold">No folder connected yet.</div>
            <div className="mt-1">
              If your browser does not support this feature, you can still manage files using the CLI scripts:
              <div className="mt-2">
                <CopyButton
                  text={"pnpm docs:new -- --slug a --title \"Title\" --summary \"Summary\" --updated-at 2026-02-08\npnpm docs:publish -- --slug a --version 2026-02-08"}
                  label="Copy CLI examples"
                />
              </div>
            </div>
          </div>
        ) : null}

        {errors.length ? (
          <details className="mt-4 rounded-xl border border-zinc-200 bg-white p-4">
            <summary className="cursor-pointer text-sm font-semibold text-zinc-900">
              Warnings ({errors.length})
            </summary>
            <ul className="mt-2 list-disc space-y-1 pl-6 text-sm text-zinc-700">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </details>
        ) : null}

        <details className="mt-4 rounded-xl border border-zinc-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold text-zinc-900">Convex status (optional backend)</summary>
          <div className="mt-2 text-sm text-zinc-700">
            {convexUrl ? (
              <div>
                Convex is <span className="font-semibold">configured</span> for this build: <code>{convexUrl}</code>
                <div className="mt-2">
                  Note: Studio’s browser editing and file import features are <span className="font-semibold">file-based</span> (they edit your <code>content/docs</code> folder).
                  Convex is not required for uploading/importing docs here.
                </div>
              </div>
            ) : (
              <div>
                Convex is <span className="font-semibold">not configured</span> (missing <code>NEXT_PUBLIC_CONVEX_URL</code>).
                <div className="mt-2">
                  This is OK: the docs site and Studio can run purely from files. If you want Convex features, set <code>NEXT_PUBLIC_CONVEX_URL</code> and run <code>pnpm dev</code> to start both Next and Convex.
                </div>
              </div>
            )}
          </div>
        </details>
      </section>

      <section className="mt-8 card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-semibold">Step 1b: Upload / preview / import files</h2>
            <p className="mt-1 text-zinc-700">
              Choose Markdown files from your computer to <span className="font-semibold">preview</span> them here. If your docs folder is connected, you can also{" "}
              <span className="font-semibold">import</span> them into <code>content/docs</code>.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="btn btn-secondary"
              type="button"
              disabled={uploadBusy || !uploadFiles.length}
              onClick={() => {
                setUploadFiles([]);
                setUploadPreviewIndex(0);
                setUploadResults([]);
              }}
            >
              Clear selection
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <label className="block">
              <div className="text-sm font-semibold text-zinc-800">Choose files</div>
              <input
                className="mt-2 w-full"
                type="file"
                multiple
                accept=".md,.mdx,text/markdown,text/plain,.txt"
                onChange={(e) => {
                  const list = Array.from(e.target.files ?? []);
                  setUploadFiles(list);
                  setUploadPreviewIndex(0);
                  setUploadResults([]);
                }}
                disabled={uploadBusy}
              />
              <div className="mt-2 text-sm text-zinc-600">
                Tip: If you are on iPhone/iPad Safari, folder import may not work. Use Chrome or Edge on desktop for the best experience.
              </div>
            </label>

            {uploadFiles.length ? (
              <div className="rounded-xl border border-zinc-200 bg-white p-4">
                <div className="text-sm font-semibold text-zinc-900">Selected</div>
                <div className="mt-2 text-sm text-zinc-700">
                  <span className="font-semibold">{uploadFiles.length}</span> file{uploadFiles.length === 1 ? "" : "s"} chosen
                </div>
                {uploadFiles.length > 1 ? (
                  <label className="mt-3 block">
                    <div className="text-sm font-semibold text-zinc-800">Preview which file?</div>
                    <select
                      className="mt-2 w-full control"
                      value={String(uploadPreviewIndex)}
                      onChange={(e) => setUploadPreviewIndex(Number(e.target.value) || 0)}
                      disabled={uploadBusy}
                    >
                      {uploadFiles.map((f, idx) => (
                        <option key={`${f.name}-${idx}`} value={String(idx)}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    className="btn btn-primary"
                    type="button"
                    onClick={onImportFiles}
                    disabled={!uploadFiles.length || !dirHandle || uploadBusy}
                  >
                    Import into docs folder
                  </button>
                  <button
                    className="btn btn-secondary"
                    type="button"
                    onClick={() => {
                      if (!uploadFiles.length) return;
                      const f = uploadFiles[uploadPreviewIndex] ?? uploadFiles[0]!;
                      downloadText(f.name, uploadPreviewText || "", "text/plain");
                    }}
                    disabled={!uploadFiles.length || uploadBusy}
                  >
                    Download preview text
                  </button>
                </div>

                {!dirHandle ? (
                  <div className="mt-3 text-sm text-zinc-600">
                    To import into the project, connect your <code>content/docs</code> folder in Step 1.
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-700">
                No files selected yet.
              </div>
            )}

            {uploadResults.length ? (
              <details className="rounded-xl border border-zinc-200 bg-white p-4" open>
                <summary className="cursor-pointer text-base font-semibold text-zinc-900">
                  Import results ({uploadResults.filter((r) => r.ok).length} ok, {uploadResults.filter((r) => !r.ok).length} failed)
                </summary>
                <ul className="mt-3 list-disc space-y-1 pl-6 text-sm text-zinc-700">
                  {uploadResults.map((r) => (
                    <li key={`${r.sourceName}-${r.fileName ?? r.error ?? "x"}`}>
                      <span className="font-semibold">{r.sourceName}</span>:{" "}
                      {r.ok ? (
                        <span>
                          imported as <span className="font-semibold">{r.fileName}</span> (slug <span className="font-semibold">{r.slug}</span>, v{r.version})
                        </span>
                      ) : (
                        <span className="text-rose-700">failed: {r.error}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-zinc-900">Preview</div>
                <div className="text-sm text-zinc-600">{uploadPreviewName ? uploadPreviewName : "Choose a file to preview"}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className={uploadPreviewRender ? "btn btn-primary" : "btn btn-secondary"}
                  type="button"
                  onClick={() => setUploadPreviewRender(true)}
                  disabled={!uploadPreviewText}
                >
                  Rendered
                </button>
                <button
                  className={!uploadPreviewRender ? "btn btn-primary" : "btn btn-secondary"}
                  type="button"
                  onClick={() => setUploadPreviewRender(false)}
                  disabled={!uploadPreviewText}
                >
                  Raw text
                </button>
              </div>
            </div>
            <div className="max-h-[32rem] overflow-auto rounded-2xl border border-zinc-200 bg-white p-4">
              {uploadPreviewText ? (
                uploadPreviewRender ? (
                  <Markdown value={uploadPreviewMarkdown || uploadPreviewText} />
                ) : (
                  <pre className="whitespace-pre-wrap font-mono text-sm text-zinc-900">{uploadPreviewText}</pre>
                )
              ) : (
                <div className="text-sm text-zinc-700">Nothing to preview yet.</div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <h2 className="font-display text-2xl font-semibold">Step 2: Create a new doc file</h2>
          <p className="mt-1 text-zinc-700">
            New docs start <span className="font-semibold">unpublished</span>, so they do not show up in the Documents list until you publish.
          </p>
          <div className="mt-4 grid gap-3">
            <label className="block">
              <div className="text-sm font-semibold text-zinc-800">Title</div>
              <input
                className="mt-2 w-full control"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Example: Treasury Strategy Q3"
              />
            </label>
            <label className="block">
              <div className="text-sm font-semibold text-zinc-800">Slug (URL name)</div>
              <input
                className="mt-2 w-full control"
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
                placeholder="example: treasury-strategy-q3"
              />
            </label>
            <label className="block">
              <div className="text-sm font-semibold text-zinc-800">Summary (1 sentence)</div>
              <input
                className="mt-2 w-full control"
                value={newSummary}
                onChange={(e) => setNewSummary(e.target.value)}
                placeholder="What is this doc for?"
              />
            </label>
            <label className="block">
              <div className="text-sm font-semibold text-zinc-800">Document type</div>
              <select
                className="mt-2 w-full control"
                value={newDocType}
                onChange={(e) => setNewDocType(e.target.value)}
              >
                {DOC_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <div className="mt-2 text-sm text-zinc-600">
                {DOC_TYPES.find((t) => t.id === newDocType)?.description ?? ""}
              </div>
            </label>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block">
                <div className="text-sm font-semibold text-zinc-800">Status</div>
                <select
                  className="mt-2 w-full control"
                  value={newStage}
                  onChange={(e) => setNewStage(e.target.value as DocStage)}
                >
                  <option value="draft">Draft</option>
                  <option value="final">Final</option>
                  <option value="official">Official</option>
                </select>
              </label>
              <label className="block">
                <div className="text-sm font-semibold text-zinc-800">Version (usually a date)</div>
                <input
                  className="mt-2 w-full control"
                  value={newVersion}
                  onChange={(e) => setNewVersion(e.target.value)}
                  placeholder="YYYY-MM-DD"
                />
              </label>
            </div>
            <details className="rounded-xl border border-zinc-200 bg-white p-4">
              <summary className="cursor-pointer text-base font-semibold text-zinc-900">
                Advanced: Owners, topics, visibility
              </summary>
              <div className="mt-4 grid gap-3">
                <label className="block">
                  <div className="text-sm font-semibold text-zinc-800">Owners (comma separated)</div>
                  <input
                    className="mt-2 w-full control"
                    value={newOwners}
                    onChange={(e) => setNewOwners(e.target.value)}
                    placeholder="Example: Docs Maintainer, Ops Lead"
                  />
                </label>
                <label className="block">
                  <div className="text-sm font-semibold text-zinc-800">Topics (comma separated)</div>
                  <input
                    className="mt-2 w-full control"
                    value={newTopics}
                    onChange={(e) => setNewTopics(e.target.value)}
                    placeholder="Example: treasury, governance"
                  />
                  <div className="mt-2 text-sm text-zinc-600">
                    Tip: Leave blank to use the default topics for the chosen document type (if any).
                  </div>
                </label>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="block">
                    <div className="text-sm font-semibold text-zinc-800">Reading list (optional)</div>
                    <input
                      className="mt-2 w-full control"
                      value={newCollection}
                      onChange={(e) => setNewCollection(e.target.value)}
                      placeholder="Example: Treasury onboarding"
                    />
                  </label>
                  <label className="block">
                    <div className="text-sm font-semibold text-zinc-800">Reading list order (optional)</div>
                    <input
                      className="mt-2 w-full control"
                      value={newOrder}
                      onChange={(e) => setNewOrder(e.target.value)}
                      placeholder="Example: 1"
                      inputMode="numeric"
                    />
                  </label>
                </div>
                <label className="block">
                  <div className="text-sm font-semibold text-zinc-800">Visibility</div>
                  <select
                    className="mt-2 w-full control"
                    value={newVisibility}
                    onChange={(e) => setNewVisibility(e.target.value as DocVisibility)}
                  >
                    <option value="internal">Internal</option>
                    <option value="public">Public</option>
                    <option value="private">Private</option>
                  </select>
                  <div className="mt-2 text-sm text-zinc-600">
                    Public docs can appear in the public export. Internal/private docs are excluded when building the public site.
                  </div>
                </label>
              </div>
            </details>

            <details className="rounded-xl border border-zinc-200 bg-white p-4">
              <summary className="cursor-pointer text-base font-semibold text-zinc-900">
                Advanced: Initial content (optional)
              </summary>
              <div className="mt-3 text-sm text-zinc-700">
                Leave this alone to use the template scaffold. If you have a draft from Ask AI or Templates, it will appear here after you load it.
              </div>
              <textarea
                className="mt-3 h-56 w-full rounded-xl border border-zinc-300 bg-white p-4 font-mono text-sm text-zinc-900"
                value={
                  newMarkdown.trim()
                    ? newMarkdown
                    : (DOC_TYPES.find((t) => t.id === newDocType) ?? DOC_TYPES[0]!).scaffold(newTitle.trim() || "Title")
                }
                onChange={(e) => setNewMarkdown(e.target.value)}
                spellCheck={false}
              />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button className="btn btn-secondary" type="button" onClick={() => setNewMarkdown("")} disabled={busy}>
                  Reset to scaffold
                </button>
                {newCitations.length || newApprovals.length ? (
                  <button
                    className="btn btn-secondary"
                    type="button"
                    onClick={() => {
                      setNewCitations([]);
                      setNewApprovals([]);
                    }}
                    disabled={busy}
                  >
                    Clear imported citations/approvals
                  </button>
                ) : null}
              </div>
              {newCitations.length || newApprovals.length ? (
                <div className="mt-3 text-sm text-zinc-700">
                  Imported frontmatter: <span className="font-semibold">{newCitations.length}</span> citations,{" "}
                  <span className="font-semibold">{newApprovals.length}</span> approvals.
                </div>
              ) : null}
            </details>
            <button className="btn btn-primary" type="button" onClick={onCreateNew} disabled={!dirHandle || busy}>
              Create doc file
            </button>
            {!dirHandle ? (
              <div className="text-sm text-zinc-600">
                Connect a folder first to create files from the browser.
              </div>
            ) : null}
          </div>
        </div>

        <div className="card p-6">
          <h2 className="font-display text-2xl font-semibold">Step 3: Publish / edit an existing doc</h2>
          <p className="mt-1 text-zinc-700">
            Pick a file, then use the buttons to publish/unpublish it, mark it Final or Official, create a new version, or delete it.
          </p>

          <label className="mt-4 block">
            <div className="text-sm font-semibold text-zinc-800">Choose a document</div>
            <select
              className="mt-2 w-full control"
              value={selectedFile}
              onChange={(e) => setSelectedFile(e.target.value)}
              disabled={!dirHandle || busy}
            >
              <option value="">{dirHandle ? "Select..." : "Connect folder first"}</option>
              {docs.map((d) => (
                <option key={d.fileName} value={d.fileName}>
                  {d.slug} v{d.version} {d.archived ? "(unpublished)" : ""} {d.visibility !== "public" ? `(${d.visibility})` : ""}
                </option>
              ))}
            </select>
          </label>

          {selected ? (
            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`chip ${stageBadgeClass(selected.stage)}`}>{selected.stage}</span>
                {selected.archived ? <span className="chip bg-amber-100 text-amber-900">unpublished</span> : <span className="chip chip-muted">published</span>}
                {selected.visibility !== "public" ? <span className="chip chip-outline">{selected.visibility}</span> : <span className="chip chip-muted">public</span>}
                <span className="chip chip-muted">{selected.updatedAt || "no updatedAt"}</span>
              </div>

              <div className="flex flex-wrap gap-2">
                <button className="btn btn-primary" type="button" disabled={busy} onClick={() => onTogglePublish(true)}>
                  Publish
                </button>
                <button className="btn btn-secondary" type="button" disabled={busy} onClick={() => onTogglePublish(false)}>
                  Unpublish
                </button>
                <button className="btn btn-secondary" type="button" disabled={busy} onClick={() => onSetStage("final")}>
                  Mark Final
                </button>
                <button className="btn btn-secondary" type="button" disabled={busy} onClick={() => onSetStage("official")}>
                  Mark Official
                </button>
                <button className="btn btn-secondary" type="button" disabled={busy} onClick={onCloneNewVersion}>
                  New version
                </button>
                <button className="btn btn-secondary" type="button" disabled={busy} onClick={onDeleteSelected}>
                  Delete file
                </button>
              </div>

              <details className="rounded-xl border border-zinc-200 bg-white p-4">
                <summary className="cursor-pointer text-base font-semibold text-zinc-900">Edit details + Markdown</summary>

                <div className="mt-4 grid gap-3">
                  <label className="block">
                    <div className="text-sm font-semibold text-zinc-800">Title</div>
                    <input
                      className="mt-2 w-full control"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                    />
                  </label>

                  <label className="block">
                    <div className="text-sm font-semibold text-zinc-800">Summary</div>
                    <input
                      className="mt-2 w-full control"
                      value={editSummary}
                      onChange={(e) => setEditSummary(e.target.value)}
                    />
                  </label>

                  <div className="grid gap-3 md:grid-cols-3">
                    <label className="block">
                      <div className="text-sm font-semibold text-zinc-800">Status</div>
                      <select
                        className="mt-2 w-full control"
                        value={editStage}
                        onChange={(e) => setEditStage(e.target.value as DocStage)}
                      >
                        <option value="draft">Draft</option>
                        <option value="final">Final</option>
                        <option value="official">Official</option>
                      </select>
                    </label>

                    <label className="block">
                      <div className="text-sm font-semibold text-zinc-800">Published?</div>
                      <select
                        className="mt-2 w-full control"
                        value={editArchived ? "no" : "yes"}
                        onChange={(e) => setEditArchived(e.target.value !== "yes")}
                      >
                        <option value="yes">Yes (published)</option>
                        <option value="no">No (unpublished)</option>
                      </select>
                    </label>

                    <label className="block">
                      <div className="text-sm font-semibold text-zinc-800">Visibility</div>
                      <select
                        className="mt-2 w-full control"
                        value={editVisibility}
                        onChange={(e) => setEditVisibility(e.target.value as DocVisibility)}
                      >
                        <option value="internal">Internal</option>
                        <option value="public">Public</option>
                        <option value="private">Private</option>
                      </select>
                    </label>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="block">
                      <div className="text-sm font-semibold text-zinc-800">Updated date</div>
                      <input
                        className="mt-2 w-full control"
                        value={editUpdatedAt}
                        onChange={(e) => setEditUpdatedAt(e.target.value)}
                        placeholder="YYYY-MM-DD"
                      />
                    </label>
                    <label className="block">
                      <div className="text-sm font-semibold text-zinc-800">Last reviewed date (official)</div>
                      <input
                        className="mt-2 w-full control"
                        value={editLastReviewedAt}
                        onChange={(e) => setEditLastReviewedAt(e.target.value)}
                        placeholder="YYYY-MM-DD"
                      />
                    </label>
                  </div>

                  <label className="block">
                    <div className="text-sm font-semibold text-zinc-800">Owners (comma separated)</div>
                    <input
                      className="mt-2 w-full control"
                      value={editOwners}
                      onChange={(e) => setEditOwners(e.target.value)}
                      placeholder="Example: Docs Maintainer, Protocol Lead"
                    />
                  </label>

                  <label className="block">
                    <div className="text-sm font-semibold text-zinc-800">Topics (comma separated)</div>
                    <input
                      className="mt-2 w-full control"
                      value={editTopics}
                      onChange={(e) => setEditTopics(e.target.value)}
                      placeholder="Example: process, governance"
                    />
                  </label>

                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="block">
                      <div className="text-sm font-semibold text-zinc-800">Reading list (optional)</div>
                      <input
                        className="mt-2 w-full control"
                        value={editCollection}
                        onChange={(e) => setEditCollection(e.target.value)}
                        placeholder="Example: Treasury onboarding"
                      />
                    </label>
                    <label className="block">
                      <div className="text-sm font-semibold text-zinc-800">Reading list order (optional)</div>
                      <input
                        className="mt-2 w-full control"
                        value={editOrder}
                        onChange={(e) => setEditOrder(e.target.value)}
                        placeholder="Example: 1"
                        inputMode="numeric"
                      />
                    </label>
                  </div>

                  <details className="rounded-xl border border-zinc-200 bg-white p-4">
                    <summary className="cursor-pointer text-base font-semibold text-zinc-900">
                      Advanced: Citations + approvals (Official)
                    </summary>
                    <div className="mt-3 text-sm text-zinc-700">
                      Official docs should include at least <span className="font-semibold">1 citation</span> and{" "}
                      <span className="font-semibold">1 approval</span>. This is checked by <code>pnpm qa</code>.
                    </div>

                    <div className="mt-4 grid gap-4">
                      <div>
                        <div className="text-sm font-semibold text-zinc-800">Citations</div>
                        <div className="mt-2 grid gap-3">
                          {editCitations.map((c, idx) => (
                            <div key={idx} className="rounded-xl border border-zinc-200 bg-white p-4">
                              <div className="grid gap-3 md:grid-cols-5">
                                <label className="block md:col-span-2">
                                  <div className="text-sm font-semibold text-zinc-800">Label</div>
                                  <input
                                    className="mt-2 w-full control"
                                    value={c.label}
                                    onChange={(e) =>
                                      setEditCitations((prev) => prev.map((x, i) => (i === idx ? { ...x, label: e.target.value } : x)))
                                    }
                                    placeholder="Example: Treasury report (internal)"
                                  />
                                </label>
                                <label className="block md:col-span-3">
                                  <div className="text-sm font-semibold text-zinc-800">URL (optional)</div>
                                  <input
                                    className="mt-2 w-full control"
                                    value={c.url}
                                    onChange={(e) =>
                                      setEditCitations((prev) => prev.map((x, i) => (i === idx ? { ...x, url: e.target.value } : x)))
                                    }
                                    placeholder="https://..."
                                    autoComplete="off"
                                  />
                                </label>
                              </div>
                              <div className="mt-3 flex justify-end">
                                <button
                                  className="btn btn-secondary"
                                  type="button"
                                  onClick={() => setEditCitations((prev) => prev.filter((_, i) => i !== idx))}
                                >
                                  Remove citation
                                </button>
                              </div>
                            </div>
                          ))}
                          <button
                            className="btn btn-secondary"
                            type="button"
                            onClick={() => setEditCitations((prev) => [...prev, { label: "", url: "" }])}
                          >
                            Add citation
                          </button>
                        </div>
                      </div>

                      <div>
                        <div className="text-sm font-semibold text-zinc-800">Approvals</div>
                        <div className="mt-2 grid gap-3">
                          {editApprovals.map((a, idx) => (
                            <div key={idx} className="rounded-xl border border-zinc-200 bg-white p-4">
                              <div className="grid gap-3 md:grid-cols-5">
                                <label className="block md:col-span-3">
                                  <div className="text-sm font-semibold text-zinc-800">Name</div>
                                  <input
                                    className="mt-2 w-full control"
                                    value={a.name}
                                    onChange={(e) =>
                                      setEditApprovals((prev) => prev.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)))
                                    }
                                    placeholder="Example: Alice"
                                    autoComplete="name"
                                  />
                                </label>
                                <label className="block md:col-span-2">
                                  <div className="text-sm font-semibold text-zinc-800">Date</div>
                                  <input
                                    className="mt-2 w-full control"
                                    value={a.date}
                                    onChange={(e) =>
                                      setEditApprovals((prev) => prev.map((x, i) => (i === idx ? { ...x, date: e.target.value } : x)))
                                    }
                                    placeholder="YYYY-MM-DD"
                                  />
                                </label>
                              </div>
                              <div className="mt-3 flex justify-end">
                                <button
                                  className="btn btn-secondary"
                                  type="button"
                                  onClick={() => setEditApprovals((prev) => prev.filter((_, i) => i !== idx))}
                                >
                                  Remove approval
                                </button>
                              </div>
                            </div>
                          ))}
                          <button
                            className="btn btn-secondary"
                            type="button"
                            onClick={() => setEditApprovals((prev) => [...prev, { name: "", date: isoDate(new Date()) }])}
                          >
                            Add approval
                          </button>
                        </div>
                      </div>
                    </div>
                  </details>

                  <label className="block">
                    <div className="text-sm font-semibold text-zinc-800">Markdown</div>
                    <textarea
                      className="mt-2 h-56 w-full rounded-xl border border-zinc-200 bg-white p-4 font-mono text-sm text-zinc-900"
                      value={editMarkdown}
                      onChange={(e) => setEditMarkdown(e.target.value)}
                      spellCheck={false}
                    />
                  </label>

                  <details className="rounded-xl border border-zinc-200 bg-white p-4">
                    <summary className="cursor-pointer text-base font-semibold text-zinc-900">Preview (rendered)</summary>
                    <div className="mt-4 max-h-[28rem] overflow-auto rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                      <Markdown value={editMarkdown} />
                    </div>
                  </details>

                  <div className="flex flex-wrap items-center gap-2">
                    <button className="btn btn-primary" type="button" onClick={onSaveEdits} disabled={busy}>
                      Save changes
                    </button>
                    <button
                      className="btn btn-secondary"
                      type="button"
                      onClick={() =>
                        downloadText(
                          selected.fileName,
                          buildEditedFileBody(selected),
                          selected.fileName.endsWith(".mdx") ? "text/markdown" : "text/markdown",
                        )
                      }
                      disabled={busy}
                    >
                      Download edited file
                    </button>
                  </div>
                </div>
              </details>
            </div>
          ) : null}
        </div>
      </section>

      <section className="mt-8 card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-semibold">Step 4 (Optional): Check for mistakes</h2>
            <p className="mt-1 text-zinc-700">
              These checks run in a terminal. This website cannot run them for you, but you can copy the exact commands.
            </p>
          </div>
          <CopyButton text={"pnpm qa\npnpm test\npnpm build"} label="Copy check commands" />
        </div>

        <details className="mt-6 rounded-xl border border-zinc-200 bg-white p-4">
          <summary className="cursor-pointer text-base font-semibold text-zinc-900">Advanced: Share changes (create a PR)</summary>
          <div className="mt-3 grid gap-3 text-zinc-800">
            <div className="text-sm text-zinc-700">
              If you are working with a team, the usual way to share changes is a Pull Request (PR) on GitHub.
            </div>
            <ol className="list-decimal space-y-2 pl-6 text-sm">
              <li>Open a terminal in the repo folder.</li>
              <li>Run the commands below (you can copy/paste).</li>
              <li>Open GitHub and click “Create pull request”.</li>
            </ol>
            <CopyButton
              text={
                "git checkout -b codex/my-doc-changes\npnpm qa\npnpm test\ngit status\ngit add content/docs\ngit commit -m \"docs: update\"\ngit push -u origin HEAD\n"
              }
              label="Copy PR commands"
            />
          </div>
        </details>
      </section>
    </main>
  );
}
