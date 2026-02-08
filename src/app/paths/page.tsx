import Link from "next/link";
import { listCollections } from "@/lib/content/docs.server";
import { stageBadgeClass } from "@/lib/docs";

export const metadata = {
  title: "Reading lists | Amber Docs",
  description: "Recommended reading lists that group documents in a useful order.",
};

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export default function PathsPage() {
  const collections = listCollections();

  return (
    <main className="page max-w-6xl">
      <header className="mb-8 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-zinc-700">Reading lists</p>
            <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">Follow a reading list</h1>
          </div>
          <nav className="flex flex-wrap gap-2">
            <Link href="/docs" className="btn btn-secondary">
              Documents
            </Link>
            <Link href="/assistant" className="btn btn-secondary">
              Ask AI
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
          Reading lists group documents into an easy order. When you open a document from a list, you will see{" "}
          <span className="font-semibold">Prev</span> and <span className="font-semibold">Next</span> buttons to keep going.
        </p>
      </header>

      <div className="grid gap-6">
        {collections.map((c) => (
          <section key={c.name} className="card p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl font-semibold">{c.name}</h2>
                <div className="mt-1 text-zinc-700">{c.docs.length} documents</div>
              </div>
              <Link href={`/paths/${encodeURIComponent(slugify(c.name))}`} className="btn btn-secondary">
                Open list
              </Link>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {c.docs.map((d) => (
                <Link
                  key={d.slug}
                  href={`/docs/${encodeURIComponent(d.slug)}`}
                  className="rounded-2xl border border-zinc-200 bg-white p-5 hover:bg-zinc-50"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold text-zinc-900">{d.title}</div>
                    <span className={`chip ${stageBadgeClass(d.stage)}`}>{d.stage}</span>
                  </div>
                  <div className="mt-1 text-sm text-zinc-600">{d.summary}</div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
