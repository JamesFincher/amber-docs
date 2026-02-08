"use client";

import Link from "next/link";
import matter from "gray-matter";
import { useEffect, useMemo, useState } from "react";
import type { DocStage } from "@/lib/docs";
import { stageBadgeClass } from "@/lib/docs";
import { isoDate, resolveVersionAndUpdatedAt, safeFilePart, suggestedDocFileName } from "@/lib/content/docsWorkflow.shared";
import { CopyButton } from "@/components/CopyButton";

type LocalDoc = {
  fileName: string;
  handle: FsFileHandle;
  slug: string;
  version: string;
  title: string;
  stage: DocStage;
  archived: boolean;
  updatedAt: string;
  lastReviewedAt: string | null;
  summary: string;
  owners: string[];
  topics: string[];
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
      const lastReviewedAt = typeof fm.lastReviewedAt === "string" ? fm.lastReviewedAt : null;
      const owners = safeStringArray(fm.owners);
      const topics = safeStringArray(fm.topics);

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
        updatedAt,
        lastReviewedAt,
        summary,
        owners,
        topics,
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

export function StudioClient() {
  const [dirHandle, setDirHandle] = useState<FsDirectoryHandle | null>(null);
  const [docs, setDocs] = useState<LocalDoc[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const [selectedFile, setSelectedFile] = useState<string>("");
  const selected = useMemo(() => docs.find((d) => d.fileName === selectedFile) ?? null, [docs, selectedFile]);

  const [editTitle, setEditTitle] = useState("");
  const [editSummary, setEditSummary] = useState("");
  const [editStage, setEditStage] = useState<DocStage>("draft");
  const [editArchived, setEditArchived] = useState<boolean>(true);
  const [editUpdatedAt, setEditUpdatedAt] = useState("");
  const [editLastReviewedAt, setEditLastReviewedAt] = useState<string>("");
  const [editOwners, setEditOwners] = useState("");
  const [editTopics, setEditTopics] = useState("");
  const [editMarkdown, setEditMarkdown] = useState("");

  const [newTitle, setNewTitle] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newSummary, setNewSummary] = useState("");
  const [newStage, setNewStage] = useState<DocStage>("draft");
  const [newVersion, setNewVersion] = useState<string>(isoDate(new Date()));

  useEffect(() => {
    if (!selected) return;
    setEditTitle(selected.title);
    setEditSummary(selected.summary);
    setEditStage(selected.stage);
    setEditArchived(selected.archived);
    setEditUpdatedAt(selected.updatedAt);
    setEditLastReviewedAt(selected.lastReviewedAt ?? "");
    setEditOwners(selected.owners.join(", "));
    setEditTopics(selected.topics.join(", "));
    setEditMarkdown(selected.markdown);
  }, [selected?.fileName]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!newTitle.trim()) return;
    setNewSlug((prev) => (prev.trim() ? prev : slugifyTitle(newTitle)));
  }, [newTitle]);

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

  function buildEditedFileBody(base: LocalDoc): string {
    const owners = editOwners
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    const topics = editTopics
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

    const fm: Record<string, unknown> = {
      ...base.frontmatter,
      slug: base.slug,
      version: base.version,
      title: editTitle.trim() || base.title,
      stage: editStage,
      archived: editArchived,
      summary: editSummary.trim(),
      updatedAt: editUpdatedAt.trim() || base.updatedAt,
      lastReviewedAt: editLastReviewedAt.trim() || undefined,
      owners,
      topics,
    };

    return matter.stringify(editMarkdown.trimEnd() + "\n", stripUndefined(fm) as Record<string, unknown>);
  }

  async function onSaveEdits() {
    if (!selected || !dirHandle) return;
    if (!editTitle.trim() || !editSummary.trim() || !editUpdatedAt.trim()) {
      alert("Title, summary, and updated date are required.");
      return;
    }
    setBusy(true);
    try {
      const body = buildEditedFileBody(selected);
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
      const body = buildEditedFileBody({ ...selected, archived: !published });
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
      const nextBase = { ...selected, stage };
      const body = buildEditedFileBody(nextBase);
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
        lastReviewedAt: undefined,
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
    const md = `# ${title}\n\n## Overview\n\n_TODO: Write an overview._\n`;

    const fm: Record<string, unknown> = {
      slug,
      version,
      title,
      stage: newStage,
      archived: true,
      summary,
      updatedAt,
      owners: [],
      topics: [],
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
      await refresh();
      alert(`Created: ${fileName}\n\nIt is currently unpublished. Use Publish when ready.`);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
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
                className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Example: Treasury Strategy Q3"
              />
            </label>
            <label className="block">
              <div className="text-sm font-semibold text-zinc-800">Slug (URL name)</div>
              <input
                className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base"
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
                placeholder="example: treasury-strategy-q3"
              />
            </label>
            <label className="block">
              <div className="text-sm font-semibold text-zinc-800">Summary (1 sentence)</div>
              <input
                className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base"
                value={newSummary}
                onChange={(e) => setNewSummary(e.target.value)}
                placeholder="What is this doc for?"
              />
            </label>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block">
                <div className="text-sm font-semibold text-zinc-800">Status</div>
                <select
                  className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base"
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
                  className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base"
                  value={newVersion}
                  onChange={(e) => setNewVersion(e.target.value)}
                  placeholder="YYYY-MM-DD"
                />
              </label>
            </div>
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
            Pick a file, then use the buttons to publish, unpublish, finalize, or delete it.
          </p>

          <label className="mt-4 block">
            <div className="text-sm font-semibold text-zinc-800">Choose a document</div>
            <select
              className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base"
              value={selectedFile}
              onChange={(e) => setSelectedFile(e.target.value)}
              disabled={!dirHandle || busy}
            >
              <option value="">{dirHandle ? "Select..." : "Connect folder first"}</option>
              {docs.map((d) => (
                <option key={d.fileName} value={d.fileName}>
                  {d.slug} v{d.version} {d.archived ? "(unpublished)" : ""}
                </option>
              ))}
            </select>
          </label>

          {selected ? (
            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`chip ${stageBadgeClass(selected.stage)}`}>{selected.stage}</span>
                {selected.archived ? <span className="chip bg-amber-100 text-amber-900">unpublished</span> : <span className="chip chip-muted">published</span>}
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
                      className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                    />
                  </label>

                  <label className="block">
                    <div className="text-sm font-semibold text-zinc-800">Summary</div>
                    <input
                      className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base"
                      value={editSummary}
                      onChange={(e) => setEditSummary(e.target.value)}
                    />
                  </label>

                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="block">
                      <div className="text-sm font-semibold text-zinc-800">Status</div>
                      <select
                        className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base"
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
                        className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base"
                        value={editArchived ? "no" : "yes"}
                        onChange={(e) => setEditArchived(e.target.value !== "yes")}
                      >
                        <option value="yes">Yes (published)</option>
                        <option value="no">No (unpublished)</option>
                      </select>
                    </label>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="block">
                      <div className="text-sm font-semibold text-zinc-800">Updated date</div>
                      <input
                        className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base"
                        value={editUpdatedAt}
                        onChange={(e) => setEditUpdatedAt(e.target.value)}
                        placeholder="YYYY-MM-DD"
                      />
                    </label>
                    <label className="block">
                      <div className="text-sm font-semibold text-zinc-800">Last reviewed date (official)</div>
                      <input
                        className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base"
                        value={editLastReviewedAt}
                        onChange={(e) => setEditLastReviewedAt(e.target.value)}
                        placeholder="YYYY-MM-DD"
                      />
                    </label>
                  </div>

                  <label className="block">
                    <div className="text-sm font-semibold text-zinc-800">Owners (comma separated)</div>
                    <input
                      className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base"
                      value={editOwners}
                      onChange={(e) => setEditOwners(e.target.value)}
                      placeholder="Example: Docs Maintainer, Protocol Lead"
                    />
                  </label>

                  <label className="block">
                    <div className="text-sm font-semibold text-zinc-800">Topics (comma separated)</div>
                    <input
                      className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base"
                      value={editTopics}
                      onChange={(e) => setEditTopics(e.target.value)}
                      placeholder="Example: process, governance"
                    />
                  </label>

                  <label className="block">
                    <div className="text-sm font-semibold text-zinc-800">Markdown</div>
                    <textarea
                      className="mt-2 h-56 w-full rounded-xl border border-zinc-200 bg-white p-4 font-mono text-sm text-zinc-900"
                      value={editMarkdown}
                      onChange={(e) => setEditMarkdown(e.target.value)}
                      spellCheck={false}
                    />
                  </label>

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
    </main>
  );
}
