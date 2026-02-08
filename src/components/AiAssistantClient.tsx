"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { GlossaryEntry, Snippet } from "@/lib/content/blocks.server";
import { geminiGenerateText } from "@/lib/ai/gemini";
import { saveStudioImport } from "@/lib/studioImport";
import { CopyButton } from "@/components/CopyButton";

const GEMINI_KEY = "amber-docs:ai:gemini:key:v1";
const GEMINI_MODEL_KEY = "amber-docs:ai:gemini:model:v1";

type Chunk = {
  chunkId: string;
  slug: string;
  version: string;
  title: string;
  heading: string | null;
  text: string;
  url: string;
};

type ChunksPayload = {
  chunks: Chunk[];
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

function tokens(q: string): string[] {
  return q
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 16);
}

function scoreChunk(chunk: Chunk, qTokens: string[]): number {
  const hay = `${chunk.title} ${chunk.heading ?? ""} ${chunk.text}`.toLowerCase();
  let score = 0;
  for (const t of qTokens) {
    if (t.length < 3) continue;
    if (hay.includes(t)) score += 1;
  }
  return score;
}

function buildContext(chunks: Chunk[]): string {
  if (!chunks.length) return "No internal docs context selected.";
  return chunks
    .map((c) => {
      const label = c.heading ? `${c.title} · ${c.heading}` : c.title;
      return `# ${label}\nSource: ${c.url}\n\n${c.text.trim()}\n`;
    })
    .join("\n\n---\n\n");
}

function buildBlocks(disclaimers: Snippet[], glossary: GlossaryEntry[]) {
  const d =
    disclaimers.length === 0
      ? "None."
      : disclaimers
          .slice(0, 10)
          .map((s) => `- ${s.title}: ${s.body}`)
          .join("\n");

  const g =
    glossary.length === 0
      ? "None."
      : glossary
          .slice(0, 20)
          .map((e) => `- ${e.term}: ${e.definition}`)
          .join("\n");

  return { d, g };
}

export function AiAssistantClient({
  disclaimers,
  glossary,
}: {
  disclaimers: Snippet[];
  glossary: GlossaryEntry[];
}) {
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gemini-2.0-flash");
  const [query, setQuery] = useState("Draft a short governance update about the latest protocol changes.");

  const [includeContext, setIncludeContext] = useState(true);
  const [includeBlocks, setIncludeBlocks] = useState(true);
  const [includeFrontmatter, setIncludeFrontmatter] = useState(true);

  const [chunks, setChunks] = useState<Chunk[] | null>(null);
  const [chunksError, setChunksError] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState("");

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

  // Optional: allow deep links like /assistant?task=...
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const task = sp.get("task") ?? sp.get("q");
      if (task && task.trim()) setQuery(task);
    } catch {
      // ignore
    }
  }, []);

  async function ensureChunksLoaded() {
    if (chunks || chunksError) return;
    try {
      const res = await fetch("/chunks.json", { cache: "force-cache" });
      if (!res.ok) throw new Error(`Failed to load chunks.json (${res.status})`);
      const json = (await res.json()) as { chunks?: unknown };
      const arr = Array.isArray((json as ChunksPayload).chunks) ? ((json as ChunksPayload).chunks as Chunk[]) : [];
      setChunks(arr);
    } catch (e: unknown) {
      setChunksError(e instanceof Error ? e.message : String(e));
    }
  }

  const selectedChunks = useMemo(() => {
    if (!includeContext) return [];
    const arr = chunks ?? [];
    const ts = tokens(query);
    if (!ts.length) return [];

    const scored = arr
      .map((c) => ({ c, s: scoreChunk(c, ts) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 6)
      .map((x) => x.c);
    return scored;
  }, [chunks, includeContext, query]);

  const blocksText = useMemo(() => buildBlocks(disclaimers, glossary), [disclaimers, glossary]);

  const prompt = useMemo(() => {
    const ctx = includeContext ? buildContext(selectedChunks) : "Not included.";
    const blocks = includeBlocks ? blocksText : { d: "Not included.", g: "Not included." };

    const outputFormat = includeFrontmatter
      ? `Output format:
1) YAML frontmatter (--- ... ---) with fields:
   - slug (kebab-case, short)
   - version (YYYY-MM-DD)
   - title
   - stage (draft|final|official)
   - summary (1 sentence)
   - updatedAt (YYYY-MM-DD)
   - owners (array)
   - topics (array)
   - citations (array with label/url, include SOURCE NEEDED placeholders if unsure)
   - approvals (array with name/date when stage is official)
2) Markdown body (start with # Title, then at least one ## section)
Return only the document. Do not wrap in code fences.`
      : `Output format:
- Return only the Markdown body (no frontmatter).
- Start with # Title, then at least one ## section.
- Do not wrap in code fences.`;

    return `You are Amber Docs AI. You help draft and improve documentation while staying factual.

Rules:
- If something is not supported by the provided context, write \"(SOURCE NEEDED: ...)\" and phrase it as a question or assumption.
- Keep language simple and scannable (short paragraphs, bullets).
- Use the glossary terms with the exact case provided.

Task:
${query.trim()}

Internal docs context (selected excerpts):
${ctx}

Reusable text blocks:
Disclaimers:
${blocks.d}

Glossary:
${blocks.g}

${outputFormat}
`;
  }, [blocksText, includeBlocks, includeContext, includeFrontmatter, query, selectedChunks]);

  async function onGenerate() {
    const k = apiKey.trim();
    const m = model.trim();
    if (!k) return alert("Add your Gemini API key first.");
    if (!m) return alert("Choose a model first.");
    if (!query.trim()) return alert("Describe what you want first.");

    setBusy(true);
    setError(null);
    try {
      try {
        localStorage.setItem(GEMINI_KEY, k);
        localStorage.setItem(GEMINI_MODEL_KEY, m);
      } catch {
        // ignore
      }
      const out = await geminiGenerateText({
        apiKey: k,
        model: m,
        prompt,
        temperature: 0.4,
        maxOutputTokens: 4096,
      });
      setOutput(out.text.trimEnd() + "\n");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      setOutput("");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (includeContext) void ensureChunksLoaded();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeContext]);

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <header className="mb-8 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-zinc-700">Ask AI</p>
            <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">Draft a document with context</h1>
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
            <Link href="/help" className="btn btn-secondary">
              Help
            </Link>
          </nav>
        </div>
        <p className="max-w-3xl text-zinc-800">
          Describe what you want in plain English. This tool can include excerpts from internal docs (via{" "}
          <code>/chunks.json</code>) plus glossary and disclaimers, then ask Gemini to draft a Markdown document.
        </p>
      </header>

      <section className="card p-6">
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="block">
            <div className="text-sm font-semibold text-zinc-800">Gemini API key</div>
            <input
              className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base"
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
              className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Example: gemini-2.0-flash"
              autoComplete="off"
            />
          </label>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3">
            <span className="font-semibold text-zinc-900">Use internal docs context</span>
            <input type="checkbox" className="h-5 w-5" checked={includeContext} onChange={(e) => setIncludeContext(e.target.checked)} />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3">
            <span className="font-semibold text-zinc-900">Use glossary + disclaimers</span>
            <input type="checkbox" className="h-5 w-5" checked={includeBlocks} onChange={(e) => setIncludeBlocks(e.target.checked)} />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3">
            <span className="font-semibold text-zinc-900">Include frontmatter</span>
            <input type="checkbox" className="h-5 w-5" checked={includeFrontmatter} onChange={(e) => setIncludeFrontmatter(e.target.checked)} />
          </label>
        </div>

        {includeContext && chunksError ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            Failed to load docs context: {chunksError}
          </div>
        ) : null}

        <label className="mt-4 block">
          <div className="text-sm font-semibold text-zinc-800">What do you want to do?</div>
          <textarea
            className="mt-2 h-32 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Example: Turn the latest treasury notes into a 1-page executive summary."
            spellCheck={true}
          />
        </label>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button className="btn btn-primary" type="button" onClick={onGenerate} disabled={busy}>
            {busy ? "Generating..." : "Generate"}
          </button>
          <CopyButton text={prompt} label="Copy prompt (advanced)" />
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => downloadText("amber-ai-output.md", output, "text/markdown")}
            disabled={!output.trim()}
          >
            Download .md
          </button>
        </div>
      </section>

      {error ? (
        <section className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <div className="font-semibold">Generation failed</div>
          <div className="mt-1">{error}</div>
        </section>
      ) : null}

      <section className="mt-6 card p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl font-semibold">AI output</h2>
          <div className="flex flex-wrap items-center gap-2">
            <CopyButton text={output} label="Copy output" />
            <button
              className="btn btn-secondary"
              type="button"
              disabled={!output.trim()}
              onClick={() => {
                const ok = saveStudioImport({
                  v: 1,
                  source: "assistant",
                  createdAt: new Date().toISOString(),
                  docText: output,
                });
                if (!ok) {
                  alert("Could not save the draft for Studio (local storage blocked). Copy the output instead.");
                  return;
                }
                window.location.href = "/studio#import";
              }}
            >
              Send to Write + publish
            </button>
          </div>
        </div>
        <textarea
          className="h-96 w-full rounded-xl border border-zinc-200 bg-white p-4 font-mono text-sm text-zinc-900"
          value={output}
          readOnly
          spellCheck={false}
        />
        <div className="mt-3 text-sm text-zinc-600">
          Next step: open <span className="font-semibold">Write + publish</span> to save this into your docs folder, then publish when ready.
        </div>
      </section>
    </main>
  );
}
