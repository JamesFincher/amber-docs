import Link from "next/link";
import { listOfficialDocs } from "@/lib/convexPublic";

export default async function DocsIndexPage() {
  const docs = await listOfficialDocs().catch(() => []);

  return (
    <div className="min-h-screen px-6 py-10">
      <header className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Docs</h1>
            <p className="mt-2 text-sm text-zinc-700">Official, public documentation.</p>
          </div>
          <nav className="flex items-center gap-2 text-sm">
            <Link
              href="/"
              className="rounded-md border border-black/10 bg-white/60 px-3 py-1.5 font-medium text-zinc-900 shadow-sm backdrop-blur hover:bg-white"
            >
              Home
            </Link>
            <Link
              href="/admin"
              className="rounded-md border border-black/10 bg-zinc-950 px-3 py-1.5 font-medium text-zinc-50 shadow-sm hover:bg-zinc-900"
            >
              Admin
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto mt-8 max-w-5xl">
        <section className="rounded-2xl border border-black/10 bg-white/60 p-5 shadow-sm backdrop-blur">
          <ul className="divide-y divide-black/5">
            {docs.length === 0 ? (
              <li className="py-4 text-sm text-zinc-700">No official docs published yet.</li>
            ) : (
              docs.map((d) => (
                <li key={d.slug} className="flex flex-wrap items-center justify-between gap-4 py-4">
                  <div className="min-w-0">
                    <Link
                      href={`/docs/${encodeURIComponent(d.slug)}`}
                      className="font-medium text-zinc-950 underline decoration-black/20 underline-offset-4 hover:decoration-black/40"
                    >
                      {d.title}
                    </Link>
                    <div className="mt-1 text-xs text-zinc-600">{d.slug}</div>
                  </div>
                  <div className="text-xs text-zinc-600">v{d.revisionNumber ?? "—"}</div>
                </li>
              ))
            )}
          </ul>
        </section>
      </main>
    </div>
  );
}

