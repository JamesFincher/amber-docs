import Link from "next/link";

const features = [
  {
    title: "Markdown by default",
    description: "All docs are rendered from markdown so content is copy/paste friendly for AI workflows.",
  },
  {
    title: "Lifecycle states",
    description: "Track docs as Draft, Final, and Official with clear publishing intent.",
  },
  {
    title: "Template-driven writing",
    description: "Use reusable templates to generate uniform prompts and consistent document shapes.",
  },
  {
    title: "Search + anchors",
    description: "Search across docs, deep-link sections with stable anchors, and copy raw markdown.",
  },
  {
    title: "Quality signals",
    description: "Surface owners, last reviewed dates, and citations hints for trust and freshness.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-10 px-6 py-12">
      <header className="space-y-4">
        <p className="text-sm font-medium uppercase tracking-wider text-zinc-500">Amber Protocol</p>
        <h1 className="text-4xl font-semibold tracking-tight">AI-native documentation workspace</h1>
        <p className="max-w-2xl text-zinc-600">
          A simple docs hub for drafting, reviewing, and publishing company documentation that is readable
          by humans and AI systems.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/docs"
            className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          >
            Browse docs
          </Link>
          <Link
            href="/templates"
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 transition hover:bg-zinc-100"
          >
            Open template tool
          </Link>
          <Link
            href="/blocks"
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 transition hover:bg-zinc-100"
          >
            Browse blocks
          </Link>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        {features.map((feature) => (
          <div key={feature.title} className="rounded-xl border border-zinc-200 p-5">
            <h2 className="mb-2 text-lg font-semibold">{feature.title}</h2>
            <p className="text-sm text-zinc-600">{feature.description}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
