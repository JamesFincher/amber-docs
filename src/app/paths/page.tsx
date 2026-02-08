import Link from "next/link";
import { listCollections } from "@/lib/content/docs.server";
import { stageBadgeClass } from "@/lib/docs";

export const metadata = {
  title: "Paths | Amber Protocol",
  description: "Collections and recommended reading paths across the docs.",
};

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export default function PathsPage() {
  const collections = listCollections();

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <header className="mb-8 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Information architecture</p>
            <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">Paths</h1>
          </div>
          <nav className="flex flex-wrap gap-2 text-sm">
            <Link href="/docs" className="btn btn-secondary">
              Docs
            </Link>
            <Link href="/templates" className="btn btn-secondary">
              Templates
            </Link>
            <Link href="/blocks" className="btn btn-secondary">
              Blocks
            </Link>
          </nav>
        </div>
        <p className="max-w-3xl text-zinc-600">
          Collections group docs into recommended reading paths. Each path is ordered and includes prev/next navigation.
        </p>
      </header>

      <div className="grid gap-6">
        {collections.map((c) => (
          <section key={c.name} className="card p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl font-semibold">{c.name}</h2>
                <div className="mt-1 text-sm text-zinc-600">{c.docs.length} docs</div>
              </div>
              <Link href={`/paths/${encodeURIComponent(slugify(c.name))}`} className="btn btn-secondary">
                View path
              </Link>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {c.docs.map((d) => (
                <Link
                  key={d.slug}
                  href={`/docs/${encodeURIComponent(d.slug)}`}
                  className="rounded-2xl border border-zinc-200 bg-white/70 p-4 backdrop-blur hover:bg-white"
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

