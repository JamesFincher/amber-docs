import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen px-6 py-16">
      <div className="mx-auto max-w-xl rounded-2xl border border-black/10 bg-white/60 p-8 shadow-sm backdrop-blur">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Not found</h1>
        <p className="mt-2 text-sm text-zinc-700">That page doesn’t exist.</p>
        <div className="mt-6 flex items-center gap-2">
          <Link
            href="/"
            className="rounded-md border border-black/10 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50"
          >
            Home
          </Link>
          <Link
            href="/docs"
            className="rounded-md border border-black/10 bg-zinc-950 px-3 py-1.5 text-sm font-medium text-zinc-50 shadow-sm hover:bg-zinc-900"
          >
            Docs
          </Link>
        </div>
      </div>
    </div>
  );
}

