"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
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

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function fmtTime(ms: number) {
  return new Date(ms).toLocaleString();
}

function errMsg(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

export function AdminHome() {
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [createBusy, setCreateBusy] = useState(false);

  const statusCount = useMemo(() => {
    const total = docs.length;
    const official = docs.filter((d) => !!d.officialRevisionId && !d.archived).length;
    const drafts = docs.filter((d) => !!d.draftRevisionId && !d.archived).length;
    return { total, official, drafts };
  }, [docs]);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const rows = await adminRpc<DocRow[]>("docs.list");
      setDocs(rows);
    } catch (e: unknown) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function onSeed() {
    setError(null);
    try {
      await adminRpc("seed.ensure");
      await refresh();
    } catch (e: unknown) {
      setError(errMsg(e));
    }
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const s = (slug.trim() || slugify(title)).trim();
    if (!s) return;

    setCreateBusy(true);
    setError(null);
    try {
      await adminRpc("docs.create", { title: title.trim(), slug: s });
      setTitle("");
      setSlug("");
      await refresh();
    } catch (e: unknown) {
      setError(errMsg(e));
    } finally {
      setCreateBusy(false);
    }
  }

  return (
    <div className="min-h-screen px-6 py-10">
      <header className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Admin</h1>
            <p className="mt-2 text-sm text-zinc-700">
              Draft → Final → Official. Notes. Revisions. Prompt packs.
            </p>
          </div>
          <nav className="flex items-center gap-2 text-sm">
            <Link
              href="/"
              className="rounded-md border border-black/10 bg-white/60 px-3 py-1.5 font-medium text-zinc-900 shadow-sm backdrop-blur hover:bg-white"
            >
              Home
            </Link>
            <Link
              href="/docs"
              className="rounded-md border border-black/10 bg-white/60 px-3 py-1.5 font-medium text-zinc-900 shadow-sm backdrop-blur hover:bg-white"
            >
              Public Docs
            </Link>
            <button
              type="button"
              onClick={onSeed}
              className="rounded-md border border-black/10 bg-zinc-950 px-3 py-1.5 font-medium text-zinc-50 shadow-sm hover:bg-zinc-900"
            >
              Seed Template
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto mt-8 grid max-w-6xl grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="rounded-2xl border border-black/10 bg-white/60 p-5 shadow-sm backdrop-blur lg:col-span-1">
          <h2 className="text-sm font-semibold tracking-wide text-zinc-900">Create Doc</h2>
          <form onSubmit={onCreate} className="mt-4 space-y-3">
            <label className="block">
              <div className="text-xs font-medium text-zinc-700">Title</div>
              <input
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (!slug.trim()) setSlug(slugify(e.target.value));
                }}
                className="mt-1 w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none ring-zinc-900/10 focus:ring-2"
                placeholder="Executive Summary"
              />
            </label>
            <label className="block">
              <div className="text-xs font-medium text-zinc-700">Slug</div>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="mt-1 w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none ring-zinc-900/10 focus:ring-2"
                placeholder="executive-summary"
              />
            </label>
            <button
              type="submit"
              disabled={createBusy}
              className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-zinc-950 shadow-sm hover:bg-zinc-50 disabled:opacity-60"
            >
              {createBusy ? "Creating..." : "Create Draft"}
            </button>
          </form>

          <div className="mt-5 rounded-xl border border-black/10 bg-zinc-950/95 p-3 text-xs text-zinc-50">
            <div className="font-semibold">Status</div>
            <div className="mt-1 text-zinc-200">
              {statusCount.total} docs · {statusCount.drafts} active drafts · {statusCount.official} published
            </div>
          </div>

          {error ? (
            <div className="mt-4 rounded-lg border border-red-500/20 bg-red-50 px-3 py-2 text-sm text-red-900">
              {error}
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-black/10 bg-white/60 p-5 shadow-sm backdrop-blur lg:col-span-2">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-sm font-semibold tracking-wide text-zinc-900">Docs</h2>
            <button
              type="button"
              onClick={refresh}
              className="text-xs font-medium text-zinc-700 underline decoration-black/20 underline-offset-4 hover:text-zinc-900 hover:decoration-black/40"
            >
              Refresh
            </button>
          </div>

          {loading ? <div className="mt-4 text-sm text-zinc-700">Loading…</div> : null}

          <ul className="mt-4 divide-y divide-black/5">
            {docs.map((d) => (
              <li key={d._id} className="flex flex-wrap items-center justify-between gap-4 py-4">
                <div className="min-w-0">
                  <Link
                    href={`/admin/${encodeURIComponent(d.slug)}`}
                    className="font-medium text-zinc-950 underline decoration-black/20 underline-offset-4 hover:decoration-black/40"
                  >
                    {d.title}
                  </Link>
                  <div className="mt-1 text-xs text-zinc-600">
                    {d.slug} · updated {fmtTime(d.updatedAt)}
                    {d.archived ? " · archived" : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-700">
                  <span className="rounded-md border border-black/10 bg-white px-2 py-1">
                    D{d.draftRevisionId ? "✓" : "—"}
                  </span>
                  <span className="rounded-md border border-black/10 bg-white px-2 py-1">
                    F{d.finalRevisionId ? "✓" : "—"}
                  </span>
                  <span className="rounded-md border border-black/10 bg-white px-2 py-1">
                    O{d.officialRevisionId ? "✓" : "—"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
