import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-black/10 bg-white/40 py-10 backdrop-blur">
      <div className="mx-auto grid w-full max-w-7xl gap-6 px-6 md:grid-cols-3">
        <div>
          <div className="font-display text-lg font-semibold">Amber Docs</div>
          <p className="mt-2 text-sm text-zinc-600">
            A simple documentation hub with search, reading lists, templates, and reusable text blocks.
          </p>
        </div>
        <div className="grid gap-2 text-sm">
          <div className="text-sm font-semibold text-zinc-700">Pages</div>
          <Link href="/docs" className="underline decoration-black/10 underline-offset-4 hover:decoration-black/30">
            Documents
          </Link>
          <Link href="/paths" className="underline decoration-black/10 underline-offset-4 hover:decoration-black/30">
            Reading lists
          </Link>
          <Link href="/assistant" className="underline decoration-black/10 underline-offset-4 hover:decoration-black/30">
            Ask AI
          </Link>
          <Link href="/templates" className="underline decoration-black/10 underline-offset-4 hover:decoration-black/30">
            Templates
          </Link>
          <Link href="/blocks" className="underline decoration-black/10 underline-offset-4 hover:decoration-black/30">
            Reusable text
          </Link>
          <Link href="/help" className="underline decoration-black/10 underline-offset-4 hover:decoration-black/30">
            Help
          </Link>
        </div>
        <div className="grid gap-2 text-sm">
          <div className="text-sm font-semibold text-zinc-700">Advanced exports</div>
          <Link href="/docs.json" className="underline decoration-black/10 underline-offset-4 hover:decoration-black/30">
            docs.json
          </Link>
          <Link href="/search-index.json" className="underline decoration-black/10 underline-offset-4 hover:decoration-black/30">
            search-index.json
          </Link>
          <Link href="/chunks.json" className="underline decoration-black/10 underline-offset-4 hover:decoration-black/30">
            chunks.json
          </Link>
          <Link
            href="/embeddings-manifest.json"
            className="underline decoration-black/10 underline-offset-4 hover:decoration-black/30"
          >
            embeddings-manifest.json
          </Link>
          <Link href="/updates.json" className="underline decoration-black/10 underline-offset-4 hover:decoration-black/30">
            updates.json
          </Link>
        </div>
      </div>
    </footer>
  );
}
