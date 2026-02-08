import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-black/10 py-10">
      <div className="mx-auto grid w-full max-w-7xl gap-6 px-6 md:grid-cols-3">
        <div>
          <div className="font-display text-lg font-semibold">Amber Docs</div>
          <p className="mt-2 text-sm text-zinc-600">
            Static, AI-native documentation hub with versioned exports for integrators.
          </p>
        </div>
        <div className="grid gap-2 text-sm">
          <Link href="/docs" className="underline decoration-black/10 underline-offset-4 hover:decoration-black/30">
            Docs
          </Link>
          <Link href="/paths" className="underline decoration-black/10 underline-offset-4 hover:decoration-black/30">
            Paths
          </Link>
          <Link href="/templates" className="underline decoration-black/10 underline-offset-4 hover:decoration-black/30">
            Templates
          </Link>
          <Link href="/blocks" className="underline decoration-black/10 underline-offset-4 hover:decoration-black/30">
            Blocks
          </Link>
        </div>
        <div className="grid gap-2 text-sm">
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

