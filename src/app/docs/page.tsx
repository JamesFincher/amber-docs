import Link from "next/link";
import { listLatestDocs } from "@/lib/content/docs.server";
import { DocsLibraryClient } from "./DocsLibraryClient";

export const metadata = {
  title: "Docs | Amber Protocol",
  description: "Browse draft, final, and official documentation",
};

export default function DocsIndexPage({
  searchParams,
}: {
  searchParams?: {
    q?: string;
    stage?: string;
    topic?: string;
    collection?: string;
    bookmarked?: string;
  };
}) {
  const docs = listLatestDocs().map((d) => ({
    slug: d.slug,
    title: d.title,
    stage: d.stage,
    updatedAt: d.updatedAt,
    lastReviewedAt: d.lastReviewedAt,
    owners: d.owners,
    topics: d.topics,
    collection: d.collection ?? null,
    summary: d.summary,
  }));

  const stageParam = searchParams?.stage;
  const stage: "all" | "draft" | "final" | "official" =
    stageParam === "draft" || stageParam === "final" || stageParam === "official" ? stageParam : "all";

  const initial = {
    q: searchParams?.q ?? "",
    stage,
    topic: searchParams?.topic ?? "all",
    collection: searchParams?.collection ?? "all",
    bookmarkedOnly: searchParams?.bookmarked === "1",
  };
  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <header className="mb-8 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Docs library</p>
            <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">Documentation</h1>
          </div>
          <nav className="flex flex-wrap gap-2 text-sm">
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
        <p className="max-w-3xl text-zinc-600">
          Search across titles, headings, and body text. Filter by stage and topic, then open a doc to
          view AI checks, related context, and version history.
        </p>
      </header>

      <DocsLibraryClient docs={docs} initial={initial} />
    </main>
  );
}
