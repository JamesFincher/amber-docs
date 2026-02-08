"use client";

import Fuse from "fuse.js";
import Link from "next/link";
import matter from "gray-matter";
import { useEffect, useMemo, useRef, useState } from "react";
import type { GlossaryEntry, Snippet } from "@/lib/content/blocks.server";
import type { DocTemplate } from "@/lib/templates";
import { buildMarkdownSkeleton, buildPrompt } from "@/lib/templates";
import type { Approval, Citation, DocStage, DocVisibility } from "@/lib/docs";
import { isoDate, resolveVersionAndUpdatedAt, safeFilePart, suggestedDocFileName } from "@/lib/content/docsWorkflow.shared";
import { geminiGenerateText } from "@/lib/ai/gemini";
import { formatAttachmentsForPrompt, type Attachment } from "@/lib/ai/attachments";
import {
  defaultGeminiModel,
  DEFAULT_GEMINI_FLASH_MODEL,
  DEFAULT_GEMINI_PRO_MODEL,
  GEMINI_MODEL_PRESETS,
  readGeminiSettings,
  writeGeminiSettings,
} from "@/lib/ai/geminiSettings";
import { lintDraftDocText, type DraftLintIssue } from "@/lib/ai/draftLint";
import { computeWriteReady, deletePolicy, officialPatch, stagePatch } from "@/lib/ai/workspacePolicy";
import { diffTextPreview } from "@/lib/ai/textDiff";
import { createWorkspaceBackup, listWorkspaceBackups, restoreWorkspaceBackup } from "@/lib/ai/workspaceBackups";
import type { AgentTranscriptItem, ToolDescriptor } from "@/lib/ai/castleAgent";
import { runAgentLoop } from "@/lib/ai/castleAgent";
import { saveStudioImport } from "@/lib/studioImport";
import { CopyButton } from "@/components/CopyButton";

const CUSTOM_TEMPLATES_KEY = "amber-docs:templates:custom:v1";
const CUSTOM_SNIPPETS_KEY = "amber-docs:blocks:snippets:v1";
const CUSTOM_GLOSSARY_KEY = "amber-docs:blocks:glossary:v1";
const STUDIO_ACTOR_KEY = "amber-docs:studio:actor:v1";

type Chunk = {
  chunkId: string;
  slug: string;
  version: string;
  title: string;
  heading: string | null;
  text: string;
  url: string;
};

type IndexDoc = {
  slug: string;
  version: string;
  title: string;
  stage: DocStage;
  summary: string;
  updatedAt: string;
  lastReviewedAt: string | null;
  owners: string[];
  topics: string[];
  collection: string | null;
  order: number | null;
  headings: string[];
  searchText: string;
  contentHash: string;
  citationsCount: number;
  versionsCount: number;
  url: string;
};

type SynonymsMap = Record<string, string[]>;

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
  getDirectoryHandle(name: string, opts?: { create?: boolean }): Promise<FsDirectoryHandle>;
  removeEntry(name: string, opts?: { recursive?: boolean }): Promise<void>;
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
  summary: string;
  owners: string[];
  topics: string[];
  collection: string | null;
  order: number | null;
  citations: Citation[];
  approvals: Approval[];
  markdown: string;
  frontmatter: Record<string, unknown>;
};

type PlannedEdit = {
  planId: string;
  slug: string;
  version: string;
  fileName: string;
  createdAt: string;
  summary: string;
  diff: string;
  truncated: boolean;
  beforeText: string;
  afterText: string;
};

function downloadText(filename: string, text: string, mime = "text/plain") {
  const blob = new Blob([text], { type: `${mime}; charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function isStage(v: unknown): v is DocStage {
  return v === "draft" || v === "final" || v === "official";
}

function isVisibility(v: unknown): v is DocVisibility {
  return v === "public" || v === "internal" || v === "private";
}

function safeStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => String(x ?? ""))
    .map((x) => x.trim())
    .filter(Boolean);
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

function asRecord(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  return v as Record<string, unknown>;
}

function safeStringRecord(v: unknown): Record<string, string> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === "string") out[k] = val;
    else if (typeof val === "number" || typeof val === "boolean") out[k] = String(val);
  }
  return out;
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

function tokens(q: string): string[] {
  return q
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 24);
}

function scoreText(haystack: string, qTokens: string[]): number {
  const hay = haystack.toLowerCase();
  let score = 0;
  for (const t of qTokens) {
    if (t.length < 3) continue;
    if (hay.includes(t)) score += 1;
  }
  return score;
}

function slugifyTitle(title: string): string {
  const base = safeFilePart(title.trim().toLowerCase());
  return base || "new-doc";
}

async function pickDirectoryHandle(mode: "read" | "readwrite"): Promise<FsDirectoryHandle | null> {
  const picker = (window as Window & {
    showDirectoryPicker?: (opts?: { mode?: "read" | "readwrite" }) => Promise<unknown>;
  }).showDirectoryPicker;
  if (!picker) return null;
  return (await picker({ mode })) as FsDirectoryHandle;
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
        summary,
        owners: safeStringArray(fm.owners),
        topics: safeStringArray(fm.topics),
        collection: typeof fm.collection === "string" ? fm.collection : null,
        order: typeof fm.order === "number" ? fm.order : null,
        citations: safeCitations(fm.citations),
        approvals: safeApprovals(fm.approvals),
        markdown,
        frontmatter: fm,
      });
    } catch (e: unknown) {
      errors.push(`Skipping "${fileName}": ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  docs.sort((a, b) => {
    if (a.slug !== b.slug) return a.slug.localeCompare(b.slug);
    return a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : a.version.localeCompare(b.version);
  });

  return { docs, errors };
}

function safeParseArray(raw: string): unknown[] | null {
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

function readCustomSnippets(): Snippet[] {
  try {
    const raw = localStorage.getItem(CUSTOM_SNIPPETS_KEY);
    if (!raw) return [];
    const arr = safeParseArray(raw);
    if (!arr) return [];
    return arr
      .map((x) => x as Record<string, unknown>)
      .filter((x) => typeof x.id === "string" && typeof x.title === "string" && typeof x.body === "string")
      .map((x) => ({
        id: String(x.id),
        title: String(x.title),
        body: String(x.body),
        tags: Array.isArray(x.tags) ? (x.tags.filter((t) => typeof t === "string") as string[]) : [],
      }));
  } catch {
    return [];
  }
}

function writeCustomSnippets(snippets: Snippet[]) {
  localStorage.setItem(CUSTOM_SNIPPETS_KEY, JSON.stringify(snippets, null, 2));
}

function readCustomGlossary(): GlossaryEntry[] {
  try {
    const raw = localStorage.getItem(CUSTOM_GLOSSARY_KEY);
    if (!raw) return [];
    const arr = safeParseArray(raw);
    if (!arr) return [];
    return arr
      .map((x) => x as Record<string, unknown>)
      .filter((x) => typeof x.term === "string" && typeof x.definition === "string")
      .map((x) => ({
        term: String(x.term),
        definition: String(x.definition),
        synonyms: Array.isArray(x.synonyms) ? (x.synonyms.filter((t) => typeof t === "string") as string[]) : [],
        tags: Array.isArray(x.tags) ? (x.tags.filter((t) => typeof t === "string") as string[]) : [],
      }));
  } catch {
    return [];
  }
}

function writeCustomGlossary(entries: GlossaryEntry[]) {
  localStorage.setItem(CUSTOM_GLOSSARY_KEY, JSON.stringify(entries, null, 2));
}

function readCustomTemplates(): DocTemplate[] {
  try {
    const raw = localStorage.getItem(CUSTOM_TEMPLATES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: DocTemplate[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      const any = item as Record<string, unknown>;
      if (typeof any.id !== "string" || typeof any.name !== "string" || typeof any.description !== "string") continue;
      if (!Array.isArray(any.requiredFields) || !Array.isArray(any.sections)) continue;
      out.push({
        id: any.id,
        name: any.name,
        description: any.description,
        tags: Array.isArray(any.tags) ? (any.tags.filter((x) => typeof x === "string") as string[]) : [],
        requiredFields: (any.requiredFields as unknown[]).map((f) => {
          const ff = f as Record<string, unknown>;
          return { key: String(ff.key ?? ""), label: String(ff.label ?? ""), placeholder: String(ff.placeholder ?? "") };
        }),
        sections: (any.sections as unknown[]).map((s) => {
          const ss = s as Record<string, unknown>;
          return { title: String(ss.title ?? ""), optional: Boolean(ss.optional ?? false) };
        }),
      });
    }
    return out;
  } catch {
    return [];
  }
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function AiAssistantClient({
  disclaimers,
  glossary,
  templates,
}: {
  disclaimers: Snippet[];
  glossary: GlossaryEntry[];
  templates: DocTemplate[];
}) {
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(defaultGeminiModel());

  const [includeContext, setIncludeContext] = useState(true);
  const [includeBlocks, setIncludeBlocks] = useState(true);
  const [includeTemplates, setIncludeTemplates] = useState(true);
  const [allowFileWrites, setAllowFileWrites] = useState(false);
  const [allowDeletes, setAllowDeletes] = useState(false);
  const [previewBeforeWrite, setPreviewBeforeWrite] = useState(true);

  const [dirHandle, setDirHandle] = useState<FsDirectoryHandle | null>(null);
  const [workspaceMode, setWorkspaceMode] = useState<"read" | "readwrite">("read");
  const [workspaceDocs, setWorkspaceDocs] = useState<LocalDoc[]>([]);
  const [workspaceErrors, setWorkspaceErrors] = useState<string[]>([]);
  const workspaceDocsRef = useRef<LocalDoc[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const [presetDoc, setPresetDoc] = useState<{ slug: string; version: string | null } | null>(null);
  const plannedEditsRef = useRef<Map<string, PlannedEdit>>(new Map());
  const [plannedEdit, setPlannedEdit] = useState<PlannedEdit | null>(null);
  const [backups, setBackups] = useState<
    Array<{ backupFileName: string; createdAt: string; slug: string; version: string; title: string }>
  >([]);
  const [backupsBusy, setBackupsBusy] = useState(false);
  const [backupsError, setBackupsError] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [index, setIndex] = useState<IndexDoc[] | null>(null);
  const [synonyms, setSynonyms] = useState<SynonymsMap>({});
  const [chunks, setChunks] = useState<Chunk[] | null>(null);
  const indexRef = useRef<IndexDoc[] | null>(null);
  const synonymsRef = useRef<SynonymsMap>({});
  const chunksRef = useRef<Chunk[] | null>(null);

  const [messages, setMessages] = useState<AgentTranscriptItem[]>([
    {
      role: "assistant",
      content:
        "Tell me what you want to do. Examples:\n- Find the right doc for: \"how do I publish?\"\n- Summarize the Executive Summary\n- Draft a new runbook\n- Update an existing doc and publish it",
    },
  ]);
  const [input, setInput] = useState("");
  const [lastDraft, setLastDraft] = useState<{ docText: string } | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachmentsBusy, setAttachmentsBusy] = useState(false);
  const [attachmentsError, setAttachmentsError] = useState<string | null>(null);

  const [draftLint, setDraftLint] = useState<{ ok: boolean; issues: DraftLintIssue[] } | null>(null);
  const [draftFixBusy, setDraftFixBusy] = useState(false);
  const [draftFixError, setDraftFixError] = useState<string | null>(null);

  useEffect(() => {
    workspaceDocsRef.current = workspaceDocs;
  }, [workspaceDocs]);

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  useEffect(() => {
    synonymsRef.current = synonyms;
  }, [synonyms]);

  useEffect(() => {
    chunksRef.current = chunks;
  }, [chunks]);

  useEffect(() => {
    if (!lastDraft?.docText) {
      setDraftLint(null);
      setDraftFixError(null);
      return;
    }
    const r = lintDraftDocText(lastDraft.docText);
    setDraftLint({ ok: r.ok, issues: r.issues });
  }, [lastDraft?.docText]);

  useEffect(() => {
    const { apiKey, model } = readGeminiSettings();
    if (apiKey) setApiKey(apiKey);
    if (model) setModel(model);
  }, []);

  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const task = sp.get("task") ?? sp.get("q");
      const doc = sp.get("doc");
      const version = sp.get("version");
      if (task && task.trim()) setInput(task);
      else if (doc && doc.trim()) {
        setPresetDoc({ slug: doc.trim(), version: version ? version.trim() : null });
        setInput(
          `Review the document slug \"${doc.trim()}\"${version ? ` version \"${version.trim()}\"` : ""}.\n\nUse tools (get_doc, search_docs, get_relevant_chunks) as needed.\n\nDo:\n1) Summarize in plain language.\n2) List concrete factual claims and mark (SOURCE NEEDED: ...) for each.\n3) Identify missing sections or unclear steps.\n4) Propose a revised Markdown draft. Include the full draft in final.draft.docText.`,
        );
      }
    } catch {
      // ignore
    }
  }, []);

  async function ensureIndexesLoaded() {
    if (indexRef.current) return;
    const [idx, syn] = await Promise.all([
      fetchJson<IndexDoc[]>("/search-index.json"),
      fetchJson<SynonymsMap>("/synonyms.json"),
    ]);
    if (idx) {
      indexRef.current = idx;
      setIndex(idx);
    }
    if (syn) {
      synonymsRef.current = syn;
      setSynonyms(syn);
    }
  }

  async function ensureChunksLoaded() {
    if (chunksRef.current) return;
    const payload = await fetchJson<{ chunks?: unknown }>("/chunks.json");
    const arr = payload && Array.isArray(payload.chunks) ? (payload.chunks as Chunk[]) : [];
    chunksRef.current = arr;
    setChunks(arr);
  }

  async function refreshWorkspace(handle = dirHandle) {
    if (!handle) return;
    const r = await scanDocsDir(handle);
    setWorkspaceDocs(r.docs);
    setWorkspaceErrors(r.errors);
  }

  async function onConnectWorkspace() {
    const mode = allowFileWrites ? "readwrite" : "read";
    const handle = await pickDirectoryHandle(mode);
    if (!handle) {
      alert("This browser does not support connecting to a folder. Use Chrome or Edge.");
      return;
    }
    setDirHandle(handle);
    setWorkspaceMode(mode);
    await refreshWorkspace(handle);
  }

  const allTemplates = useMemo(() => {
    if (!includeTemplates) return [];
    const custom = typeof window === "undefined" ? [] : readCustomTemplates();
    const map = new Map<string, DocTemplate>();
    for (const t of [...templates, ...custom]) map.set(t.id, t);
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [includeTemplates, templates]);

  const tools: ToolDescriptor[] = useMemo(() => {
    return [
      {
        name: "search_docs",
        description: "Search docs by keywords (uses the same search index as the Documents page).",
        args: '{ query: string, limit?: number, stage?: "draft"|"final"|"official"|"all", topic?: string, collection?: string }',
        returns: "{ results: Array<{ slug: string, title: string, stage: string, summary: string, updatedAt: string, url: string }> }",
      },
      {
        name: "get_doc",
        description: "Fetch a doc's markdown via /raw (published/exported docs only).",
        args: "{ slug: string, version?: string, maxChars?: number }",
        returns: "{ slug: string, version: string, frontmatter: object, markdown: string, truncated: boolean }",
      },
      {
        name: "get_relevant_chunks",
        description: "Get relevant context excerpts from /chunks.json for a query (for grounding).",
        args: "{ query: string, limit?: number, maxCharsPerChunk?: number }",
        returns: "{ chunks: Array<{ title: string, heading: string|null, url: string, text: string }> }",
      },
      {
        name: "list_templates",
        description: "List available doc templates (built-in + your custom templates in this browser).",
        args: "{}",
        returns: "{ templates: Array<{ id: string, name: string, description: string, tags: string[] }> }",
      },
      {
        name: "render_template",
        description: "Render a markdown scaffold + prompt for a given template.",
        args: "{ templateId: string, topic: string, values?: Record<string,string>, enabledOptional?: string[] }",
        returns: "{ markdown: string, prompt: string }",
      },
      {
        name: "list_blocks",
        description: "List disclaimers + glossary entries (built-in + your custom ones in this browser).",
        args: "{}",
        returns:
          "{ disclaimers: Array<{ title: string, body: string, tags: string[] }>, glossary: Array<{ term: string, definition: string, tags: string[] }> }",
      },
      {
        name: "save_custom_disclaimer",
        description: "Save a custom disclaimer in this browser (shows up under Reusable text).",
        args: "{ title: string, body: string, tags?: string[] }",
        returns: "{ ok: boolean, count: number }",
      },
      {
        name: "save_custom_glossary_entry",
        description: "Save a custom glossary entry in this browser (shows up under Reusable text).",
        args: "{ term: string, definition: string, tags?: string[] }",
        returns: "{ ok: boolean, count: number }",
      },
      {
        name: "workspace_status",
        description: "Return whether a local docs folder is connected and what permissions are available.",
        args: "{}",
        returns:
          '{ connected: boolean, mode: "read"|"readwrite", allowFileWrites: boolean, allowDeletes: boolean, previewBeforeWrite: boolean, writeReady: boolean, docsCount: number, plannedEditsCount: number }',
      },
      {
        name: "workspace_list_docs",
        description: "List docs found in the connected folder (including unpublished drafts).",
        args: "{ limit?: number }",
        returns:
          "{ docs: Array<{ slug: string, version: string, title: string, stage: string, archived: boolean, visibility: string }> }",
      },
      {
        name: "workspace_read_doc",
        description: "Read a doc from the connected folder by slug+version.",
        args: "{ slug: string, version: string, maxChars?: number }",
        returns:
          "{ slug: string, version: string, fileName: string, frontmatter: object, markdown: string, truncated: boolean }",
      },
      {
        name: "workspace_create_doc",
        description: "Create a new doc file in the connected folder.",
        args:
          '{ slug: string, title: string, summary: string, version?: string, updatedAt?: string, stage?: "draft"|"final"|"official", publish?: boolean, visibility?: "public"|"internal"|"private", owners?: string[], topics?: string[], collection?: string, order?: number, markdown: string, citations?: Array<{ label: string, url?: string }>, approvals?: Array<{ name: string, date: string }> }',
        returns: "{ ok: boolean, fileName: string }",
      },
      {
        name: "workspace_update_doc",
        description:
          "Update an existing doc file in the connected folder. If Preview changes first is enabled, this may return a planned change instead of writing the file.",
        args: "{ slug: string, version: string, patchFrontmatter?: object, markdown?: string, auditAction?: string, auditNote?: string, apply?: boolean }",
        returns:
          "{ ok: boolean, fileName: string, planned?: boolean, planId?: string, summary?: string, diff?: string, truncated?: boolean }",
      },
      {
        name: "workspace_publish",
        description: "Publish a doc in the connected folder (sets archived=false).",
        args: "{ slug: string, version: string, confirm: boolean }",
        returns: "{ ok: boolean, planned?: boolean, planId?: string, summary?: string, diff?: string, truncated?: boolean }",
      },
      {
        name: "workspace_unpublish",
        description: "Unpublish a doc in the connected folder (sets archived=true).",
        args: "{ slug: string, version: string, confirm: boolean }",
        returns: "{ ok: boolean, planned?: boolean, planId?: string, summary?: string, diff?: string, truncated?: boolean }",
      },
      {
        name: "workspace_set_stage",
        description: "Set a doc stage in the connected folder (draft/final/official).",
        args: '{ slug: string, version: string, stage: "draft"|"final"|"official" }',
        returns: "{ ok: boolean, planned?: boolean, planId?: string, summary?: string, diff?: string, truncated?: boolean }",
      },
      {
        name: "workspace_finalize",
        description: "Mark a doc as Final (stage=final). Does not publish/unpublish.",
        args: "{ slug: string, version: string }",
        returns: "{ ok: boolean, planned?: boolean, planId?: string, summary?: string, diff?: string, truncated?: boolean }",
      },
      {
        name: "workspace_official",
        description: "Mark a doc as Official (stage=official). Optionally set lastReviewedAt and approvals.",
        args: "{ slug: string, version: string, reviewedAt?: string, approvals?: Array<{ name: string, date: string }> }",
        returns: "{ ok: boolean, planned?: boolean, planId?: string, summary?: string, diff?: string, truncated?: boolean }",
      },
      {
        name: "workspace_clone_version",
        description: "Clone a doc into a new version (creates a new file, default unpublished draft).",
        args: "{ slug: string, fromVersion: string, newVersion: string }",
        returns: "{ ok: boolean, fileName: string }",
      },
      {
        name: "workspace_delete_doc",
        description: "Delete a doc version file from the connected folder.",
        args: "{ slug: string, version: string, confirm: boolean }",
        returns: "{ ok: boolean, backupFileName?: string }",
      },
      {
        name: "workspace_apply_plan",
        description: "Apply a previously planned workspace change (writes the file).",
        args: "{ planId: string, confirm: boolean }",
        returns: "{ ok: boolean, fileName: string }",
      },
      {
        name: "workspace_discard_plan",
        description: "Discard a planned workspace change.",
        args: "{ planId: string }",
        returns: "{ ok: boolean }",
      },
      {
        name: "workspace_list_backups",
        description: "List backup files created by Amber AI (for undo/restore).",
        args: "{ slug?: string, version?: string, limit?: number }",
        returns: "{ backups: Array<{ backupFileName: string, createdAt: string, slug: string, version: string, title: string }> }",
      },
      {
        name: "workspace_restore_backup",
        description: "Restore a backup file (overwrites/recreates the doc version).",
        args: "{ backupFileName: string, confirm: boolean }",
        returns: "{ ok: boolean, fileName: string }",
      },
      {
        name: "workspace_undo_last_change",
        description: "Undo the most recent Amber AI change for a given doc version by restoring the latest backup.",
        args: "{ slug: string, version: string, confirm: boolean }",
        returns: "{ ok: boolean, backupFileName: string, fileName: string }",
      },
      {
        name: "send_to_studio",
        description: "Send a draft doc to Write + publish (Studio) via local storage.",
        args: "{ docText: string }",
        returns: "{ ok: boolean }",
      },
    ];
  }, []);

  const system = useMemo(() => {
    const blocksAvailable = includeBlocks ? "available (use list_blocks tool)" : "disabled";
    const templatesAvailable = includeTemplates ? "available (use list_templates/render_template tools)" : "disabled";
    return `You are Amber AI: the internal assistant for the Amber Docs workspace.

Your job: help a non-technical user find, understand, draft, and maintain documentation.

You have tools to:
- search and fetch docs
- fetch relevant chunks for grounding
- use templates and reusable text blocks
- (optionally) read and edit local doc files if a folder is connected and writes are allowed

Guidelines:
- Use simple, scannable writing (short paragraphs, bullets, numbered steps).
- When you are missing a source, write "(SOURCE NEEDED: ...)".
- Prefer tool calls for facts and for reading existing docs.
- Doc lifecycle:
  - publish/unpublish is separate from stage (archived=false/true)
  - Final means stage=final
  - Official means stage=official and should include lastReviewedAt (and approvals if provided)
- Safety:
  - Do NOT publish/unpublish unless the user explicitly said "publish" or "unpublish" (those tools require confirm=true).
  - Do NOT delete files unless the user explicitly asked and workspace_status says allowDeletes=true (delete requires confirm=true).
  - If "Preview changes first" is enabled, workspace_update_doc may return a planned change. In that case, ask the user to confirm before applying it with workspace_apply_plan.
  - Before writing a file, the app will create a backup automatically (you can list/restore backups).
- Blocks are ${blocksAvailable}. Templates are ${templatesAvailable}.
- If a request requires editing files but workspace is not connected or writes are disabled, explain what to click next.

Output JSON only.`;
  }, [includeBlocks, includeTemplates]);

  function buildFuse(idx: IndexDoc[]) {
    return new Fuse(idx, {
      includeScore: true,
      threshold: 0.35,
      ignoreLocation: true,
      keys: [
        { name: "title", weight: 2.0 },
        { name: "headings", weight: 1.6 },
        { name: "summary", weight: 1.4 },
        { name: "topics", weight: 1.0 },
        { name: "searchText", weight: 0.7 },
      ],
    });
  }

  async function onAddAttachments(fileList: FileList | null) {
    const files = Array.from(fileList ?? []);
    if (!files.length) return;
    setAttachmentsError(null);
    setAttachmentsBusy(true);
    try {
      const maxFiles = 3;
      const maxCharsPerFile = 80_000;
      const maxCharsTotal = 160_000;
      let remaining = maxCharsTotal;

      const out: Attachment[] = [];
      for (const f of files.slice(0, maxFiles)) {
        const raw = await f.text();
        const slice = raw.slice(0, Math.min(maxCharsPerFile, remaining));
        out.push({ name: f.name, text: slice, truncated: raw.length > slice.length });
        remaining -= slice.length;
        if (remaining <= 0) break;
      }

      setAttachments((prev) => [...prev, ...out].slice(0, maxFiles));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setAttachmentsError(msg);
    } finally {
      setAttachmentsBusy(false);
    }
  }

  async function onSend() {
    const k = apiKey.trim();
    const m = model.trim();
    const text = input.trim();
    if (!k) return alert("Add your Gemini API key first.");
    if (!m) return alert("Choose a model first.");
    if (!text) return;

    setBusy(true);
    setError(null);
    setLastDraft(null);
    setDraftFixError(null);

    try {
      writeGeminiSettings({ apiKey: k, model: m });

      const userItem: AgentTranscriptItem = { role: "user", content: `${text}${formatAttachmentsForPrompt(attachments)}` };
      const base: AgentTranscriptItem[] = [...messages, userItem];
      setMessages(base);
      setAttachments([]);

      const controller = new AbortController();
      abortRef.current = controller;

      await ensureIndexesLoaded();
      if (includeContext) await ensureChunksLoaded();

      const ensureWorkspaceWriteReady = (): FsDirectoryHandle => {
        if (!dirHandle) throw new Error('No workspace folder connected. Click "Choose docs folder" first.');
        if (!allowFileWrites) throw new Error('File edits are disabled. Turn on "Allow file edits" first.');
        if (workspaceMode !== "readwrite") {
          throw new Error('Folder is connected in read-only mode. Turn on "Allow file edits", then click "Reconnect folder".');
        }
        return dirHandle;
      };

      const ensureWorkspaceConnected = (): FsDirectoryHandle => {
        if (!dirHandle) throw new Error('No workspace folder connected. Click "Choose docs folder" first.');
        return dirHandle;
      };

      const toolFns: Record<string, (args: unknown) => Promise<unknown>> = {
        search_docs: async (args) => {
          const a = asRecord(args);
          const query = typeof a.query === "string" ? a.query : "";
          const limit =
            typeof a.limit === "number" && Number.isFinite(a.limit) ? Math.max(1, Math.min(25, a.limit)) : 8;
          const stage = typeof a.stage === "string" ? a.stage : "all";
          const topic = typeof a.topic === "string" ? a.topic : "all";
          const collection = typeof a.collection === "string" ? a.collection : "all";

          const idx = indexRef.current ?? index ?? [];
          const syn = synonymsRef.current;
          const expanded = (() => {
            const ts = tokens(query);
            const extra: string[] = [];
            for (const t of ts) extra.push(...(syn[t] ?? []));
            return Array.from(new Set([...ts, ...extra])).join(" ");
          })();

          const fuse = buildFuse(idx);
          const hits = expanded.trim()
            ? fuse.search(expanded).map((h) => ({ ...h.item, _score: h.score ?? 1 }))
            : idx.map((d) => ({ ...d, _score: 1 }));

          const filtered = hits
            .filter((d) => (stage === "all" ? true : d.stage === stage))
            .filter((d) => (topic === "all" ? true : (d.topics ?? []).includes(topic)))
            .filter((d) => (collection === "all" ? true : (d.collection ?? "") === collection))
            .slice(0, limit)
            .map((d) => ({
              slug: d.slug,
              title: d.title,
              stage: d.stage,
              summary: d.summary,
              updatedAt: d.updatedAt,
              url: d.url,
            }));

          return { results: filtered };
        },

        get_doc: async (args) => {
          const a = asRecord(args);
          const slug = typeof a.slug === "string" ? a.slug : "";
          const version = typeof a.version === "string" ? a.version : null;
          const maxChars =
            typeof a.maxChars === "number" && Number.isFinite(a.maxChars)
              ? Math.max(500, Math.min(50_000, a.maxChars))
              : 12_000;
          if (!slug.trim()) throw new Error("get_doc requires slug");

          const url = version ? `/raw/v/${encodeURIComponent(slug)}/${encodeURIComponent(version)}` : `/raw/${encodeURIComponent(slug)}`;
          const res = await fetch(url, { cache: "force-cache" });
          if (!res.ok) throw new Error(`Failed to fetch ${url} (${res.status})`);
          const raw = await res.text();
          const parsed = matter(raw);
          const fm = (parsed.data ?? {}) as Record<string, unknown>;
          const markdownFull = (parsed.content ?? "").trimEnd() + "\n";
          const truncated = markdownFull.length > maxChars;
          const markdown = truncated ? markdownFull.slice(0, maxChars) + "\n\n<!-- truncated -->\n" : markdownFull;
          const v = typeof fm.version === "string" ? fm.version : typeof fm.updatedAt === "string" ? fm.updatedAt : "";
          return { slug, version: (version ?? v) || "", frontmatter: fm, markdown, truncated };
        },

        get_relevant_chunks: async (args) => {
          const a = asRecord(args);
          const query = typeof a.query === "string" ? a.query : "";
          const limit =
            typeof a.limit === "number" && Number.isFinite(a.limit) ? Math.max(1, Math.min(12, a.limit)) : 6;
          const maxCharsPerChunk =
            typeof a.maxCharsPerChunk === "number" && Number.isFinite(a.maxCharsPerChunk)
              ? Math.max(200, Math.min(2500, a.maxCharsPerChunk))
              : 900;
          if (!includeContext) return { chunks: [] };
          const arr = chunksRef.current ?? chunks ?? [];
          const ts = tokens(query);
          if (!ts.length) return { chunks: [] };

          const scored = arr
            .map((c) => ({ c, s: scoreText(`${c.title} ${c.heading ?? ""} ${c.text}`, ts) }))
            .filter((x) => x.s > 0)
            .sort((a, b) => b.s - a.s)
            .slice(0, limit)
            .map((x) => x.c);

          return {
            chunks: scored.map((c) => ({
              title: c.title,
              heading: c.heading,
              url: c.url,
              text: c.text.length > maxCharsPerChunk ? c.text.slice(0, maxCharsPerChunk) + "…" : c.text,
            })),
          };
        },

        list_templates: async () => {
          const out = allTemplates.map((t) => ({ id: t.id, name: t.name, description: t.description, tags: t.tags ?? [] }));
          return { templates: out };
        },

        render_template: async (args) => {
          const a = asRecord(args);
          const templateId = typeof a.templateId === "string" ? a.templateId : "";
          const topic = typeof a.topic === "string" ? a.topic : "";
          const values = safeStringRecord(a.values);
          const enabledOptionalRaw = a.enabledOptional;
          const enabledOptional = Array.isArray(enabledOptionalRaw)
            ? enabledOptionalRaw.map((x: unknown) => String(x ?? "")).filter(Boolean)
            : [];
          const template = allTemplates.find((t) => t.id === templateId);
          if (!template) throw new Error(`Unknown templateId: ${templateId}`);
          if (!topic.trim()) throw new Error("render_template requires topic");

          const enabledSet = new Set(enabledOptional);
          const markdown = buildMarkdownSkeleton({ template, inputValues: values, topic, enabledOptional: enabledSet });
          const prompt = buildPrompt({ template, inputValues: values, topic, enabledOptional: enabledSet });
          return { markdown, prompt };
        },

        list_blocks: async () => {
          if (!includeBlocks) return { disclaimers: [], glossary: [] };
          const customSnippets = typeof window === "undefined" ? [] : readCustomSnippets();
          const customGlossary = typeof window === "undefined" ? [] : readCustomGlossary();
          const allSnippets = [...disclaimers, ...customSnippets].slice(0, 50).map((s) => ({
            title: s.title,
            body: s.body,
            tags: s.tags ?? [],
          }));
          const allGlossary = [...glossary, ...customGlossary].slice(0, 80).map((g) => ({
            term: g.term,
            definition: g.definition,
            tags: g.tags ?? [],
          }));
          return { disclaimers: allSnippets, glossary: allGlossary };
        },

        save_custom_disclaimer: async (args) => {
          const a = asRecord(args);
          const title = typeof a.title === "string" ? a.title.trim() : "";
          const body = typeof a.body === "string" ? a.body.trim() : "";
          const tags = Array.isArray(a.tags)
            ? a.tags.map((t: unknown) => String(t ?? "")).filter(Boolean)
            : [];
          if (!title || !body) throw new Error("save_custom_disclaimer requires title and body");
          const prev = readCustomSnippets();
          const id = `custom-${slugifyTitle(title)}`;
          const next: Snippet[] = [...prev, { id, title, body, tags }];
          writeCustomSnippets(next);
          return { ok: true, count: next.length };
        },

        save_custom_glossary_entry: async (args) => {
          const a = asRecord(args);
          const term = typeof a.term === "string" ? a.term.trim() : "";
          const definition = typeof a.definition === "string" ? a.definition.trim() : "";
          const tags = Array.isArray(a.tags)
            ? a.tags.map((t: unknown) => String(t ?? "")).filter(Boolean)
            : [];
          if (!term || !definition) throw new Error("save_custom_glossary_entry requires term and definition");
          const prev = readCustomGlossary();
          const next: GlossaryEntry[] = [...prev, { term, definition, synonyms: [], tags }];
          writeCustomGlossary(next);
          return { ok: true, count: next.length };
        },

        workspace_status: async () => {
          const connected = !!dirHandle;
          const mode = workspaceMode;
          const writeReady = computeWriteReady({ connected, mode, allowFileWrites });
          return {
            connected,
            mode,
            allowFileWrites,
            allowDeletes,
            previewBeforeWrite,
            writeReady,
            docsCount: workspaceDocsRef.current.length,
            plannedEditsCount: plannedEditsRef.current.size,
          };
        },

        workspace_list_docs: async (args) => {
          const a = asRecord(args);
          const limit =
            typeof a.limit === "number" && Number.isFinite(a.limit) ? Math.max(1, Math.min(200, a.limit)) : 50;
          const docs = workspaceDocsRef.current.slice(0, limit).map((d) => ({
            slug: d.slug,
            version: d.version,
            title: d.title,
            stage: d.stage,
            archived: d.archived,
            visibility: d.visibility,
          }));
          return { docs };
        },

        workspace_read_doc: async (args) => {
          const a = asRecord(args);
          const slug = typeof a.slug === "string" ? a.slug : "";
          const version = typeof a.version === "string" ? a.version : "";
          const maxChars =
            typeof a.maxChars === "number" && Number.isFinite(a.maxChars)
              ? Math.max(500, Math.min(80_000, a.maxChars))
              : 20_000;
          const doc = workspaceDocsRef.current.find((d) => d.slug === slug && d.version === version);
          if (!doc) throw new Error(`Doc not found in workspace: ${slug}@${version}`);
          const truncated = doc.markdown.length > maxChars;
          const markdown = truncated ? doc.markdown.slice(0, maxChars) + "\n\n<!-- truncated -->\n" : doc.markdown;
          return { slug, version, fileName: doc.fileName, frontmatter: doc.frontmatter, markdown, truncated };
        },

        workspace_create_doc: async (args) => {
          const root = ensureWorkspaceWriteReady();

          const a = asRecord(args);
          const slug = typeof a.slug === "string" ? a.slug.trim() : "";
          const title = typeof a.title === "string" ? a.title.trim() : "";
          const summary = typeof a.summary === "string" ? a.summary.trim() : "";
          const stage: DocStage = isStage(a.stage) ? a.stage : "draft";
          const publish = a.publish === true;
          const visibility: DocVisibility = isVisibility(a.visibility) ? a.visibility : "internal";

          const owners = safeStringArray(a.owners);
          const topics = safeStringArray(a.topics);
          const collection = typeof a.collection === "string" ? a.collection.trim() : "";
          const order =
            typeof a.order === "number" && Number.isFinite(a.order) ? Math.trunc(a.order) : undefined;
          const citations = safeCitations(a.citations);
          const approvals = safeApprovals(a.approvals);

          const markdown = typeof a.markdown === "string" ? a.markdown.trimEnd() + "\n" : "";
          if (!slug || !title || !summary || !markdown) {
            throw new Error("workspace_create_doc requires slug, title, summary, markdown");
          }

          const { version, updatedAt } = resolveVersionAndUpdatedAt({
            version: typeof a.version === "string" ? a.version.trim() : null,
            updatedAt: typeof a.updatedAt === "string" ? a.updatedAt.trim() : null,
          });

          const fileName = suggestedDocFileName(slug, version);
          const handle = await root.getFileHandle(fileName, { create: true });

          const actor = (() => {
            try {
              return localStorage.getItem(STUDIO_ACTOR_KEY) ?? "";
            } catch {
              return "";
            }
          })();

          const fm: Record<string, unknown> = {
            slug,
            version,
            title,
            stage,
            archived: !publish,
            visibility,
            summary,
            updatedAt,
            lastReviewedAt: stage === "official" ? updatedAt : undefined,
            owners,
            topics,
            collection: collection || undefined,
            order,
            citations,
            approvals,
            audit: [
              {
                at: new Date().toISOString(),
                action: "ai:create",
                actor: actor.trim() || undefined,
              },
            ],
          };

          const body = matter.stringify(markdown, stripUndefined(fm) as Record<string, unknown>);
          await writeHandleText(handle, body);
          await refreshWorkspace(root);
          return { ok: true, fileName };
        },

        workspace_update_doc: async (args) => {
          const root = ensureWorkspaceWriteReady();

          const a = asRecord(args);
          const slug = typeof a.slug === "string" ? a.slug : "";
          const version = typeof a.version === "string" ? a.version : "";
          if (!slug || !version) throw new Error("workspace_update_doc requires slug and version");
          const doc = workspaceDocsRef.current.find((d) => d.slug === slug && d.version === version);
          if (!doc) throw new Error(`Doc not found in workspace: ${slug}@${version}`);

          const apply = a.apply === true;
          const patchFrontmatter =
            a.patchFrontmatter && typeof a.patchFrontmatter === "object" && !Array.isArray(a.patchFrontmatter)
              ? (a.patchFrontmatter as Record<string, unknown>)
              : {};
          const patchMarkdown = typeof a.markdown === "string" ? a.markdown.trimEnd() + "\n" : null;
          const auditActionRaw = typeof a.auditAction === "string" ? a.auditAction.trim() : "";
          const auditAction = auditActionRaw || "ai:update";
          const auditNoteRaw = typeof a.auditNote === "string" ? a.auditNote.trim() : "";
          const auditNote = auditNoteRaw || undefined;

          const actor = (() => {
            try {
              return localStorage.getItem(STUDIO_ACTOR_KEY) ?? "";
            } catch {
              return "";
            }
          })();

          const nextFm: Record<string, unknown> = {
            ...doc.frontmatter,
            ...patchFrontmatter,
          };

          const prevAudit = Array.isArray(nextFm.audit) ? (nextFm.audit as unknown[]) : [];
          nextFm.audit = [
            ...prevAudit,
            {
              at: new Date().toISOString(),
              action: auditAction,
              actor: actor.trim() || undefined,
              note: auditNote,
            },
          ].slice(-200);

          const nextStage: DocStage = isStage(nextFm.stage) ? (nextFm.stage as DocStage) : doc.stage;
          if (nextStage === "official") {
            const lr = typeof nextFm.lastReviewedAt === "string" ? String(nextFm.lastReviewedAt).trim() : "";
            if (!lr) nextFm.lastReviewedAt = typeof nextFm.updatedAt === "string" ? nextFm.updatedAt : isoDate(new Date());
          } else {
            nextFm.lastReviewedAt = undefined;
          }

          const md = patchMarkdown ?? doc.markdown;
          const body = matter.stringify(md, stripUndefined(nextFm) as Record<string, unknown>);
          const beforeText = await readHandleText(doc.handle);

          if (previewBeforeWrite && !apply) {
            const preview = diffTextPreview({ from: beforeText, to: body, maxLines: 240, maxChars: 12_000 });
            const planId = (() => {
              const cryptoObj = (globalThis as unknown as { crypto?: { randomUUID?: () => string } }).crypto;
              if (cryptoObj?.randomUUID) return cryptoObj.randomUUID();
              return `plan-${Math.random().toString(36).slice(2, 10)}`;
            })();
            const plan: PlannedEdit = {
              planId,
              slug,
              version,
              fileName: doc.fileName,
              createdAt: new Date().toISOString(),
              summary: preview.summary,
              diff: preview.diff,
              truncated: preview.truncated,
              beforeText,
              afterText: body,
            };
            plannedEditsRef.current.set(planId, plan);
            setPlannedEdit(plan);
            return {
              ok: true,
              fileName: doc.fileName,
              planned: true,
              planId,
              summary: preview.summary,
              diff: preview.diff,
              truncated: preview.truncated,
            };
          }

          await createWorkspaceBackup({ root, docFileName: doc.fileName, text: beforeText });
          await writeHandleText(doc.handle, body);
          await refreshWorkspace(root);
          return { ok: true, fileName: doc.fileName };
        },

        workspace_publish: async (args) => {
          const a = asRecord(args);
          const slug = typeof a.slug === "string" ? a.slug : "";
          const version = typeof a.version === "string" ? a.version : "";
          const confirm = a.confirm === true;
          if (!confirm) throw new Error("workspace_publish requires confirm=true");
          if (!slug || !version) throw new Error("workspace_publish requires slug and version");
          // Safety: require an explicit publish intent in the user's message.
          if (!/\bpublish\b/i.test(text) || /\bunpublish\b/i.test(text)) {
            throw new Error('Refusing to publish unless you explicitly say "publish" in your message.');
          }
          return await toolFns.workspace_update_doc({
            slug,
            version,
            patchFrontmatter: { archived: false },
            auditAction: "ai:publish",
          });
        },

        workspace_unpublish: async (args) => {
          const a = asRecord(args);
          const slug = typeof a.slug === "string" ? a.slug : "";
          const version = typeof a.version === "string" ? a.version : "";
          const confirm = a.confirm === true;
          if (!confirm) throw new Error("workspace_unpublish requires confirm=true");
          if (!slug || !version) throw new Error("workspace_unpublish requires slug and version");
          // Safety: require an explicit unpublish intent in the user's message.
          if (!/\bunpublish\b/i.test(text)) {
            throw new Error('Refusing to unpublish unless you explicitly say "unpublish" in your message.');
          }
          return await toolFns.workspace_update_doc({
            slug,
            version,
            patchFrontmatter: { archived: true },
            auditAction: "ai:unpublish",
          });
        },

        workspace_set_stage: async (args) => {
          const a = asRecord(args);
          const slug = typeof a.slug === "string" ? a.slug : "";
          const version = typeof a.version === "string" ? a.version : "";
          const stage: DocStage | null = isStage(a.stage) ? a.stage : null;
          if (!stage) throw new Error("workspace_set_stage requires stage draft|final|official");
          return await toolFns.workspace_update_doc({
            slug,
            version,
            patchFrontmatter: stagePatch(stage, { now: new Date() }),
            auditAction: "ai:set_stage",
            auditNote: `to ${stage}`,
          });
        },

        workspace_finalize: async (args) => {
          const a = asRecord(args);
          const slug = typeof a.slug === "string" ? a.slug : "";
          const version = typeof a.version === "string" ? a.version : "";
          if (!slug || !version) throw new Error("workspace_finalize requires slug and version");
          return await toolFns.workspace_update_doc({
            slug,
            version,
            patchFrontmatter: stagePatch("final", { now: new Date() }),
            auditAction: "ai:finalize",
          });
        },

        workspace_official: async (args) => {
          const a = asRecord(args);
          const slug = typeof a.slug === "string" ? a.slug : "";
          const version = typeof a.version === "string" ? a.version : "";
          const reviewedAt = typeof a.reviewedAt === "string" ? a.reviewedAt.trim() : "";
          const approvals = safeApprovals(a.approvals);
          const includeApprovals = a.approvals !== undefined;
          if (!slug || !version) throw new Error("workspace_official requires slug and version");
          return await toolFns.workspace_update_doc({
            slug,
            version,
            patchFrontmatter: officialPatch({
              reviewedAt: reviewedAt || null,
              approvals,
              includeApprovals,
              now: new Date(),
            }),
            auditAction: "ai:official",
            auditNote: reviewedAt ? `reviewedAt ${reviewedAt}` : undefined,
          });
        },

        workspace_clone_version: async (args) => {
          const root = ensureWorkspaceWriteReady();

          const a = asRecord(args);
          const slug = typeof a.slug === "string" ? a.slug : "";
          const fromVersion = typeof a.fromVersion === "string" ? a.fromVersion : "";
          const newVersion = typeof a.newVersion === "string" ? a.newVersion : "";
          if (!slug || !fromVersion || !newVersion) throw new Error("workspace_clone_version requires slug, fromVersion, newVersion");

          const baseDoc = workspaceDocsRef.current.find((d) => d.slug === slug && d.version === fromVersion);
          if (!baseDoc) throw new Error(`Base doc not found in workspace: ${slug}@${fromVersion}`);

          const { version, updatedAt } = resolveVersionAndUpdatedAt({ version: newVersion.trim(), updatedAt: null });
          const fileName = suggestedDocFileName(slug, version);
          const handle = await root.getFileHandle(fileName, { create: true });

          const fm: Record<string, unknown> = {
            ...baseDoc.frontmatter,
            slug,
            version,
            updatedAt,
            stage: "draft",
            archived: true,
            approvals: [],
            lastReviewedAt: undefined,
            audit: [
              {
                at: new Date().toISOString(),
                action: "ai:clone",
                note: `from ${fromVersion}`,
              },
            ],
          };

          const body = matter.stringify(baseDoc.markdown, stripUndefined(fm) as Record<string, unknown>);
          await writeHandleText(handle, body);
          await refreshWorkspace(root);
          return { ok: true, fileName };
        },

        workspace_delete_doc: async (args) => {
          const root = ensureWorkspaceWriteReady();

          const a = asRecord(args);
          const slug = typeof a.slug === "string" ? a.slug : "";
          const version = typeof a.version === "string" ? a.version : "";
          const confirm = a.confirm === true;
          const policy = deletePolicy({ writeReady: true, allowDeletes, confirm });
          if (!policy.ok) throw new Error(policy.reason);
          if (!slug || !version) throw new Error("workspace_delete_doc requires slug and version");
          const doc = workspaceDocsRef.current.find((d) => d.slug === slug && d.version === version);
          if (!doc) throw new Error(`Doc not found in workspace: ${slug}@${version}`);

          const beforeText = await readHandleText(doc.handle);
          const backup = await createWorkspaceBackup({ root, docFileName: doc.fileName, text: beforeText });
          await root.removeEntry(doc.fileName);
          await refreshWorkspace(root);
          return { ok: true, backupFileName: backup.backupFileName };
        },

        workspace_apply_plan: async (args) => {
          const root = ensureWorkspaceWriteReady();
          const a = asRecord(args);
          const planId = typeof a.planId === "string" ? a.planId : "";
          const confirm = a.confirm === true;
          if (!planId.trim()) throw new Error("workspace_apply_plan requires planId");
          if (!confirm) throw new Error("workspace_apply_plan requires confirm=true");

          const plan = plannedEditsRef.current.get(planId) ?? null;
          if (!plan) throw new Error(`No planned change found for planId: ${planId}`);

          const fileHandle = await root.getFileHandle(plan.fileName, { create: true });
          const current = await readHandleText(fileHandle);
          if (current !== plan.beforeText) {
            throw new Error("The file changed since the plan was created. Ask me to plan the update again.");
          }

          await createWorkspaceBackup({ root, docFileName: plan.fileName, text: current });
          await writeHandleText(fileHandle, plan.afterText);
          plannedEditsRef.current.delete(planId);
          setPlannedEdit((prev) => (prev?.planId === planId ? null : prev));
          await refreshWorkspace(root);
          return { ok: true, fileName: plan.fileName };
        },

        workspace_discard_plan: async (args) => {
          const a = asRecord(args);
          const planId = typeof a.planId === "string" ? a.planId : "";
          if (!planId.trim()) throw new Error("workspace_discard_plan requires planId");
          plannedEditsRef.current.delete(planId);
          setPlannedEdit((prev) => (prev?.planId === planId ? null : prev));
          return { ok: true };
        },

        workspace_list_backups: async (args) => {
          const root = ensureWorkspaceConnected();
          const a = asRecord(args);
          const slug = typeof a.slug === "string" ? a.slug.trim() : "";
          const version = typeof a.version === "string" ? a.version.trim() : "";
          const limit =
            typeof a.limit === "number" && Number.isFinite(a.limit) ? Math.max(1, Math.min(200, a.limit)) : 30;
          return await listWorkspaceBackups({
            root,
            slug: slug || null,
            version: version || null,
            limit,
          });
        },

        workspace_restore_backup: async (args) => {
          const root = ensureWorkspaceWriteReady();
          const a = asRecord(args);
          const backupFileName = typeof a.backupFileName === "string" ? a.backupFileName.trim() : "";
          const confirm = a.confirm === true;
          if (!backupFileName) throw new Error("workspace_restore_backup requires backupFileName");
          if (!confirm) throw new Error("workspace_restore_backup requires confirm=true");

          // If we're overwriting an existing file, back it up first.
          const metaList = await listWorkspaceBackups({ root, limit: 200 });
          const meta = metaList.backups.find((b) => b.backupFileName === backupFileName) ?? null;
          if (meta) {
            const targetFileName = suggestedDocFileName(meta.slug, meta.version);
            try {
              const existing = await root.getFileHandle(targetFileName);
              const current = await readHandleText(existing);
              if (current.trim()) await createWorkspaceBackup({ root, docFileName: targetFileName, text: current });
            } catch {
              // If it doesn't exist, nothing to back up.
            }
          }

          const restored = await restoreWorkspaceBackup({ root, backupFileName, confirm: true });
          await refreshWorkspace(root);
          return { ok: restored.ok, fileName: restored.fileName };
        },

        workspace_undo_last_change: async (args) => {
          const root = ensureWorkspaceWriteReady();
          const a = asRecord(args);
          const slug = typeof a.slug === "string" ? a.slug.trim() : "";
          const version = typeof a.version === "string" ? a.version.trim() : "";
          const confirm = a.confirm === true;
          if (!slug || !version) throw new Error("workspace_undo_last_change requires slug and version");
          if (!confirm) throw new Error("workspace_undo_last_change requires confirm=true");

          const listed = await listWorkspaceBackups({ root, slug, version, limit: 5 });
          const latest = listed.backups[0] ?? null;
          if (!latest) throw new Error(`No backups found for ${slug}@${version}`);

          const restored = await restoreWorkspaceBackup({ root, backupFileName: latest.backupFileName, confirm: true });
          await refreshWorkspace(root);
          return { ok: true, backupFileName: latest.backupFileName, fileName: restored.fileName };
        },

        send_to_studio: async (args) => {
          const a = asRecord(args);
          const docText = typeof a.docText === "string" ? a.docText : "";
          if (!docText.trim()) throw new Error("send_to_studio requires docText");
          const ok = saveStudioImport({ v: 1, source: "assistant", createdAt: new Date().toISOString(), docText });
          return { ok };
        },
      };

      const withContext: AgentTranscriptItem[] = [...base];
      try {
        const ws = await toolFns.workspace_status({});
        withContext.push({
          role: "tool",
          content: JSON.stringify({ tool: "workspace_status", ok: true, result: ws }, null, 2),
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        withContext.push({
          role: "tool",
          content: JSON.stringify({ tool: "workspace_status", ok: false, error: msg }, null, 2),
        });
      }

      if (presetDoc) {
        try {
          const r = await toolFns.get_doc({ slug: presetDoc.slug, version: presetDoc.version ?? undefined, maxChars: 18_000 });
          withContext.push({
            role: "tool",
            content: JSON.stringify({ tool: "get_doc", ok: true, result: r }, null, 2),
          });
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          withContext.push({
            role: "tool",
            content: JSON.stringify({ tool: "get_doc", ok: false, error: msg }, null, 2),
          });
        }
      }

      if (includeContext) {
        const ctx = await toolFns.get_relevant_chunks({ query: text, limit: 6, maxCharsPerChunk: 800 });
        withContext.push({
          role: "tool",
          content: JSON.stringify({ tool: "get_relevant_chunks", ok: true, result: ctx }, null, 2),
        });
      }

      const llm = async (prompt: string) => {
        const out = await geminiGenerateText({
          apiKey: k,
          model: m,
          prompt,
          temperature: 0.2,
          maxOutputTokens: 4096,
          signal: controller.signal,
        });
        return out.text;
      };

      const result = await runAgentLoop({
        system,
        tools,
        transcript: withContext.slice(-20),
        llm,
        toolFns,
        maxSteps: 8,
      });

      setMessages(result.transcript);
      if (result.final.draft?.docText && result.final.draft.docText.trim()) {
        setLastDraft({ docText: result.final.draft.docText.trimEnd() + "\n" });
      }
      setInput("");
    } catch (e: unknown) {
      const isAbort =
        (e instanceof DOMException && e.name === "AbortError") ||
        (e instanceof Error && e.name === "AbortError") ||
        (e instanceof Error && /aborted/i.test(e.message));
      if (isAbort) {
        setError(null);
        setMessages((prev) => [...prev, { role: "assistant", content: "Canceled." }]);
      } else {
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  }

  async function onFixDraftWithAi() {
    const draft = lastDraft?.docText ?? "";
    if (!draft.trim()) return;
    const lint = draftLint;
    if (!lint || lint.ok) return;

    const k = apiKey.trim();
    const m = model.trim();
    if (!k) return alert("Add your Gemini API key first.");
    if (!m) return alert("Choose a model first.");

    setDraftFixBusy(true);
    setDraftFixError(null);
    try {
      writeGeminiSettings({ apiKey: k, model: m });

      const checklist = lint.issues.map((i) => `- ${i.message}`).join("\n");
      const prompt = `You are Amber AI. You are fixing a Markdown document file for the Amber Docs system.\n\nTask:\n- Fix the draft below so it passes the checklist.\n- Preserve the meaning and most of the content.\n\nChecklist:\n${checklist}\n\nOutput requirements:\n- Return ONLY the full updated document as Markdown.\n- Include YAML frontmatter at the top.\n- Do NOT wrap the output in code fences.\n\nCurrent draft:\n${draft}\n`;

      const out = await geminiGenerateText({
        apiKey: k,
        model: m,
        prompt,
        temperature: 0.2,
        maxOutputTokens: 4096,
      });

      const next = out.text.trimEnd() + "\n";
      setLastDraft({ docText: next });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setDraftFixError(msg);
    } finally {
      setDraftFixBusy(false);
    }
  }

  function ensureWorkspaceWriteReadyUi(): FsDirectoryHandle {
    if (!dirHandle) throw new Error('No workspace folder connected. Click "Choose docs folder" first.');
    if (!allowFileWrites) throw new Error('File edits are disabled. Turn on "Allow file edits" first.');
    if (workspaceMode !== "readwrite") {
      throw new Error('Folder is connected in read-only mode. Turn on "Allow file edits", then click "Reconnect folder".');
    }
    return dirHandle;
  }

  async function onApplyPlannedEdit() {
    const plan = plannedEdit;
    if (!plan) return;
    try {
      const ok = window.confirm(
        `Apply these changes to ${plan.slug} v${plan.version}?\n\nThis will edit your file. A backup will be saved automatically.`,
      );
      if (!ok) return;
      const root = ensureWorkspaceWriteReadyUi();
      const handle = await root.getFileHandle(plan.fileName, { create: true });
      const current = await readHandleText(handle);
      if (current !== plan.beforeText) {
        alert("This file changed since the preview was created. Ask the AI to plan the update again.");
        return;
      }
      await createWorkspaceBackup({ root, docFileName: plan.fileName, text: current });
      await writeHandleText(handle, plan.afterText);
      plannedEditsRef.current.delete(plan.planId);
      setPlannedEdit(null);
      await refreshWorkspace(root);
      setMessages((prev) => [...prev, { role: "assistant", content: `Applied changes to ${plan.slug} v${plan.version}.` }]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    }
  }

  function onDiscardPlannedEdit() {
    const plan = plannedEdit;
    if (!plan) return;
    plannedEditsRef.current.delete(plan.planId);
    setPlannedEdit(null);
  }

  async function onLoadBackups() {
    if (!dirHandle) return alert("Connect your docs folder first.");
    setBackupsBusy(true);
    setBackupsError(null);
    try {
      const out = await listWorkspaceBackups({ root: dirHandle, limit: 30 });
      setBackups(out.backups);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setBackupsError(msg);
      setBackups([]);
    } finally {
      setBackupsBusy(false);
    }
  }

  async function onRestoreBackupFromUi(backupFileName: string, meta: { slug: string; version: string }) {
    try {
      const ok = window.confirm(
        `Restore this backup?\n\nThis will overwrite/recreate: ${meta.slug} v${meta.version}\n\nA backup of the current file (if it exists) will be saved first.`,
      );
      if (!ok) return;
      const root = ensureWorkspaceWriteReadyUi();

      const targetFileName = suggestedDocFileName(meta.slug, meta.version);
      try {
        const existing = await root.getFileHandle(targetFileName);
        const current = await readHandleText(existing);
        if (current.trim()) await createWorkspaceBackup({ root, docFileName: targetFileName, text: current });
      } catch {
        // nothing to back up
      }

      await restoreWorkspaceBackup({ root, backupFileName, confirm: true });
      await refreshWorkspace(root);
      alert("Restored.");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      alert(msg);
    }
  }

  return (
    <main className="page max-w-6xl">
      <header className="mb-8 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-zinc-700">Ask AI</p>
            <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">Amber AI (internal assistant)</h1>
          </div>
          <nav className="flex flex-wrap gap-2">
            <Link href="/docs" className="btn btn-secondary">
              Documents
            </Link>
            <Link href="/studio" className="btn btn-secondary">
              Write + publish
            </Link>
            <Link href="/templates" className="btn btn-secondary">
              Templates
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
          Chat with Amber AI. It can search and read docs, use templates and reusable text, and (optionally) edit doc files
          in your <code>content/docs</code> folder if you connect it.
        </p>
      </header>

      <section className="card p-6">
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="block">
            <div className="text-sm font-semibold text-zinc-800">Gemini API key</div>
            <input
              className="mt-2 w-full control"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Paste your key here"
              type="password"
              autoComplete="off"
            />
            <div className="mt-2 text-sm text-zinc-600">
              Get a key from{" "}
              <a
                className="font-semibold underline decoration-black/10 underline-offset-4 hover:decoration-black/30"
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
              >
                Google AI Studio
              </a>
              . Stored only in this browser.
            </div>
          </label>

          <label className="block">
            <div className="text-sm font-semibold text-zinc-800">Model</div>
            <input
              className="mt-2 w-full control"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={`Example: ${defaultGeminiModel()}`}
              autoComplete="off"
              list="gemini-models"
            />
            <datalist id="gemini-models">
              {GEMINI_MODEL_PRESETS.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button className="btn btn-secondary" type="button" onClick={() => setModel(DEFAULT_GEMINI_FLASH_MODEL)} disabled={busy}>
                Use Gemini 3 Flash
              </button>
              <button className="btn btn-secondary" type="button" onClick={() => setModel(DEFAULT_GEMINI_PRO_MODEL)} disabled={busy}>
                Use Gemini 3 Pro
              </button>
            </div>
            <div className="mt-2 text-sm text-zinc-600">
              Suggested: <span className="font-semibold">{DEFAULT_GEMINI_FLASH_MODEL}</span> for speed,{" "}
              <span className="font-semibold">{DEFAULT_GEMINI_PRO_MODEL}</span> for depth.
            </div>
          </label>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-5">
          <label className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3">
            <span className="font-semibold text-zinc-900">Use docs context</span>
            <input
              type="checkbox"
              className="h-5 w-5"
              checked={includeContext}
              onChange={(e) => setIncludeContext(e.target.checked)}
            />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3">
            <span className="font-semibold text-zinc-900">Use blocks</span>
            <input
              type="checkbox"
              className="h-5 w-5"
              checked={includeBlocks}
              onChange={(e) => setIncludeBlocks(e.target.checked)}
            />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3">
            <span className="font-semibold text-zinc-900">Use templates</span>
            <input
              type="checkbox"
              className="h-5 w-5"
              checked={includeTemplates}
              onChange={(e) => setIncludeTemplates(e.target.checked)}
            />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3">
            <span className="font-semibold text-zinc-900">Preview changes first</span>
            <input
              type="checkbox"
              className="h-5 w-5"
              checked={previewBeforeWrite}
              onChange={(e) => setPreviewBeforeWrite(e.target.checked)}
              disabled={!allowFileWrites}
            />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <span className="font-semibold text-red-900">Allow file edits</span>
            <input
              type="checkbox"
              className="h-5 w-5"
              checked={allowFileWrites}
              onChange={(e) => {
                const next = e.target.checked;
                setAllowFileWrites(next);
                if (!next) setAllowDeletes(false);
              }}
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-4">
          <div>
            <div className="font-semibold text-zinc-900">Optional: Connect your docs folder</div>
            <div className="mt-1 text-sm text-zinc-700">
              This lets Amber AI read and edit unpublished drafts in your local <code>content/docs</code> folder.
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-secondary" type="button" onClick={onConnectWorkspace} disabled={busy}>
              {dirHandle ? "Reconnect folder" : "Choose docs folder"}
            </button>
            {dirHandle ? (
              <button className="btn btn-secondary" type="button" onClick={() => refreshWorkspace()} disabled={busy}>
                Refresh
              </button>
            ) : null}
          </div>
        </div>

        {dirHandle ? (
          <div className="mt-3 text-sm text-zinc-700">
            Connected: <span className="font-semibold">{dirHandle.name}</span> · Docs found:{" "}
            <span className="font-semibold">{workspaceDocs.length}</span>
            {allowFileWrites ? (
              workspaceMode === "readwrite" ? (
                " · Read + write access granted"
              ) : (
                ' · "Allow file edits" is on, but this folder is connected read-only (click Reconnect folder)'
              )
            ) : (
              " · Read-only (file edits disabled)"
            )}
          </div>
        ) : null}

        <details className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-red-900">Advanced (danger): Permanent actions</summary>
          <div className="mt-2 text-sm text-red-900">
            Turning this on lets the AI delete doc files. Deleting is permanent and cannot be undone.
          </div>
          <label className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-white px-4 py-3">
            <span className="font-semibold text-red-900">Allow deletes</span>
            <input
              type="checkbox"
              className="h-5 w-5"
              checked={allowDeletes}
              onChange={(e) => setAllowDeletes(e.target.checked)}
              disabled={!allowFileWrites}
            />
          </label>
          <div className="mt-2 text-sm text-red-900">
            Safety: the delete tool still requires <code>confirm=true</code>.
          </div>
        </details>

        {dirHandle ? (
          <details className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4">
            <summary className="cursor-pointer text-sm font-semibold text-zinc-900">Backups (undo)</summary>
            <div className="mt-2 text-sm text-zinc-700">
              Amber AI saves a backup before it edits or deletes a file. You can restore a backup here.
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="btn btn-secondary" type="button" onClick={onLoadBackups} disabled={busy || backupsBusy}>
                {backupsBusy ? "Loading..." : "Load backups"}
              </button>
            </div>
            {backupsError ? <div className="mt-2 text-sm text-red-800">{backupsError}</div> : null}
            {backups.length ? (
              <div className="mt-3 grid gap-2">
                {backups.slice(0, 10).map((b) => (
                  <div key={b.backupFileName} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                    <div className="text-sm text-zinc-800">
                      <span className="font-semibold">{b.slug}</span> v<span className="font-semibold">{b.version}</span>
                      {b.createdAt ? <span className="text-zinc-500"> · {b.createdAt}</span> : null}
                    </div>
                    <button
                      className="btn btn-secondary"
                      type="button"
                      disabled={busy || !allowFileWrites || workspaceMode !== "readwrite"}
                      onClick={() => onRestoreBackupFromUi(b.backupFileName, { slug: b.slug, version: b.version })}
                    >
                      Restore
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-2 text-sm text-zinc-600">No backups loaded yet.</div>
            )}
            {!allowFileWrites ? (
              <div className="mt-2 text-sm text-zinc-600">Turn on “Allow file edits” to restore backups.</div>
            ) : null}
          </details>
        ) : null}

        {workspaceErrors.length ? (
          <details className="mt-4 rounded-xl border border-zinc-200 bg-white p-4">
            <summary className="cursor-pointer text-sm font-semibold text-zinc-900">
              Workspace warnings ({workspaceErrors.length})
            </summary>
            <ul className="mt-2 list-disc space-y-1 pl-6 text-sm text-zinc-700">
              {workspaceErrors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      {error ? (
        <section className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <div className="font-semibold">AI error</div>
          <div className="mt-1">{error}</div>
        </section>
      ) : null}

      <section className="mt-6 card p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl font-semibold">Chat</h2>
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => setMessages(messages.slice(0, 1))}
              disabled={busy}
            >
              Clear chat
            </button>
          </div>
        </div>

        {plannedEdit ? (
          <section className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-amber-950">Preview before saving</div>
                <div className="mt-1 text-sm text-amber-950">
                  Planned change for <span className="font-semibold">{plannedEdit.slug}</span> v
                  <span className="font-semibold">{plannedEdit.version}</span>
                </div>
                <div className="mt-1 text-sm text-amber-950">
                  {plannedEdit.summary}
                  {plannedEdit.truncated ? " (preview truncated)" : ""}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="btn btn-primary" type="button" disabled={busy} onClick={onApplyPlannedEdit}>
                  Apply changes
                </button>
                <button className="btn btn-secondary" type="button" disabled={busy} onClick={onDiscardPlannedEdit}>
                  Discard
                </button>
              </div>
            </div>
            <details className="mt-3 rounded-xl border border-amber-200 bg-white p-3">
              <summary className="cursor-pointer text-sm font-semibold text-zinc-900">Show preview (diff)</summary>
              <pre className="mt-2 overflow-auto rounded-xl border border-zinc-200 bg-white p-3 font-mono text-xs text-zinc-900">{plannedEdit.diff}</pre>
            </details>
            <div className="mt-2 text-sm text-amber-950">
              Tip: If you change your mind later, ask:{" "}
              <span className="font-semibold">Undo last change</span> for this doc version (Amber AI keeps backups).
            </div>
          </section>
        ) : null}

        <div className="mb-4 grid gap-2 md:grid-cols-4">
          <button
            className="btn btn-secondary"
            type="button"
            disabled={busy}
            onClick={() =>
              setInput("Find the best doc(s) for my question, then answer it step-by-step. My question is: ")
            }
          >
            Find docs
          </button>
          <button
            className="btn btn-secondary"
            type="button"
            disabled={busy}
            onClick={() =>
              setInput(
                "Draft a new document about: \n\nInclude frontmatter (slug, title, summary, updatedAt, stage=draft, visibility=internal). Return the full draft in final.draft.docText.",
              )
            }
          >
            Draft a doc
          </button>
          <button
            className="btn btn-secondary"
            type="button"
            disabled={busy}
            onClick={() =>
              setInput(
                "Help me update an existing document.\n\nIf I have not given you a slug+version yet, ask me for it. If my workspace folder is connected and file edits are enabled, update the file and keep the doc readable for non-technical readers.",
              )
            }
          >
            Update a doc
          </button>
          <button
            className="btn btn-secondary"
            type="button"
            disabled={busy}
            onClick={() =>
              setInput(
                "Help me publish or unpublish a document, or mark it Final or Official.\n\nIf needed, tell me exactly what to click to connect my docs folder and enable file edits. Then do the publish/unpublish/status action.",
              )
            }
          >
            Publish / status
          </button>
        </div>

        <div className="space-y-3">
          {messages.map((m, i) => (
            <div
              key={i}
              className={
                m.role === "user"
                  ? "rounded-2xl border border-zinc-200 bg-white p-4"
                  : "rounded-2xl border border-black/10 bg-zinc-50 p-4"
              }
            >
              <div className="text-xs font-semibold uppercase tracking-wide text-zinc-600">{m.role}</div>
              {m.role === "tool" ? (
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm font-semibold text-zinc-900">Tool output (advanced)</summary>
                  <pre className="mt-2 overflow-auto rounded-xl border border-zinc-200 bg-white p-3 text-xs text-zinc-900">{m.content}</pre>
                </details>
              ) : (
                <div className="mt-2 whitespace-pre-wrap text-zinc-900">{m.content}</div>
              )}
            </div>
          ))}
        </div>

        <label className="mt-5 block">
          <div className="text-sm font-semibold text-zinc-800">Your message</div>
          <textarea
            className="mt-2 h-28 w-full control"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Example: Find the right doc for publishing. Then draft a new policy doc and save it."
            spellCheck={true}
            disabled={busy}
          />
        </label>

        <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-zinc-900">Attachments (optional)</div>
              <div className="text-sm text-zinc-600">Attach a Markdown/text file for the AI to use as context.</div>
            </div>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => {
                setAttachments([]);
                setAttachmentsError(null);
              }}
              disabled={busy || attachmentsBusy || attachments.length === 0}
            >
              Clear attachments
            </button>
          </div>

          <input
            className="mt-3 w-full"
            type="file"
            multiple
            accept=".md,.mdx,.txt,text/markdown,text/plain"
            disabled={busy || attachmentsBusy}
            onChange={(e) => {
              const files = e.target.files;
              // Allow re-selecting the same file after it has been processed.
              e.currentTarget.value = "";
              void onAddAttachments(files);
            }}
          />

          {attachmentsBusy ? <div className="mt-2 text-sm text-zinc-700">Reading files…</div> : null}
          {attachmentsError ? (
            <div className="mt-2 text-sm text-rose-700">Could not read attachment: {attachmentsError}</div>
          ) : null}

          {attachments.length ? (
            <ul className="mt-3 list-disc space-y-1 pl-6 text-sm text-zinc-700">
              {attachments.map((a, idx) => (
                <li key={`${a.name}-${idx}`} className="flex flex-wrap items-center justify-between gap-3">
                  <span>
                    <span className="font-semibold">{a.name}</span>
                    {a.truncated ? <span className="text-zinc-500"> (truncated)</span> : null}
                  </span>
                  <button className="btn btn-secondary" type="button" onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-3 text-sm text-zinc-700">No files attached.</div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button className="btn btn-primary" type="button" onClick={onSend} disabled={busy || attachmentsBusy || !input.trim()}>
            {busy ? "Working..." : "Send"}
          </button>
          {busy ? (
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => abortRef.current?.abort()}
            >
              Cancel
            </button>
          ) : null}
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => setInput("Find the best doc(s) for my question, then answer it step-by-step. My question is: ")}
            disabled={busy}
          >
            Insert example
          </button>
        </div>
      </section>

      {lastDraft ? (
        <section className="mt-6 card p-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-2xl font-semibold">Draft document (from AI)</h2>
            <div className="flex flex-wrap items-center gap-2">
              <CopyButton text={lastDraft.docText} label="Copy draft" />
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => downloadText("amber-ai-draft.md", lastDraft.docText, "text/markdown")}
              >
                Download .md
              </button>
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => {
                  const ok = saveStudioImport({
                    v: 1,
                    source: "assistant",
                    createdAt: new Date().toISOString(),
                    docText: lastDraft.docText,
                  });
                  if (!ok) return alert("Could not save the draft for Studio (local storage blocked). Copy the draft instead.");
                  window.location.href = "/studio#import";
                }}
              >
                Send to Write + publish
              </button>
            </div>
          </div>
          <textarea
            className="h-80 w-full rounded-xl border border-zinc-200 bg-white p-4 font-mono text-sm text-zinc-900"
            value={lastDraft.docText}
            readOnly
            spellCheck={false}
          />

          {draftLint ? (
            <details className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4" open={!draftLint.ok}>
              <summary className="cursor-pointer text-base font-semibold text-zinc-900">
                Draft checks: {draftLint.ok ? "looks good" : `${draftLint.issues.length} issue${draftLint.issues.length === 1 ? "" : "s"}`}
              </summary>
              {draftLint.ok ? (
                <div className="mt-2 text-sm text-zinc-700">
                  This draft looks like a valid Amber doc file (frontmatter + structure).
                </div>
              ) : (
                <div className="mt-3 grid gap-3">
                  <ul className="list-disc space-y-1 pl-6 text-sm text-zinc-700">
                    {draftLint.issues.map((i) => (
                      <li key={i.code}>{i.message}</li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      className="btn btn-primary"
                      type="button"
                      onClick={onFixDraftWithAi}
                      disabled={draftFixBusy}
                    >
                      {draftFixBusy ? "Fixing..." : "Fix draft with AI"}
                    </button>
                    <div className="text-sm text-zinc-600">
                      This will rewrite the draft to address the checklist (no files are edited).
                    </div>
                  </div>
                  {draftFixError ? (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
                      <div className="font-semibold">Fix failed</div>
                      <div className="mt-1">{draftFixError}</div>
                    </div>
                  ) : null}
                </div>
              )}
            </details>
          ) : null}

          <div className="mt-3 text-sm text-zinc-600">
            Tip: You can connect a folder above and ask Amber AI to create or update the file directly (advanced).
          </div>
        </section>
      ) : null}
    </main>
  );
}
