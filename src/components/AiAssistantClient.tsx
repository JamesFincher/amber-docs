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
import type { AgentTranscriptItem, ToolDescriptor } from "@/lib/ai/castleAgent";
import { runAgentLoop } from "@/lib/ai/castleAgent";
import { saveStudioImport } from "@/lib/studioImport";
import { CopyButton } from "@/components/CopyButton";

const GEMINI_KEY = "amber-docs:ai:gemini:key:v1";
const GEMINI_MODEL_KEY = "amber-docs:ai:gemini:model:v1";
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

async function pickDirectoryHandle(): Promise<FsDirectoryHandle | null> {
  const picker = (window as Window & {
    showDirectoryPicker?: (opts?: { mode?: "read" | "readwrite" }) => Promise<unknown>;
  }).showDirectoryPicker;
  if (!picker) return null;
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
  const [model, setModel] = useState("gemini-2.0-flash");

  const [includeContext, setIncludeContext] = useState(true);
  const [includeBlocks, setIncludeBlocks] = useState(true);
  const [includeTemplates, setIncludeTemplates] = useState(true);
  const [allowFileWrites, setAllowFileWrites] = useState(false);

  const [dirHandle, setDirHandle] = useState<FsDirectoryHandle | null>(null);
  const [workspaceDocs, setWorkspaceDocs] = useState<LocalDoc[]>([]);
  const [workspaceErrors, setWorkspaceErrors] = useState<string[]>([]);
  const workspaceDocsRef = useRef<LocalDoc[]>([]);

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
    try {
      const k = localStorage.getItem(GEMINI_KEY);
      const m = localStorage.getItem(GEMINI_MODEL_KEY);
      if (k) setApiKey(k);
      if (m) setModel(m);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const task = sp.get("task") ?? sp.get("q");
      const doc = sp.get("doc");
      const version = sp.get("version");
      if (task && task.trim()) setInput(task);
      else if (doc && doc.trim()) {
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
    const handle = await pickDirectoryHandle();
    if (!handle) {
      alert("This browser does not support connecting to a folder. Use Chrome or Edge.");
      return;
    }
    setDirHandle(handle);
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
        description: "Return whether a local docs folder is connected and whether file writes are allowed.",
        args: "{}",
        returns: "{ connected: boolean, allowFileWrites: boolean, docsCount: number }",
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
        description: "Update an existing doc file in the connected folder.",
        args: "{ slug: string, version: string, patchFrontmatter?: object, markdown?: string, auditAction?: string, auditNote?: string }",
        returns: "{ ok: boolean, fileName: string }",
      },
      {
        name: "workspace_publish",
        description: "Publish a doc in the connected folder (sets archived=false).",
        args: "{ slug: string, version: string }",
        returns: "{ ok: boolean }",
      },
      {
        name: "workspace_unpublish",
        description: "Unpublish a doc in the connected folder (sets archived=true).",
        args: "{ slug: string, version: string }",
        returns: "{ ok: boolean }",
      },
      {
        name: "workspace_set_stage",
        description: "Set a doc stage in the connected folder (draft/final/official).",
        args: '{ slug: string, version: string, stage: "draft"|"final"|"official" }',
        returns: "{ ok: boolean }",
      },
      {
        name: "workspace_finalize",
        description: "Finalize a doc (set stage=official and publish it).",
        args: "{ slug: string, version: string }",
        returns: "{ ok: boolean }",
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
        args: "{ slug: string, version: string }",
        returns: "{ ok: boolean }",
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

    try {
      try {
        localStorage.setItem(GEMINI_KEY, k);
        localStorage.setItem(GEMINI_MODEL_KEY, m);
      } catch {
        // ignore
      }

      const base: AgentTranscriptItem[] = [...messages, { role: "user", content: text }];

      await ensureIndexesLoaded();
      if (includeContext) await ensureChunksLoaded();

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
          return { connected: !!dirHandle, allowFileWrites, docsCount: workspaceDocsRef.current.length };
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
          if (!dirHandle) throw new Error("No workspace folder connected");
          if (!allowFileWrites) throw new Error("File writes are disabled in settings");

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
          const handle = await dirHandle.getFileHandle(fileName, { create: true });

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
          await refreshWorkspace(dirHandle);
          return { ok: true, fileName };
        },

        workspace_update_doc: async (args) => {
          if (!dirHandle) throw new Error("No workspace folder connected");
          if (!allowFileWrites) throw new Error("File writes are disabled in settings");

          const a = asRecord(args);
          const slug = typeof a.slug === "string" ? a.slug : "";
          const version = typeof a.version === "string" ? a.version : "";
          if (!slug || !version) throw new Error("workspace_update_doc requires slug and version");
          const doc = workspaceDocsRef.current.find((d) => d.slug === slug && d.version === version);
          if (!doc) throw new Error(`Doc not found in workspace: ${slug}@${version}`);

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
          }

          const md = patchMarkdown ?? doc.markdown;
          const body = matter.stringify(md, stripUndefined(nextFm) as Record<string, unknown>);
          await writeHandleText(doc.handle, body);
          await refreshWorkspace(dirHandle);
          return { ok: true, fileName: doc.fileName };
        },

        workspace_publish: async (args) => {
          const a = asRecord(args);
          const slug = typeof a.slug === "string" ? a.slug : "";
          const version = typeof a.version === "string" ? a.version : "";
          await toolFns.workspace_update_doc({ slug, version, patchFrontmatter: { archived: false }, auditAction: "ai:publish" });
          return { ok: true };
        },

        workspace_unpublish: async (args) => {
          const a = asRecord(args);
          const slug = typeof a.slug === "string" ? a.slug : "";
          const version = typeof a.version === "string" ? a.version : "";
          await toolFns.workspace_update_doc({ slug, version, patchFrontmatter: { archived: true }, auditAction: "ai:unpublish" });
          return { ok: true };
        },

        workspace_set_stage: async (args) => {
          const a = asRecord(args);
          const slug = typeof a.slug === "string" ? a.slug : "";
          const version = typeof a.version === "string" ? a.version : "";
          const stage: DocStage | null = isStage(a.stage) ? a.stage : null;
          if (!stage) throw new Error("workspace_set_stage requires stage draft|final|official");
          await toolFns.workspace_update_doc({
            slug,
            version,
            patchFrontmatter: { stage },
            auditAction: "ai:set_stage",
            auditNote: `to ${stage}`,
          });
          return { ok: true };
        },

        workspace_finalize: async (args) => {
          const a = asRecord(args);
          const slug = typeof a.slug === "string" ? a.slug : "";
          const version = typeof a.version === "string" ? a.version : "";
          if (!slug || !version) throw new Error("workspace_finalize requires slug and version");
          await toolFns.workspace_update_doc({
            slug,
            version,
            patchFrontmatter: { stage: "official", archived: false },
            auditAction: "ai:finalize",
          });
          return { ok: true };
        },

        workspace_clone_version: async (args) => {
          if (!dirHandle) throw new Error("No workspace folder connected");
          if (!allowFileWrites) throw new Error("File writes are disabled in settings");

          const a = asRecord(args);
          const slug = typeof a.slug === "string" ? a.slug : "";
          const fromVersion = typeof a.fromVersion === "string" ? a.fromVersion : "";
          const newVersion = typeof a.newVersion === "string" ? a.newVersion : "";
          if (!slug || !fromVersion || !newVersion) throw new Error("workspace_clone_version requires slug, fromVersion, newVersion");

          const baseDoc = workspaceDocsRef.current.find((d) => d.slug === slug && d.version === fromVersion);
          if (!baseDoc) throw new Error(`Base doc not found in workspace: ${slug}@${fromVersion}`);

          const { version, updatedAt } = resolveVersionAndUpdatedAt({ version: newVersion.trim(), updatedAt: null });
          const fileName = suggestedDocFileName(slug, version);
          const handle = await dirHandle.getFileHandle(fileName, { create: true });

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
          await refreshWorkspace(dirHandle);
          return { ok: true, fileName };
        },

        workspace_delete_doc: async (args) => {
          if (!dirHandle) throw new Error("No workspace folder connected");
          if (!allowFileWrites) throw new Error("File writes are disabled in settings");

          const a = asRecord(args);
          const slug = typeof a.slug === "string" ? a.slug : "";
          const version = typeof a.version === "string" ? a.version : "";
          const doc = workspaceDocsRef.current.find((d) => d.slug === slug && d.version === version);
          if (!doc) throw new Error(`Doc not found in workspace: ${slug}@${version}`);

          await dirHandle.removeEntry(doc.fileName);
          await refreshWorkspace(dirHandle);
          return { ok: true };
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
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
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
          </label>

          <label className="block">
            <div className="text-sm font-semibold text-zinc-800">Model</div>
            <input
              className="mt-2 w-full control"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Example: gemini-2.0-flash"
              autoComplete="off"
            />
          </label>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
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
          <label className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <span className="font-semibold text-red-900">Allow file edits</span>
            <input
              type="checkbox"
              className="h-5 w-5"
              checked={allowFileWrites}
              onChange={(e) => setAllowFileWrites(e.target.checked)}
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
            {allowFileWrites ? " · File edits enabled" : " · Read-only (file edits disabled)"}
          </div>
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
                "Help me publish, unpublish, or finalize a document.\n\nIf needed, tell me exactly what to click to connect my docs folder and enable file edits. Then do the publish/unpublish/finalize action.",
              )
            }
          >
            Publish/finalize
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

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button className="btn btn-primary" type="button" onClick={onSend} disabled={busy || !input.trim()}>
            {busy ? "Working..." : "Send"}
          </button>
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
          <div className="mt-3 text-sm text-zinc-600">
            Tip: You can connect a folder above and ask Amber AI to create or update the file directly (advanced).
          </div>
        </section>
      ) : null}
    </main>
  );
}
