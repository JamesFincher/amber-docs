import Link from "next/link";
import { CopyButton } from "@/components/CopyButton";
import { disclaimers, glossary } from "@/lib/blocks";

export const metadata = {
  title: "Blocks | Amber Protocol",
  description: "Reusable snippet library (disclaimers, glossary, standard callouts).",
};

export default function BlocksPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-8 px-6 py-12">
      <header className="space-y-3">
        <nav className="flex flex-wrap gap-3 text-sm">
          <Link href="/" className="underline decoration-black/20 underline-offset-4 hover:decoration-black/40">
            Home
          </Link>
          <Link
            href="/docs"
            className="underline decoration-black/20 underline-offset-4 hover:decoration-black/40"
          >
            Docs
          </Link>
          <Link
            href="/templates"
            className="underline decoration-black/20 underline-offset-4 hover:decoration-black/40"
          >
            Templates
          </Link>
        </nav>
        <h1 className="text-3xl font-semibold">Blocks</h1>
        <p className="text-zinc-600">
          Reusable content blocks you can paste into docs or use inside template prompts.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Disclaimers</h2>
        <div className="grid gap-4">
          {disclaimers.map((s) => (
            <div key={s.id} className="rounded-xl border border-zinc-200 bg-white/60 p-5 backdrop-blur">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-zinc-900">{s.title}</div>
                  <div className="mt-2 text-sm text-zinc-700">{s.body}</div>
                </div>
                <CopyButton text={s.body} label="Copy" />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Glossary</h2>
        <div className="grid gap-3">
          {glossary.map((g) => (
            <div key={g.term} className="rounded-xl border border-zinc-200 bg-white/60 p-5 backdrop-blur">
              <div className="font-semibold text-zinc-900">{g.term}</div>
              <div className="mt-2 text-sm text-zinc-700">{g.definition}</div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

