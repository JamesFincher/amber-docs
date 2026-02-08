import Link from "next/link";
import { listCollections, listLatestDocs } from "@/lib/content/docs.server";
import { stageBadgeClass } from "@/lib/docs";

const featureCards = [
  {
    title: "Versioned docs",
    body: "Keep a stable latest alias while preserving historical versions and diffs.",
  },
  {
    title: "Search that scales",
    body: "Build-time index with fuzzy matching, filters, synonyms, bookmarks, and saved searches.",
  },
  {
    title: "Trust automation",
    body: "Frontmatter schema + CI gates for Official: owners, review dates, approvals, citations, links.",
  },
  {
    title: "Writer tools",
    body: "Templates generate prompts + scaffolds + section packs; blocks library standardizes language.",
  },
  {
    title: "Integrator exports",
    body: "docs.json, search-index.json, chunks.json, embeddings manifest, updates feed.",
  },
  {
    title: "Static by default",
    body: "Exportable Next.js app designed for Cloudflare Pages and offline-friendly browsing.",
  },
];

export default function Home() {
  const latest = listLatestDocs().slice(0, 6);
  const collections = listCollections().slice(0, 6);

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-12">
      <section className="grid gap-10 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/60 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-600 backdrop-blur">
            Amber Protocol
            <span className="chip chip-muted">Docs platform</span>
          </div>
          <h1 className="mt-5 font-display text-6xl font-semibold tracking-tight text-zinc-950">
            Documentation that’s readable by humans and usable by AI
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-zinc-700">
            Amber Docs is a docs-first operating system for drafting, reviewing, and publishing company
            knowledge with versioning, trust signals, and integrator-ready exports.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/docs" className="btn btn-primary">
              Browse docs
            </Link>
            <Link href="/paths" className="btn btn-secondary">
              Explore paths
            </Link>
            <Link href="/templates" className="btn btn-secondary">
              Open template tool
            </Link>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="card p-5">
              <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Index</div>
              <div className="mt-2 font-display text-3xl font-semibold">{latest.length}</div>
              <div className="mt-1 text-sm text-zinc-600">Latest docs</div>
            </div>
            <div className="card p-5">
              <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Paths</div>
              <div className="mt-2 font-display text-3xl font-semibold">{collections.length}</div>
              <div className="mt-1 text-sm text-zinc-600">Collections</div>
            </div>
            <div className="card p-5">
              <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Exports</div>
              <div className="mt-2 font-display text-3xl font-semibold">5</div>
              <div className="mt-1 text-sm text-zinc-600">Machine endpoints</div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="card p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-2xl font-semibold">Quick links</h2>
              <Link href="/docs.json" className="btn btn-secondary">
                docs.json
              </Link>
            </div>
            <div className="mt-4 grid gap-3">
              <a href="/search-index.json" className="rounded-2xl border border-black/10 bg-white/70 p-4 backdrop-blur hover:bg-white">
                <div className="font-semibold text-zinc-900">Search index</div>
                <div className="mt-1 text-sm text-zinc-600">Build-time index used by the docs library UI.</div>
              </a>
              <a href="/chunks.json" className="rounded-2xl border border-black/10 bg-white/70 p-4 backdrop-blur hover:bg-white">
                <div className="font-semibold text-zinc-900">RAG chunks</div>
                <div className="mt-1 text-sm text-zinc-600">Chunked export with stable chunk IDs.</div>
              </a>
              <a href="/embeddings-manifest.json" className="rounded-2xl border border-black/10 bg-white/70 p-4 backdrop-blur hover:bg-white">
                <div className="font-semibold text-zinc-900">Embeddings manifest</div>
                <div className="mt-1 text-sm text-zinc-600">Content hashes for syncing embedding pipelines.</div>
              </a>
              <a href="/updates.json" className="rounded-2xl border border-black/10 bg-white/70 p-4 backdrop-blur hover:bg-white">
                <div className="font-semibold text-zinc-900">Updates feed</div>
                <div className="mt-1 text-sm text-zinc-600">Pollable build ID + latest doc hashes.</div>
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Capabilities</p>
            <h2 className="mt-1 font-display text-3xl font-semibold">What’s built in</h2>
          </div>
          <Link href="/docs" className="btn btn-secondary">
            Browse docs
          </Link>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {featureCards.map((f) => (
            <div key={f.title} className="card p-6">
              <div className="font-display text-xl font-semibold">{f.title}</div>
              <div className="mt-2 text-sm text-zinc-700">{f.body}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-14 grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Latest</p>
              <h2 className="mt-1 font-display text-3xl font-semibold">Docs</h2>
            </div>
            <Link href="/docs" className="btn btn-secondary">
              View all
            </Link>
          </div>
          <div className="mt-6 grid gap-3">
            {latest.map((d) => (
              <Link key={d.slug} href={`/docs/${encodeURIComponent(d.slug)}`} className="card p-5 hover:translate-y-[-1px]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-zinc-900">{d.title}</div>
                    <div className="mt-1 text-sm text-zinc-600">{d.summary}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`chip ${stageBadgeClass(d.stage)}`}>{d.stage}</span>
                    <span className="chip chip-muted">{d.updatedAt}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="lg:col-span-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Paths</p>
              <h2 className="mt-1 font-display text-3xl font-semibold">Reading order</h2>
            </div>
            <Link href="/paths" className="btn btn-secondary">
              View all
            </Link>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {collections.map((c) => (
              <Link
                key={c.name}
                href={`/paths/${encodeURIComponent(c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"))}`}
                className="card p-6 hover:translate-y-[-1px]"
              >
                <div className="font-display text-xl font-semibold">{c.name}</div>
                <div className="mt-2 text-sm text-zinc-600">{c.docs.length} docs</div>
                <div className="mt-3 text-xs text-zinc-500">
                  {c.docs
                    .slice(0, 3)
                    .map((d) => d.title)
                    .join(" · ")}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
