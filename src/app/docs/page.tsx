import Link from "next/link";
import { docs, stageBadgeClass } from "@/lib/docs";

export const metadata = {
  title: "Docs | Amber Protocol",
  description: "Browse draft, final, and official documentation",
};

export default function DocsIndexPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-8 px-6 py-12">
      <header className="space-y-3">
        <nav className="flex flex-wrap gap-3 text-sm">
          <Link href="/" className="underline decoration-black/20 underline-offset-4 hover:decoration-black/40">
            Home
          </Link>
          <Link
            href="/templates"
            className="underline decoration-black/20 underline-offset-4 hover:decoration-black/40"
          >
            Templates
          </Link>
        </nav>
        <h1 className="text-3xl font-semibold">Documentation Library</h1>
        <p className="text-zinc-600">
          Browse docs by lifecycle stage and open each page for markdown content, AI checks, and linked
          context.
        </p>
      </header>

      <div className="grid gap-4">
        {docs.map((doc) => (
          <Link
            key={doc.slug}
            href={`/docs/${doc.slug}`}
            className="rounded-xl border border-zinc-200 p-5 transition hover:border-zinc-400"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">{doc.title}</h2>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${stageBadgeClass(doc.stage)}`}>
                {doc.stage}
              </span>
            </div>
            <p className="mb-2 text-zinc-700">{doc.summary}</p>
            <p className="text-xs text-zinc-500">Updated: {doc.updatedAt}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
