import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page max-w-2xl py-16">
      <div className="card p-10">
        <p className="text-sm font-semibold text-zinc-700">404</p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-zinc-950">Not found</h1>
        <p className="mt-3 text-zinc-800">That page doesn’t exist.</p>
        <div className="mt-7 flex flex-wrap items-center gap-2">
          <Link href="/" className="btn btn-secondary">
            Home
          </Link>
          <Link href="/assistant" className="btn btn-secondary">
            Ask AI
          </Link>
          <Link href="/docs" className="btn btn-primary">
            Open Documents
          </Link>
          <Link href="/help" className="btn btn-secondary">
            Help
          </Link>
        </div>
      </div>
    </main>
  );
}
