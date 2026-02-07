import Link from "next/link";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/Markdown";
import { getOfficialDocBySlug } from "@/lib/convexPublic";

export default async function DocPage({ params }: { params: { slug: string } }) {
  const { slug } = params;

  const doc = await getOfficialDocBySlug(slug);
  if (!doc) notFound();

  return (
    <div className="min-h-screen px-6 py-10">
      <header className="mx-auto max-w-5xl">
        <nav className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Link
              href="/docs"
              className="rounded-md border border-black/10 bg-white/60 px-3 py-1.5 font-medium text-zinc-900 shadow-sm backdrop-blur hover:bg-white"
            >
              Docs
            </Link>
            <Link
              href="/"
              className="text-xs font-medium text-zinc-700 underline decoration-black/20 underline-offset-4 hover:text-zinc-900 hover:decoration-black/40"
            >
              Home
            </Link>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Link
              href={`/raw/${encodeURIComponent(slug)}`}
              className="rounded-md border border-black/10 bg-white/60 px-3 py-1.5 font-medium text-zinc-900 shadow-sm backdrop-blur hover:bg-white"
            >
              Raw Markdown
            </Link>
            <Link
              href="/admin"
              className="rounded-md border border-black/10 bg-zinc-950 px-3 py-1.5 font-medium text-zinc-50 shadow-sm hover:bg-zinc-900"
            >
              Admin
            </Link>
          </div>
        </nav>

        <div className="mt-6">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">{doc.title}</h1>
          <p className="mt-2 text-sm text-zinc-700">
            {doc.slug} · v{doc.revisionNumber ?? "—"}
          </p>
        </div>
      </header>

      <main className="mx-auto mt-8 max-w-5xl">
        <article className="rounded-2xl border border-black/10 bg-white/60 p-6 shadow-sm backdrop-blur">
          <Markdown value={doc.markdown} />
        </article>
      </main>
    </div>
  );
}
