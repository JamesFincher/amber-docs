import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-16">
      <div className="card p-10">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">404</p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-zinc-950">Not found</h1>
        <p className="mt-3 text-sm text-zinc-700">That page doesn’t exist.</p>
        <div className="mt-7 flex flex-wrap items-center gap-2">
          <Link href="/" className="btn btn-secondary">
            Home
          </Link>
          <Link href="/docs" className="btn btn-primary">
            Browse docs
          </Link>
        </div>
      </div>
    </main>
  );
}
