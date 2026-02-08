import Link from "next/link";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/Markdown";
import { docs, getDocBySlug, stageBadgeClass } from "@/lib/docs";

export function generateStaticParams() {
  return docs.map((doc) => ({ slug: doc.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const doc = getDocBySlug(slug);
  if (!doc) {
    return { title: "Doc Not Found | Amber Protocol" };
  }
  return {
    title: `${doc.title} | Amber Protocol`,
    description: doc.summary,
  };
}

export default function DocDetailPage({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const doc = getDocBySlug(slug);
  if (!doc) notFound();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-6 py-12">
      <Link href="/docs" className="text-sm text-zinc-500 underline">
        ← Back to all docs
      </Link>

      <header className="space-y-3">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-semibold">{doc.title}</h1>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${stageBadgeClass(doc.stage)}`}>
            {doc.stage}
          </span>
        </div>
        <p className="text-zinc-600">{doc.summary}</p>
        <p className="text-xs text-zinc-500">Updated: {doc.updatedAt}</p>
      </header>

      <section className="grid gap-5 md:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 p-5">
          <h2 className="mb-2 text-lg font-semibold">AI checks</h2>
          <ul className="list-disc space-y-1 pl-5 text-zinc-700">
            {doc.aiChecks.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-zinc-200 p-5">
          <h2 className="mb-2 text-lg font-semibold">Related context</h2>
          <ul className="list-disc space-y-1 pl-5 text-zinc-700">
            {doc.relatedContext.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>

      <article className="rounded-xl border border-zinc-200 p-6">
        <Markdown value={doc.markdown} />
      </article>
    </main>
  );
}
