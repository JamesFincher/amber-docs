"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CopyButton } from "@/components/CopyButton";
import { Markdown } from "@/components/Markdown";
import { adminRpc } from "@/lib/adminClient";

type DocRow = {
  _id: string;
  slug: string;
  title: string;
  updatedAt: number;
  archived: boolean;
  draftRevisionId: string | null;
  finalRevisionId: string | null;
  officialRevisionId: string | null;
};

type Revision = {
  _id: string;
  number: number;
  createdAt: number;
  markdown: string;
  message?: string | null;
};

type RevisionMeta = {
  _id: string;
  number: number;
  createdAt: number;
  message: string | null;
};

type Note = {
  _id: string;
  createdAt: number;
  body: string;
  revisionId: string | null;
  section: string | null;
};

type DocPayload = {
  doc: {
    _id: string;
    slug: string;
    title: string;
    createdAt: number;
    updatedAt: number;
    archived: boolean;
    draftRevisionId: string | null;
    finalRevisionId: string | null;
    officialRevisionId: string | null;
  };
  draft: Revision | null;
  final: Revision | null;
  official: Revision | null;
  revisions: RevisionMeta[];
  notes: Note[];
};

function fmtTime(ms: number) {
  return new Date(ms).toLocaleString();
}

function errMsg(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

function extractH2Sections(markdown: string): Array<{ heading: string; body: string }> {
  const lines = markdown.split(/\r?\n/);
  const sections: Array<{ heading: string; body: string }> = [];
  let current: { heading: string; body: string } | null = null;

  for (const line of lines) {
    const m = line.match(/^##\s+(.*)$/);
    if (m) {
      if (current) sections.push({ ...current, body: current.body.trim() + "\n" });
      current = { heading: m[1].trim(), body: "" };
      continue;
    }
    if (current) current.body += line + "\n";
  }
  if (current) sections.push({ ...current, body: current.body.trim() + "\n" });
  return sections;
}

function promptPack(args: {
  docTitle: string;
  docSlug: string;
  sectionHeading: string;
  sectionBody: string;
  contextDocs: Array<{ title: string; slug: string; markdown: string }>;
}) {
  const context =
    args.contextDocs.length === 0
      ? "No additional context docs selected."
      : args.contextDocs
          .map((d) => `# ${d.title} (${d.slug})\n\n${d.markdown.trim()}\n`)
          .join("\n\n---\n\n");

  return `You are helping write and verify company documentation.

Doc: ${args.docTitle} (${args.docSlug})
Section: ${args.sectionHeading}

Context (official docs):
${context}

Section to review:
${args.sectionBody.trim()}

Tasks:
1) Clarify: rewrite this section to be crisp, specific, and readable by executives. Preserve intent. Use Markdown.
2) Fact-check: list concrete claims and what evidence/source would verify each claim (no browsing required).
3) Consistency: note any likely conflicts with the context docs and suggest a fix.
4) Questions: list missing info you need from the team to finalize this section.

Output format:
- Rewrite:
- Claims to verify:
- Potential conflicts:
- Questions:
`;
}

export function DocEditor({ slug }: { slug: string }) {
  const [data, setData] = useState<DocPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [markdown, setMarkdown] = useState("");
  const [message, setMessage] = useState("");

  const [noteBody, setNoteBody] = useState("");
  const [noteSection, setNoteSection] = useState("");

  const [allDocs, setAllDocs] = useState<DocRow[]>([]);
  const [contextSlugs, setContextSlugs] = useState<string[]>([]);
  const [contextMarkdown, setContextMarkdown] = useState<Record<string, string>>({});

  const officialContextCandidates = useMemo(() => {
    const currentSlug = data?.doc.slug ?? slug;
    return allDocs
      .filter((d) => !!d.officialRevisionId && !d.archived && d.slug !== currentSlug)
      .sort((a, b) => (a.title > b.title ? 1 : -1));
  }, [allDocs, data?.doc.slug, slug]);

  const sections = useMemo(() => {
    const md = markdown || data?.draft?.markdown || "";
    return extractH2Sections(md);
  }, [markdown, data?.draft?.markdown]);

  async function refreshDoc() {
    setLoading(true);
    setError(null);
    try {
      const payload = await adminRpc<DocPayload>("docs.getBySlug", { slug });
      setData(payload);
      setMarkdown(payload.draft?.markdown ?? "");
    } catch (e: unknown) {
      setError(errMsg(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  async function refreshAllDocs() {
    try {
      const rows = await adminRpc<DocRow[]>("docs.list");
      setAllDocs(rows);
    } catch {
      // non-fatal
    }
  }

  useEffect(() => {
    refreshDoc();
    refreshAllDocs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  useEffect(() => {
    let cancelled = false;
    async function loadMissingContext() {
      const missing = contextSlugs.filter((s) => contextMarkdown[s] === undefined);
      if (missing.length === 0) return;
      const updates: Record<string, string> = {};
      for (const s of missing) {
        const res = await fetch(`/raw/${encodeURIComponent(s)}`);
        updates[s] = res.ok ? await res.text() : "";
      }
      if (cancelled) return;
      setContextMarkdown((prev) => ({ ...prev, ...updates }));
    }
    loadMissingContext();
    return () => {
      cancelled = true;
    };
  }, [contextSlugs, contextMarkdown]);

  async function onSaveDraft() {
    if (!data) return;
    setBusy("save");
    setError(null);
    try {
      await adminRpc("docs.saveDraft", {
        docId: data.doc._id,
        markdown,
        message: message.trim() || undefined,
      });
      setMessage("");
      await refreshDoc();
    } catch (e: unknown) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  }

  async function onPromote(kind: "final" | "official", revisionId: string) {
    if (!data) return;
    setBusy(kind);
    setError(null);
    try {
      await adminRpc(kind === "final" ? "docs.promoteToFinal" : "docs.promoteToOfficial", {
        docId: data.doc._id,
        revisionId,
      });
      await refreshDoc();
    } catch (e: unknown) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  }

  async function onLoadRevision(revisionId: string) {
    setBusy("load");
    setError(null);
    try {
      const rev = await adminRpc<Revision | null>("docs.getRevision", { revisionId });
      if (rev?.markdown !== undefined) setMarkdown(rev.markdown);
    } catch (e: unknown) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  }

  async function onAddNote() {
    if (!data) return;
    if (!noteBody.trim()) return;
    setBusy("note");
    setError(null);
    try {
      await adminRpc("notes.add", {
        docId: data.doc._id,
        body: noteBody.trim(),
        section: noteSection.trim() || undefined,
        revisionId: data.doc.draftRevisionId ?? undefined,
      });
      setNoteBody("");
      setNoteSection("");
      await refreshDoc();
    } catch (e: unknown) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  }

  const contextDocs = useMemo(() => {
    return contextSlugs
      .map((s) => {
        const meta = officialContextCandidates.find((d) => d.slug === s);
        return meta
          ? { slug: s, title: meta.title, markdown: contextMarkdown[s] ?? "" }
          : { slug: s, title: s, markdown: contextMarkdown[s] ?? "" };
      })
      .filter((d) => d.markdown.trim().length > 0);
  }, [contextSlugs, contextMarkdown, officialContextCandidates]);

  if (loading) {
    return (
      <div className="min-h-screen px-6 py-10">
        <div className="mx-auto max-w-6xl text-sm text-zinc-700">Loading…</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen px-6 py-10">
        <div className="mx-auto max-w-6xl">
          <Link
            href="/admin"
            className="text-sm font-medium text-zinc-900 underline decoration-black/20 underline-offset-4 hover:decoration-black/40"
          >
            Back to Admin
          </Link>
          <div className="mt-4 rounded-lg border border-red-500/20 bg-red-50 px-3 py-2 text-sm text-red-900">
            {error ?? "Doc not found."}
          </div>
        </div>
      </div>
    );
  }

  const draftNumber = data.draft?.number ?? null;
  const finalNumber = data.final?.number ?? null;
  const officialNumber = data.official?.number ?? null;

  return (
    <div className="min-h-screen px-6 py-10">
      <header className="mx-auto max-w-6xl">
        <nav className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Link
              href="/admin"
              className="rounded-md border border-black/10 bg-white/60 px-3 py-1.5 font-medium text-zinc-900 shadow-sm backdrop-blur hover:bg-white"
            >
              Admin
            </Link>
            <Link
              href={`/docs/${encodeURIComponent(data.doc.slug)}`}
              className="text-xs font-medium text-zinc-700 underline decoration-black/20 underline-offset-4 hover:text-zinc-900 hover:decoration-black/40"
            >
              Public
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <CopyButton text={markdown} label="Copy Draft" />
            <CopyButton text={`# ${data.doc.title}\n\n${markdown}`} label="Copy w/ Title" />
            <button
              type="button"
              onClick={refreshDoc}
              className="rounded-md border border-black/10 bg-white/60 px-3 py-1.5 text-xs font-medium text-zinc-900 shadow-sm backdrop-blur hover:bg-white"
            >
              Refresh
            </button>
          </div>
        </nav>

        <div className="mt-6">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">{data.doc.title}</h1>
          <p className="mt-2 text-sm text-zinc-700">
            {data.doc.slug} · updated {fmtTime(data.doc.updatedAt)}
            {data.doc.archived ? " · archived" : ""}
          </p>
        </div>
      </header>

      <main className="mx-auto mt-8 grid max-w-6xl grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <section className="rounded-2xl border border-black/10 bg-white/60 p-5 shadow-sm backdrop-blur">
            <div className="flex flex-wrap items-baseline justify-between gap-4">
              <h2 className="text-sm font-semibold tracking-wide text-zinc-900">
                Draft Editor {draftNumber ? `(v${draftNumber})` : ""}
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onSaveDraft}
                  disabled={busy !== null}
                  className="rounded-md border border-black/10 bg-zinc-950 px-3 py-1.5 text-xs font-semibold text-zinc-50 shadow-sm hover:bg-zinc-900 disabled:opacity-60"
                >
                  {busy === "save" ? "Saving…" : "Save Draft (New Revision)"}
                </button>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3">
              <label className="block">
                <div className="text-xs font-medium text-zinc-700">Revision message (optional)</div>
                <input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none ring-zinc-900/10 focus:ring-2"
                  placeholder="e.g. Tighten Problem section"
                />
              </label>

              <label className="block">
                <div className="text-xs font-medium text-zinc-700">Markdown</div>
                <textarea
                  value={markdown}
                  onChange={(e) => setMarkdown(e.target.value)}
                  className="mt-1 h-[420px] w-full resize-y rounded-lg border border-black/10 bg-white px-3 py-2 font-mono text-xs text-zinc-900 shadow-sm outline-none ring-zinc-900/10 focus:ring-2"
                  placeholder="# Title\n\n## Problem\n..."
                />
              </label>
            </div>

            {error ? (
              <div className="mt-4 rounded-lg border border-red-500/20 bg-red-50 px-3 py-2 text-sm text-red-900">
                {error}
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-black/10 bg-white/60 p-5 shadow-sm backdrop-blur">
            <div className="flex flex-wrap items-baseline justify-between gap-4">
              <h2 className="text-sm font-semibold tracking-wide text-zinc-900">Workflow</h2>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-md border border-black/10 bg-white px-2 py-1">
                  Draft: {draftNumber ?? "—"}
                </span>
                <span className="rounded-md border border-black/10 bg-white px-2 py-1">
                  Final: {finalNumber ?? "—"}
                </span>
                <span className="rounded-md border border-black/10 bg-white px-2 py-1">
                  Official: {officialNumber ?? "—"}
                </span>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!data.draft || busy !== null}
                onClick={() => data.draft && onPromote("final", data.draft._id)}
                className="rounded-md border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-950 shadow-sm hover:bg-zinc-50 disabled:opacity-60"
              >
                {busy === "final" ? "Promoting…" : "Promote Draft → Final"}
              </button>
              <button
                type="button"
                disabled={!data.draft || busy !== null}
                onClick={() => data.draft && onPromote("official", data.draft._id)}
                className="rounded-md border border-black/10 bg-zinc-950 px-3 py-1.5 text-xs font-semibold text-zinc-50 shadow-sm hover:bg-zinc-900 disabled:opacity-60"
              >
                {busy === "official" ? "Publishing…" : "Promote Draft → Official"}
              </button>
              <Link
                href={`/raw/${encodeURIComponent(data.doc.slug)}`}
                className="rounded-md border border-black/10 bg-white/60 px-3 py-1.5 text-xs font-semibold text-zinc-900 shadow-sm backdrop-blur hover:bg-white"
              >
                Raw Official
              </Link>
            </div>
          </section>

          <section className="rounded-2xl border border-black/10 bg-white/60 p-5 shadow-sm backdrop-blur">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-sm font-semibold tracking-wide text-zinc-900">Revisions</h2>
              <div className="text-xs text-zinc-600">{data.revisions.length} total</div>
            </div>
            <ul className="mt-4 divide-y divide-black/5">
              {data.revisions.map((r) => (
                <li key={r._id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-zinc-950">
                      v{r.number}{" "}
                      <span className="ml-2 text-xs font-normal text-zinc-600">{fmtTime(r.createdAt)}</span>
                    </div>
                    {r.message ? <div className="mt-1 text-xs text-zinc-700">{r.message}</div> : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => onLoadRevision(r._id)}
                      className="rounded-md border border-black/10 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-900 shadow-sm hover:bg-zinc-50 disabled:opacity-60"
                    >
                      {busy === "load" ? "Loading…" : "Load"}
                    </button>
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => onPromote("final", r._id)}
                      className="rounded-md border border-black/10 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-900 shadow-sm hover:bg-zinc-50 disabled:opacity-60"
                    >
                      Promote → Final
                    </button>
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => onPromote("official", r._id)}
                      className="rounded-md border border-black/10 bg-zinc-950 px-2.5 py-1.5 text-xs font-medium text-zinc-50 shadow-sm hover:bg-zinc-900 disabled:opacity-60"
                    >
                      Publish
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-black/10 bg-white/60 p-5 shadow-sm backdrop-blur">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-sm font-semibold tracking-wide text-zinc-900">Notes</h2>
              <div className="text-xs text-zinc-600">{data.notes.length} total</div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3">
              <label className="block">
                <div className="text-xs font-medium text-zinc-700">Section (optional)</div>
                <input
                  value={noteSection}
                  onChange={(e) => setNoteSection(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none ring-zinc-900/10 focus:ring-2"
                  placeholder="Problem"
                />
              </label>
              <label className="block">
                <div className="text-xs font-medium text-zinc-700">Note</div>
                <textarea
                  value={noteBody}
                  onChange={(e) => setNoteBody(e.target.value)}
                  className="mt-1 h-28 w-full resize-y rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none ring-zinc-900/10 focus:ring-2"
                  placeholder="Add a decision, TODO, question, or context."
                />
              </label>
              <button
                type="button"
                onClick={onAddNote}
                disabled={busy !== null}
                className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-zinc-950 shadow-sm hover:bg-zinc-50 disabled:opacity-60"
              >
                {busy === "note" ? "Saving…" : "Add Note"}
              </button>
            </div>

            <ul className="mt-5 space-y-3">
              {data.notes
                .slice()
                .sort((a, b) => b.createdAt - a.createdAt)
                .map((n) => (
                  <li key={n._id} className="rounded-xl border border-black/10 bg-white/70 p-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div className="text-xs font-semibold text-zinc-900">
                        {n.section ? n.section : "General"}
                        {n.revisionId ? <span className="ml-2 font-normal text-zinc-600">(draft)</span> : null}
                      </div>
                      <div className="text-[11px] text-zinc-600">{fmtTime(n.createdAt)}</div>
                    </div>
                    <div className="mt-2 whitespace-pre-wrap text-sm text-zinc-800">{n.body}</div>
                  </li>
                ))}
            </ul>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-2xl border border-black/10 bg-white/60 p-5 shadow-sm backdrop-blur">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-sm font-semibold tracking-wide text-zinc-900">Preview</h2>
              <div className="flex items-center gap-2">
                <CopyButton text={markdown} label="Copy Markdown" />
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-black/10 bg-white/70 p-4">
              <Markdown value={markdown} />
            </div>
          </section>

          <section className="rounded-2xl border border-black/10 bg-white/60 p-5 shadow-sm backdrop-blur">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-sm font-semibold tracking-wide text-zinc-900">Prompt Packs</h2>
              <div className="text-xs text-zinc-600">Copy/paste into any model</div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3">
              <div>
                <div className="text-xs font-medium text-zinc-700">Context docs (official)</div>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {officialContextCandidates.length === 0 ? (
                    <div className="text-sm text-zinc-700">No official docs to use as context yet.</div>
                  ) : (
                    officialContextCandidates.map((d) => {
                      const checked = contextSlugs.includes(d.slug);
                      return (
                        <label
                          key={d.slug}
                          className="flex items-center gap-2 rounded-lg border border-black/10 bg-white/70 px-3 py-2 text-sm text-zinc-900"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              setContextSlugs((prev) =>
                                e.target.checked ? [...prev, d.slug] : prev.filter((s) => s !== d.slug),
                              );
                            }}
                          />
                          <span className="min-w-0 truncate">{d.title}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-black/10 bg-zinc-950/95 p-3 text-xs text-zinc-50">
                <div className="font-semibold">How to use</div>
                <div className="mt-1 text-zinc-200">
                  Pick a section below, click Copy, then paste into Claude / OpenAI / Kimi. Add any extra context if
                  needed.
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {sections.length === 0 ? (
                <div className="text-sm text-zinc-700">
                  Add `##` headings to your markdown to generate section prompts.
                </div>
              ) : (
                sections.map((s) => {
                  const prompt = promptPack({
                    docTitle: data.doc.title,
                    docSlug: data.doc.slug,
                    sectionHeading: s.heading,
                    sectionBody: `## ${s.heading}\n\n${s.body}`.trim(),
                    contextDocs,
                  });

                  return (
                    <div key={s.heading} className="rounded-2xl border border-black/10 bg-white/70 p-4">
                      <div className="flex flex-wrap items-baseline justify-between gap-3">
                        <div className="text-sm font-semibold text-zinc-950">{s.heading}</div>
                        <div className="flex items-center gap-2">
                          <CopyButton text={prompt} label="Copy Prompt" />
                          <CopyButton text={s.body.trim()} label="Copy Section" />
                        </div>
                      </div>
                      <textarea
                        readOnly
                        value={prompt}
                        className="mt-3 h-44 w-full resize-y rounded-lg border border-black/10 bg-white px-3 py-2 font-mono text-[11px] text-zinc-900 shadow-sm"
                      />
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
