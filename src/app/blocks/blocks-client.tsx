"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CopyButton } from "@/components/CopyButton";
import type { GlossaryEntry, Snippet } from "@/lib/content/blocks.server";

const CUSTOM_SNIPPETS_KEY = "amber-docs:blocks:snippets:v1";
const CUSTOM_GLOSSARY_KEY = "amber-docs:blocks:glossary:v1";

function uniq(xs: string[]): string[] {
  return Array.from(new Set(xs));
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

function downloadJson(filename: string, json: unknown) {
  const blob = new Blob([JSON.stringify(json, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function BlocksClient({ disclaimers, glossary }: { disclaimers: Snippet[]; glossary: GlossaryEntry[] }) {
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<string>("all");
  const [customSnippets, setCustomSnippets] = useState<Snippet[]>([]);
  const [customGlossary, setCustomGlossary] = useState<GlossaryEntry[]>([]);

  const [newSnippetTitle, setNewSnippetTitle] = useState("");
  const [newSnippetBody, setNewSnippetBody] = useState("");
  const [newSnippetTags, setNewSnippetTags] = useState("legal, public");

  const [newGlossaryTerm, setNewGlossaryTerm] = useState("");
  const [newGlossaryDefinition, setNewGlossaryDefinition] = useState("");
  const [newGlossaryTags, setNewGlossaryTags] = useState("lifecycle");

  const snippetsImportRef = useRef<HTMLInputElement | null>(null);
  const glossaryImportRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setCustomSnippets(readCustomSnippets());
    setCustomGlossary(readCustomGlossary());
  }, []);

  const allSnippets = useMemo(() => {
    const map = new Map<string, Snippet>();
    for (const s of [...disclaimers, ...customSnippets]) map.set(s.id, s);
    return Array.from(map.values()).sort((a, b) => a.title.localeCompare(b.title));
  }, [disclaimers, customSnippets]);

  const allGlossary = useMemo(() => {
    const map = new Map<string, GlossaryEntry>();
    for (const g of [...glossary, ...customGlossary]) map.set(g.term, g);
    return Array.from(map.values()).sort((a, b) => a.term.localeCompare(b.term));
  }, [glossary, customGlossary]);

  const tags = useMemo(() => {
    const all = [
      ...allSnippets.flatMap((s) => s.tags ?? []),
      ...allGlossary.flatMap((g) => g.tags ?? []),
    ].map((t) => t.trim()).filter(Boolean);
    return ["all", ...uniq(all).sort((a, b) => a.localeCompare(b))];
  }, [allSnippets, allGlossary]);

  const filteredSnippets = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allSnippets.filter((s) => {
      if (tag !== "all" && !(s.tags ?? []).includes(tag)) return false;
      if (!q) return true;
      return `${s.title} ${s.body} ${(s.tags ?? []).join(" ")}`.toLowerCase().includes(q);
    });
  }, [allSnippets, query, tag]);

  const filteredGlossary = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allGlossary.filter((g) => {
      if (tag !== "all" && !(g.tags ?? []).includes(tag)) return false;
      if (!q) return true;
      return `${g.term} ${g.definition} ${(g.synonyms ?? []).join(" ")} ${(g.tags ?? []).join(" ")}`
        .toLowerCase()
        .includes(q);
    });
  }, [allGlossary, query, tag]);

  function addSnippet() {
    const title = newSnippetTitle.trim();
    const body = newSnippetBody.trim();
    if (!title || !body) return;

    const id = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const tags = newSnippetTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const next: Snippet[] = [...customSnippets, { id: `custom-${id}`, title, body, tags }];
    setCustomSnippets(next);
    writeCustomSnippets(next);
    setNewSnippetTitle("");
    setNewSnippetBody("");
  }

  function addGlossary() {
    const term = newGlossaryTerm.trim();
    const definition = newGlossaryDefinition.trim();
    if (!term || !definition) return;
    const tags = newGlossaryTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const next: GlossaryEntry[] = [...customGlossary, { term, definition, synonyms: [], tags }];
    setCustomGlossary(next);
    writeCustomGlossary(next);
    setNewGlossaryTerm("");
    setNewGlossaryDefinition("");
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <header className="mb-8 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Writer tools</p>
            <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">Blocks</h1>
          </div>
          <nav className="flex flex-wrap gap-2 text-sm">
            <Link href="/docs" className="btn btn-secondary">
              Docs
            </Link>
            <Link href="/templates" className="btn btn-secondary">
              Templates
            </Link>
            <Link href="/" className="btn btn-secondary">
              Home
            </Link>
          </nav>
        </div>
        <p className="max-w-3xl text-zinc-600">
          Reusable content blocks you can paste into docs or use inside template prompts. Add custom blocks
          locally or export them as JSON.
        </p>
      </header>

      <section className="card p-6">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="block">
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Search</div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search blocks..."
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
            />
          </label>

          <label className="block">
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Tag</div>
            <select
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
            >
              {tags.map((t) => (
                <option key={t} value={t}>
                  {t === "all" ? "All" : t}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-wrap items-end justify-end gap-2">
            <button className="btn btn-secondary" onClick={() => downloadJson("amber-blocks.json", { snippets: customSnippets, glossary: customGlossary })}>
              Export custom
            </button>
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-xl font-semibold">Disclaimers</h2>
            <div className="flex flex-wrap items-center gap-2">
              <button className="btn btn-secondary" onClick={() => snippetsImportRef.current?.click()}>
                Import
              </button>
              <button className="btn btn-secondary" onClick={() => downloadJson("amber-custom-snippets.json", customSnippets)}>
                Export
              </button>
              <input
                ref={snippetsImportRef}
                className="hidden"
                type="file"
                accept="application/json"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    const text = String(reader.result ?? "");
                    const arr = safeParseArray(text);
                    if (!arr) return alert("Invalid JSON file");
                    const parsed = arr
                      .map((x) => x as Record<string, unknown>)
                      .filter((x) => typeof x.id === "string" && typeof x.title === "string" && typeof x.body === "string")
                      .map((x) => ({
                        id: String(x.id),
                        title: String(x.title),
                        body: String(x.body),
                        tags: Array.isArray(x.tags) ? (x.tags.filter((t) => typeof t === "string") as string[]) : [],
                      }));
                    setCustomSnippets(parsed);
                    writeCustomSnippets(parsed);
                  };
                  reader.readAsText(file);
                  e.currentTarget.value = "";
                }}
              />
            </div>
          </div>

          <div className="mt-4 grid gap-4">
            {filteredSnippets.map((s) => (
              <div key={s.id} className="rounded-2xl border border-zinc-200 bg-white/70 p-5 backdrop-blur">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-zinc-900">{s.title}</div>
                    {s.tags?.length ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {s.tags.map((t) => (
                          <span key={t} className="chip chip-muted">
                            {t}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <div className="mt-3 text-sm text-zinc-700">{s.body}</div>
                  </div>
                  <CopyButton text={s.body} label="Copy" />
                </div>
              </div>
            ))}
          </div>

          <details className="mt-6">
            <summary className="cursor-pointer text-sm font-semibold text-zinc-900">Add custom disclaimer</summary>
            <div className="mt-3 grid gap-3">
              <input
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                placeholder="Title"
                value={newSnippetTitle}
                onChange={(e) => setNewSnippetTitle(e.target.value)}
              />
              <textarea
                className="h-28 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                placeholder="Body"
                value={newSnippetBody}
                onChange={(e) => setNewSnippetBody(e.target.value)}
              />
              <input
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                placeholder="Tags (comma separated)"
                value={newSnippetTags}
                onChange={(e) => setNewSnippetTags(e.target.value)}
              />
              <button className="btn btn-primary" onClick={addSnippet}>
                Add disclaimer
              </button>
            </div>
          </details>
        </div>

        <div className="card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-xl font-semibold">Glossary</h2>
            <div className="flex flex-wrap items-center gap-2">
              <button className="btn btn-secondary" onClick={() => glossaryImportRef.current?.click()}>
                Import
              </button>
              <button className="btn btn-secondary" onClick={() => downloadJson("amber-custom-glossary.json", customGlossary)}>
                Export
              </button>
              <input
                ref={glossaryImportRef}
                className="hidden"
                type="file"
                accept="application/json"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    const text = String(reader.result ?? "");
                    const arr = safeParseArray(text);
                    if (!arr) return alert("Invalid JSON file");
                    const parsed = arr
                      .map((x) => x as Record<string, unknown>)
                      .filter((x) => typeof x.term === "string" && typeof x.definition === "string")
                      .map((x) => ({
                        term: String(x.term),
                        definition: String(x.definition),
                        synonyms: Array.isArray(x.synonyms) ? (x.synonyms.filter((t) => typeof t === "string") as string[]) : [],
                        tags: Array.isArray(x.tags) ? (x.tags.filter((t) => typeof t === "string") as string[]) : [],
                      }));
                    setCustomGlossary(parsed);
                    writeCustomGlossary(parsed);
                  };
                  reader.readAsText(file);
                  e.currentTarget.value = "";
                }}
              />
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            {filteredGlossary.map((g) => (
              <div key={g.term} className="rounded-2xl border border-zinc-200 bg-white/70 p-5 backdrop-blur">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-zinc-900">{g.term}</div>
                    {g.tags?.length ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {g.tags.map((t) => (
                          <span key={t} className="chip chip-muted">
                            {t}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <div className="mt-3 text-sm text-zinc-700">{g.definition}</div>
                    {g.synonyms?.length ? (
                      <div className="mt-2 text-xs text-zinc-500">
                        Synonyms: {g.synonyms.join(", ")}
                      </div>
                    ) : null}
                  </div>
                  <CopyButton text={`${g.term}: ${g.definition}`} label="Copy" />
                </div>
              </div>
            ))}
          </div>

          <details className="mt-6">
            <summary className="cursor-pointer text-sm font-semibold text-zinc-900">Add custom glossary entry</summary>
            <div className="mt-3 grid gap-3">
              <input
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                placeholder="Term"
                value={newGlossaryTerm}
                onChange={(e) => setNewGlossaryTerm(e.target.value)}
              />
              <textarea
                className="h-28 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                placeholder="Definition"
                value={newGlossaryDefinition}
                onChange={(e) => setNewGlossaryDefinition(e.target.value)}
              />
              <input
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                placeholder="Tags (comma separated)"
                value={newGlossaryTags}
                onChange={(e) => setNewGlossaryTags(e.target.value)}
              />
              <button className="btn btn-primary" onClick={addGlossary}>
                Add entry
              </button>
            </div>
          </details>
        </div>
      </section>
    </main>
  );
}

