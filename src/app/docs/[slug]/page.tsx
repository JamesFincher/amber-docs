import Link from "next/link";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/Markdown";
import { Toc } from "@/components/Toc";
import { CopyButton } from "@/components/CopyButton";
import { AiPromptPack } from "@/components/AiPromptPack";
import { extractToc } from "@/lib/markdown";
import type { DocRecord } from "@/lib/docs";
import { docs, getDocBySlug, hasCitations, needsReview, stageBadgeClass } from "@/lib/docs";

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

  const toc = extractToc(doc.markdown);
  const related =
    (doc.relatedSlugs ?? [])
      .map((s) => getDocBySlug(s))
      .filter((d): d is DocRecord => !!d) ?? [];

  const owners = doc.owners?.length ? doc.owners.join(", ") : "Unowned";
  const reviewed = doc.lastReviewedAt ?? "Not reviewed";
  const topics = doc.topics ?? [];
  const reviewFlag = needsReview(doc) ? "Needs review" : null;
  const citationsFlag = hasCitations(doc) ? "Citations present" : null;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-6 py-12">
      <nav className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/docs" className="text-zinc-500 underline decoration-black/10 underline-offset-4">
            ← Docs
          </Link>
          <Link href="/" className="text-zinc-500 underline decoration-black/10 underline-offset-4">
            Home
          </Link>
          <Link href="/templates" className="text-zinc-500 underline decoration-black/10 underline-offset-4">
            Templates
          </Link>
          <Link href="/blocks" className="text-zinc-500 underline decoration-black/10 underline-offset-4">
            Blocks
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/raw/${encodeURIComponent(doc.slug)}`}
            className="rounded-md border border-zinc-200 bg-white/60 px-2.5 py-1.5 text-xs font-medium text-zinc-700 shadow-sm backdrop-blur hover:bg-white"
          >
            View raw
          </Link>
          <CopyButton text={doc.markdown} label="Copy raw" />
        </div>
      </nav>

      <header className="space-y-3">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-semibold">{doc.title}</h1>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${stageBadgeClass(doc.stage)}`}>
            {doc.stage}
          </span>
          {reviewFlag ? (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
              {reviewFlag}
            </span>
          ) : null}
          {citationsFlag ? (
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
              {citationsFlag}
            </span>
          ) : null}
        </div>
        <p className="text-zinc-600">{doc.summary}</p>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-zinc-500">
          <div>Updated: {doc.updatedAt}</div>
          <div>Reviewed: {reviewed}</div>
          <div>Owners: {owners}</div>
        </div>
        {topics.length ? (
          <div className="flex flex-wrap gap-2">
            {topics.map((t) => (
              <span
                key={t}
                className="rounded-full border border-zinc-200 bg-white/60 px-3 py-1 text-xs font-medium text-zinc-700 backdrop-blur"
              >
                {t}
              </span>
            ))}
          </div>
        ) : null}
      </header>

      <section className="grid gap-5 md:grid-cols-3">
        <div className="md:col-span-1">
          <Toc items={toc} />
        </div>
        <div className="grid gap-5 md:col-span-2 md:grid-cols-2">
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
        </div>
      </section>

      <article className="rounded-xl border border-zinc-200 p-6">
        <Markdown value={doc.markdown} />
      </article>

      <AiPromptPack doc={doc} relatedDocs={related} />

      {related.length ? (
        <section className="rounded-xl border border-zinc-200 bg-white/60 p-6 backdrop-blur">
          <h2 className="mb-3 text-lg font-semibold">Related docs</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {related.map((d) => (
              <Link
                key={d.slug}
                href={`/docs/${encodeURIComponent(d.slug)}`}
                className="rounded-lg border border-zinc-200 bg-white/60 p-4 hover:bg-white"
              >
                <div className="mb-1 font-semibold text-zinc-900">{d.title}</div>
                <div className="text-sm text-zinc-600">{d.summary}</div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
