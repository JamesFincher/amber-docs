import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { listCollections } from "@/lib/content/docs.server";
import { stageBadgeClass } from "@/lib/docs";

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function generateStaticParams() {
  return listCollections().map((c) => ({ collection: slugify(c.name) }));
}

export function generateMetadata({ params }: { params: { collection: string } }): Metadata {
  return {
    title: `Reading list | ${params.collection} | Amber Protocol`,
  };
}

export default function PathDetailPage({ params }: { params: { collection: string } }) {
  const collections = listCollections();
  const c = collections.find((x) => slugify(x.name) === params.collection);
  if (!c) notFound();

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <header className="mb-8 space-y-3">
        <nav className="flex flex-wrap gap-2">
          <Link href="/" className="btn btn-secondary">
            Home
          </Link>
          <Link href="/paths" className="btn btn-secondary">
            Reading lists
          </Link>
          <Link href="/docs" className="btn btn-secondary">
            Documents
          </Link>
          <Link href="/help" className="btn btn-secondary">
            Help
          </Link>
        </nav>
        <h1 className="font-display text-4xl font-semibold tracking-tight">{c.name}</h1>
        <p className="max-w-3xl text-zinc-800">
          Recommended reading order. Open the first document, then use <span className="font-semibold">Next</span> on the doc page to keep going.
        </p>
      </header>

      <section className="card p-6">
        <ol className="grid gap-3">
          {c.docs.map((d, idx) => (
            <li key={d.slug} className="rounded-2xl border border-zinc-200 bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-zinc-700">Step {idx + 1}</div>
                  <Link href={`/docs/${encodeURIComponent(d.slug)}`} className="mt-1 block text-xl font-semibold text-zinc-900">
                    {d.title}
                  </Link>
                  <div className="mt-1 text-zinc-700">{d.summary}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`chip ${stageBadgeClass(d.stage)}`}>{d.stage}</span>
                  <Link href={`/docs/${encodeURIComponent(d.slug)}`} className="btn btn-secondary">
                    Open document
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
