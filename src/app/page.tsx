import Link from "next/link";
import { listCollections, listLatestDocs } from "@/lib/content/docs.server";
import { stageBadgeClass } from "@/lib/docs";

export default function Home() {
  const latest = listLatestDocs().slice(0, 6);
  const collections = listCollections().slice(0, 6);

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-10">
      <section className="grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-zinc-800">
            Amber Protocol <span className="chip chip-muted">Documentation</span>
          </div>
          <h1 className="mt-5 font-display text-5xl font-semibold tracking-tight text-zinc-950 sm:text-6xl">
            Find what you need. Use it with confidence.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-zinc-800">
            Search documents, follow reading lists, generate new docs from templates, and copy standard
            language. Everything works in a normal web browser.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/docs" className="btn btn-primary">
              Find a document
            </Link>
            <Link href="/studio" className="btn btn-secondary">
              Write + publish
            </Link>
            <Link href="/blocks" className="btn btn-secondary">
              Copy reusable text
            </Link>
          </div>

          <div className="mt-7 card p-6">
            <h2 className="font-display text-2xl font-semibold">New here?</h2>
            <p className="mt-2 text-zinc-800">
              Open the Help page for a simple, click-by-click guide to search, bookmarks, templates, and
              version comparisons.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/help" className="btn btn-primary">
                Open Help
              </Link>
              <Link href="/paths" className="btn btn-secondary">
                Browse reading lists
              </Link>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="card p-6">
            <h2 className="font-display text-2xl font-semibold">Start here</h2>
            <ol className="mt-4 space-y-3 text-zinc-800">
              <li>
                <span className="font-semibold">1.</span> Search for a document, then open it.
              </li>
              <li>
                <span className="font-semibold">2.</span> Click <span className="font-semibold">Bookmark</span> to save it
                for later.
              </li>
              <li>
                <span className="font-semibold">3.</span> Use <span className="font-semibold">Compare versions</span> to see
                what changed.
              </li>
              <li>
                <span className="font-semibold">4.</span> Use <span className="font-semibold">Templates</span> and{" "}
                <span className="font-semibold">Reusable text</span> to write consistently.
              </li>
            </ol>
          </div>

          <details className="mt-6 card p-6">
            <summary className="cursor-pointer text-lg font-semibold text-zinc-900">
              Advanced: Machine-readable exports
            </summary>
            <p className="mt-2 text-zinc-700">
              These endpoints are mainly for integrations and automation. You can ignore them if you just want to read and write docs.
            </p>
            <div className="mt-4 grid gap-3">
              <a href="/docs.json" className="rounded-xl border border-black/10 bg-white p-4 hover:bg-zinc-50">
                <div className="font-semibold text-zinc-900">docs.json</div>
                <div className="mt-1 text-sm text-zinc-700">All doc versions + latest aliases.</div>
              </a>
              <a href="/search-index.json" className="rounded-xl border border-black/10 bg-white p-4 hover:bg-zinc-50">
                <div className="font-semibold text-zinc-900">search-index.json</div>
                <div className="mt-1 text-sm text-zinc-700">Search index used by the Documents page.</div>
              </a>
              <a href="/chunks.json" className="rounded-xl border border-black/10 bg-white p-4 hover:bg-zinc-50">
                <div className="font-semibold text-zinc-900">chunks.json</div>
                <div className="mt-1 text-sm text-zinc-700">Chunked export for RAG workflows.</div>
              </a>
              <a href="/updates.json" className="rounded-xl border border-black/10 bg-white p-4 hover:bg-zinc-50">
                <div className="font-semibold text-zinc-900">updates.json</div>
                <div className="mt-1 text-sm text-zinc-700">Build ID + content hashes for polling.</div>
              </a>
            </div>
          </details>
        </div>
      </section>

      <section className="mt-12 grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-zinc-700">Recently updated</p>
              <h2 className="mt-1 font-display text-3xl font-semibold">Documents</h2>
            </div>
            <Link href="/docs" className="btn btn-secondary">
              View all documents
            </Link>
          </div>
          <div className="mt-5 grid gap-3">
            {latest.map((d) => (
              <Link key={d.slug} href={`/docs/${encodeURIComponent(d.slug)}`} className="card p-5 hover:translate-y-[-1px]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xl font-semibold text-zinc-900">{d.title}</div>
                    <div className="mt-1 text-zinc-700">{d.summary}</div>
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
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-zinc-700">Suggested order</p>
              <h2 className="mt-1 font-display text-3xl font-semibold">Reading lists</h2>
            </div>
            <Link href="/paths" className="btn btn-secondary">
              View all reading lists
            </Link>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {collections.map((c) => (
              <Link
                key={c.name}
                href={`/paths/${encodeURIComponent(c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"))}`}
                className="card p-6 hover:translate-y-[-1px]"
              >
                <div className="font-display text-2xl font-semibold">{c.name}</div>
                <div className="mt-2 text-zinc-700">{c.docs.length} documents</div>
                <div className="mt-3 text-sm text-zinc-600">
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
