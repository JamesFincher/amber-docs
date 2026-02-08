import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-black/10 bg-white/80 backdrop-blur">
      <div className="mx-auto w-full max-w-7xl px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="font-display text-xl font-semibold tracking-tight text-zinc-950">
              Amber Docs
            </Link>
            <span className="chip chip-muted hidden sm:inline-flex">Simple + searchable</span>
          </div>

          <nav className="flex flex-wrap items-center gap-2">
            <Link href="/docs" className="btn btn-secondary">
              Documents
            </Link>
            <Link href="/paths" className="btn btn-secondary">
              Reading lists
            </Link>
            <Link href="/studio" className="btn btn-secondary">
              Write + publish
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
            <Link href="/help" className="btn btn-primary">
              Help
            </Link>
          </nav>
        </div>

        <form action="/docs" method="get" className="mt-4">
          <label className="block text-sm font-semibold text-zinc-800">
            Search documents
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                name="q"
                aria-label="Search documents"
                type="search"
                enterKeyHint="search"
                autoComplete="off"
                placeholder="Type words here, for example: treasury, runbook, approvals"
                className="control w-full flex-1 sm:min-w-[28rem]"
              />
              <button type="submit" className="btn btn-primary">
                Search
              </button>
            </div>
          </label>
          <div className="mt-2 text-sm text-zinc-600">
            Tip: You can also filter by status, topic, and reading list on the Documents page. Not sure what to search?{" "}
            <Link href="/assistant" className="font-semibold underline decoration-black/10 underline-offset-4 hover:decoration-black/30">
              Ask Amber AI
            </Link>
            .
          </div>
        </form>
      </div>
    </header>
  );
}
