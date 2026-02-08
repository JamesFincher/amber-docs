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
            <p className="text-sm font-semibold text-zinc-700">Reusable text</p>
            <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">Copy standard language</h1>
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
            <Link href="/" className="btn btn-secondary">
              Home
            </Link>
            <Link href="/help" className="btn btn-secondary">
              Help
            </Link>
          </nav>
        </div>
        <p className="max-w-3xl text-zinc-800">
          Search for a disclaimer or glossary term, then click <span className="font-semibold">Copy</span> to paste it into a document.
          Advanced: you can add custom items stored on this computer.
        </p>
      </header>

      <section className="card p-6">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="block">
            <div className="text-sm font-semibold text-zinc-800">Search</div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Example: official, approval, disclaimer, definition"
              className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base outline-none focus:ring-4 focus:ring-black/10"
            />
          </label>

          <label className="block">
            <div className="text-sm font-semibold text-zinc-800">Tag</div>
            <select
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base"
            >
              {tags.map((t) => (
                <option key={t} value={t}>
                  {t === "all" ? "All" : t}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-col justify-end">
            <details>
              <summary className="cursor-pointer text-base font-semibold text-zinc-900">Advanced options</summary>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={`/assistant?task=${encodeURIComponent(
                    "Help me create reusable text.\n\n1) Ask what I want to create (a disclaimer or a glossary entry).\n2) Draft it.\n3) Save it as a custom item using save_custom_disclaimer or save_custom_glossary_entry.",
                  )}`}
                  className="btn btn-primary"
                >
                  Ask Amber AI to draft one
                </Link>
                <button
                  className="btn btn-secondary"
                  onClick={() =>
                    downloadJson("amber-blocks.json", { snippets: customSnippets, glossary: customGlossary })
                  }
                  type="button"
                >
                  Export custom (JSON)
                </button>
              </div>
              <div className="mt-2 text-sm text-zinc-600">
                Custom items are stored in your browser (on this computer).
              </div>
            </details>
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-semibold">Disclaimers</h2>
              <p className="mt-1 text-zinc-700">Short standard statements you can paste into a document.</p>
            </div>
            <details>
              <summary className="cursor-pointer text-base font-semibold text-zinc-900">Advanced</summary>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button className="btn btn-secondary" type="button" onClick={() => snippetsImportRef.current?.click()}>
                  Import JSON
                </button>
                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() => downloadJson("amber-custom-snippets.json", customSnippets)}
                >
                  Export JSON
                </button>
                <input
                  ref={snippetsImportRef}
                  className="hidden"
                  type="file"
                  accept="application/json"
                  aria-label="Import custom disclaimers JSON file"
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
            </details>
          </div>

          <div className="mt-4 grid gap-4">
            {filteredSnippets.map((s) => (
              <div key={s.id} className="rounded-2xl border border-zinc-200 bg-white p-5">
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
                    <div className="mt-3 text-zinc-800">{s.body}</div>
                  </div>
                  <CopyButton text={s.body} label="Copy text" />
                </div>
              </div>
            ))}
          </div>

          <details className="mt-6">
            <summary className="cursor-pointer text-base font-semibold text-zinc-900">Advanced: Add a custom disclaimer</summary>
            <div className="mt-3 grid gap-3">
              <label className="block">
                <div className="text-sm font-semibold text-zinc-800">Title</div>
                <input
                  className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base"
                  placeholder="Example: Legal disclaimer"
                  value={newSnippetTitle}
                  onChange={(e) => setNewSnippetTitle(e.target.value)}
                />
              </label>
              <label className="block">
                <div className="text-sm font-semibold text-zinc-800">Body</div>
                <textarea
                  className="mt-2 h-32 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base"
                  placeholder="Write the disclaimer text here."
                  value={newSnippetBody}
                  onChange={(e) => setNewSnippetBody(e.target.value)}
                />
              </label>
              <label className="block">
                <div className="text-sm font-semibold text-zinc-800">Tags (comma separated)</div>
                <input
                  className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base"
                  placeholder="Example: legal, public"
                  value={newSnippetTags}
                  onChange={(e) => setNewSnippetTags(e.target.value)}
                />
              </label>
              <button className="btn btn-primary" type="button" onClick={addSnippet}>
                Add disclaimer
              </button>
            </div>
          </details>
        </div>

        <div className="card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-semibold">Glossary</h2>
              <p className="mt-1 text-zinc-700">Definitions for common terms (copy into docs for consistency).</p>
            </div>
            <details>
              <summary className="cursor-pointer text-base font-semibold text-zinc-900">Advanced</summary>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button className="btn btn-secondary" type="button" onClick={() => glossaryImportRef.current?.click()}>
                  Import JSON
                </button>
                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() => downloadJson("amber-custom-glossary.json", customGlossary)}
                >
                  Export JSON
                </button>
                <input
                  ref={glossaryImportRef}
                  className="hidden"
                  type="file"
                  accept="application/json"
                  aria-label="Import custom glossary JSON file"
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
                          synonyms: Array.isArray(x.synonyms)
                            ? (x.synonyms.filter((t) => typeof t === "string") as string[])
                            : [],
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
            </details>
          </div>

          <div className="mt-4 grid gap-3">
            {filteredGlossary.map((g) => (
              <div key={g.term} className="rounded-2xl border border-zinc-200 bg-white p-5">
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
                    <div className="mt-3 text-zinc-800">{g.definition}</div>
                    {g.synonyms?.length ? (
                      <div className="mt-2 text-sm text-zinc-600">Synonyms: {g.synonyms.join(", ")}</div>
                    ) : null}
                  </div>
                  <CopyButton text={`${g.term}: ${g.definition}`} label="Copy term + definition" />
                </div>
              </div>
            ))}
          </div>

          <details className="mt-6">
            <summary className="cursor-pointer text-base font-semibold text-zinc-900">Advanced: Add a custom glossary entry</summary>
            <div className="mt-3 grid gap-3">
              <label className="block">
                <div className="text-sm font-semibold text-zinc-800">Term</div>
                <input
                  className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base"
                  placeholder="Example: Official"
                  value={newGlossaryTerm}
                  onChange={(e) => setNewGlossaryTerm(e.target.value)}
                />
              </label>
              <label className="block">
                <div className="text-sm font-semibold text-zinc-800">Definition</div>
                <textarea
                  className="mt-2 h-32 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base"
                  placeholder="Write the definition here."
                  value={newGlossaryDefinition}
                  onChange={(e) => setNewGlossaryDefinition(e.target.value)}
                />
              </label>
              <label className="block">
                <div className="text-sm font-semibold text-zinc-800">Tags (comma separated)</div>
                <input
                  className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base"
                  placeholder="Example: lifecycle, governance"
                  value={newGlossaryTags}
                  onChange={(e) => setNewGlossaryTags(e.target.value)}
                />
              </label>
              <button className="btn btn-primary" type="button" onClick={addGlossary}>
                Add entry
              </button>
            </div>
          </details>
        </div>
      </section>
    </main>
  );
}
