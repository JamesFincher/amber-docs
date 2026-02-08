import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-black/10 bg-white/50 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-3">
        <div className="flex items-center gap-3">
          <Link href="/" className="font-display text-lg font-semibold tracking-tight text-zinc-950">
            Amber Docs
          </Link>
          <span className="chip chip-muted hidden sm:inline-flex">AI-native</span>
        </div>

        <form action="/docs" method="get" className="order-3 w-full sm:order-none sm:w-auto">
          <div className="flex items-center gap-2">
            <input
              name="q"
              placeholder="Search docs..."
              className="w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10 sm:w-72"
            />
            <button type="submit" className="btn btn-primary">
              Search
            </button>
          </div>
        </form>

        <nav className="flex flex-wrap items-center gap-2 text-sm">
          <Link href="/docs" className="btn btn-secondary">
            Docs
          </Link>
          <Link href="/paths" className="btn btn-secondary">
            Paths
          </Link>
          <Link href="/templates" className="btn btn-secondary">
            Templates
          </Link>
          <Link href="/blocks" className="btn btn-secondary">
            Blocks
          </Link>
        </nav>
      </div>
    </header>
  );
}

