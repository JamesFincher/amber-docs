"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { DocRecord, DocStage } from "@/lib/docs";
import { docsTopics, hasCitations, needsReview, stageBadgeClass } from "@/lib/docs";
import { toSearchText } from "@/lib/markdown";

function uniq<T>(xs: T[]): T[] {
  return Array.from(new Set(xs));
}

function highlight(text: string, q: string) {
  const query = q.trim();
  if (!query) return text;
  const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")})`, "ig");
  const parts = text.split(re);
  // split() with a capture group keeps matches at odd indexes.
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <mark key={i} className="rounded bg-amber-100 px-1 py-0.5">
        {part}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

type StageFilter = DocStage | "all";

export function DocsLibraryClient({ docs }: { docs: DocRecord[] }) {
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<StageFilter>("all");
  const [topic, setTopic] = useState<string>("all");

  const topics = useMemo(() => {
    const all = docs.flatMap((d) => docsTopics(d));
    return ["all", ...uniq(all).sort((a, b) => a.localeCompare(b))];
  }, [docs]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return docs
      .filter((d) => (stage === "all" ? true : d.stage === stage))
      .filter((d) => (topic === "all" ? true : docsTopics(d).includes(topic)))
      .filter((d) => {
        if (!q) return true;
        const hay = `${d.title} ${d.summary} ${toSearchText(d.markdown)}`.toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
  }, [docs, query, stage, topic]);

  return (
    <div className="space-y-5">
      <section className="grid gap-3 rounded-xl border border-zinc-200 bg-white/60 p-4 backdrop-blur md:grid-cols-3">
        <label className="block">
          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Search</div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search docs..."
            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-900/10"
          />
        </label>
        <label className="block">
          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Stage</div>
          <select
            value={stage}
            onChange={(e) => setStage(e.target.value as StageFilter)}
            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
          >
            <option value="all">All</option>
            <option value="official">Official</option>
            <option value="final">Final</option>
            <option value="draft">Draft</option>
          </select>
        </label>
        <label className="block">
          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Topic</div>
          <select
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
          >
            {topics.map((t) => (
              <option key={t} value={t}>
                {t === "all" ? "All" : t}
              </option>
            ))}
          </select>
        </label>
      </section>

      <div className="text-xs text-zinc-500">
        Showing {results.length} of {docs.length}
      </div>

      <div className="grid gap-4">
        {results.map((doc) => {
          const owners = doc.owners?.length ? doc.owners.join(", ") : "Unowned";
          const reviewed = doc.lastReviewedAt ?? "Not reviewed";
          const reviewFlag = needsReview(doc) ? "Needs review" : null;
          const citationsFlag = hasCitations(doc) ? "Citations" : null;

          return (
            <Link
              key={doc.slug}
              href={`/docs/${doc.slug}`}
              className="rounded-xl border border-zinc-200 bg-white/60 p-5 transition hover:border-zinc-400 hover:bg-white"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-semibold">{highlight(doc.title, query)}</h2>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className={`rounded-full px-3 py-1 font-medium ${stageBadgeClass(doc.stage)}`}>
                    {doc.stage}
                  </span>
                  {reviewFlag ? (
                    <span className="rounded-full bg-amber-100 px-3 py-1 font-medium text-amber-800">
                      {reviewFlag}
                    </span>
                  ) : null}
                  {citationsFlag ? (
                    <span className="rounded-full bg-zinc-100 px-3 py-1 font-medium text-zinc-700">
                      {citationsFlag}
                    </span>
                  ) : null}
                </div>
              </div>
              <p className="mb-3 text-zinc-700">{highlight(doc.summary, query)}</p>
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-zinc-500">
                <div>Updated: {doc.updatedAt}</div>
                <div>Reviewed: {reviewed}</div>
                <div>Owners: {owners}</div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
