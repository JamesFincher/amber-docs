"use client";

import Fuse from "fuse.js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { DocStage } from "@/lib/docs";
import { needsReview, stageBadgeClass } from "@/lib/docs";

type IndexDoc = {
  slug: string;
  version: string;
  title: string;
  stage: DocStage;
  summary: string;
  updatedAt: string;
  lastReviewedAt: string | null;
  owners: string[];
  topics: string[];
  collection: string | null;
  order: number | null;
  headings: string[];
  searchText: string;
  contentHash: string;
  citationsCount: number;
  versionsCount: number;
  url: string;
  _score?: number;
};

type SynonymsMap = Record<string, string[]>;

type SavedSearch = {
  id: string;
  name: string;
  q: string;
  stage: StageFilter;
  topic: string;
  collection: string;
  bookmarkedOnly: boolean;
};

type StageFilter = DocStage | "all";

type InitialState = {
  q?: string;
  stage?: StageFilter;
  topic?: string;
  collection?: string;
  bookmarkedOnly?: boolean;
};

const BOOKMARKS_KEY = "amber-docs:bookmarks:v1";
const SAVED_SEARCHES_KEY = "amber-docs:saved-searches:v1";

function uniq(xs: string[]): string[] {
  return Array.from(new Set(xs));
}

function readBookmarks(): Set<string> {
  try {
    const raw = localStorage.getItem(BOOKMARKS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x) => typeof x === "string") as string[]);
  } catch {
    return new Set();
  }
}

function writeBookmarks(bm: Set<string>) {
  localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(Array.from(bm.values()).sort()));
}

function readSavedSearches(): SavedSearch[] {
  try {
    const raw = localStorage.getItem(SAVED_SEARCHES_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr
      .map((x) => x as Partial<SavedSearch>)
      .filter((x) => typeof x.id === "string" && typeof x.name === "string")
      .map((x) => ({
        id: x.id!,
        name: x.name!,
        q: typeof x.q === "string" ? x.q : "",
        stage: (x.stage as StageFilter) ?? "all",
        topic: typeof x.topic === "string" ? x.topic : "all",
        collection: typeof x.collection === "string" ? x.collection : "all",
        bookmarkedOnly: Boolean(x.bookmarkedOnly),
      }));
  } catch {
    return [];
  }
}

function writeSavedSearches(xs: SavedSearch[]) {
  localStorage.setItem(SAVED_SEARCHES_KEY, JSON.stringify(xs, null, 2));
}

function highlightSimple(text: string, q: string) {
  const query = q.trim();
  if (!query) return text;
  const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")})`, "ig");
  const parts = text.split(re);
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

function expandQuery(q: string, synonyms: SynonymsMap) {
  const tokens = q
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const extra: string[] = [];
  for (const t of tokens) {
    const syns = synonyms[t];
    if (syns?.length) extra.push(...syns);
  }
  return uniq([...tokens, ...extra]).join(" ");
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function DocsLibraryClient({
  docs,
  initial,
}: {
  docs: Array<{
    slug: string;
    title: string;
    stage: DocStage;
    updatedAt: string;
    summary: string;
    lastReviewedAt?: string;
    owners: string[];
    topics: string[];
    collection?: string | null;
  }>;
  initial?: InitialState;
}) {
  const router = useRouter();
  const pathname = "/docs";

  const [index, setIndex] = useState<IndexDoc[] | null>(null);
  const [synonyms, setSynonyms] = useState<SynonymsMap>({});
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);

  const [query, setQuery] = useState(initial?.q ?? "");
  const [stage, setStage] = useState<StageFilter>(initial?.stage ?? "all");
  const [topic, setTopic] = useState<string>(initial?.topic ?? "all");
  const [collection, setCollection] = useState<string>(initial?.collection ?? "all");
  const [bookmarkedOnly, setBookmarkedOnly] = useState<boolean>(initial?.bookmarkedOnly ?? false);

  useEffect(() => {
    setBookmarks(readBookmarks());
    setSavedSearches(readSavedSearches());
    void (async () => {
      const [idx, syn] = await Promise.all([
        fetchJson<IndexDoc[]>("/search-index.json"),
        fetchJson<SynonymsMap>("/synonyms.json"),
      ]);
      if (idx) setIndex(idx);
      if (syn) setSynonyms(syn);
    })();
  }, []);

  // Keep URL in sync for shareable searches.
  useEffect(() => {
    const sp = new URLSearchParams();
    if (query.trim()) sp.set("q", query.trim());
    if (stage !== "all") sp.set("stage", stage);
    if (topic !== "all") sp.set("topic", topic);
    if (collection !== "all") sp.set("collection", collection);
    if (bookmarkedOnly) sp.set("bookmarked", "1");
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }, [query, stage, topic, collection, bookmarkedOnly, pathname, router]);

  const base = index ?? docs.map((d) => ({
    slug: d.slug,
    version: "",
    title: d.title,
    stage: d.stage,
    summary: d.summary,
    updatedAt: d.updatedAt,
    lastReviewedAt: d.lastReviewedAt ?? null,
    owners: d.owners ?? [],
    topics: d.topics ?? [],
    collection: d.collection ?? null,
    order: null,
    headings: [],
    searchText: "",
    contentHash: "",
    citationsCount: 0,
    versionsCount: 1,
    url: `/docs/${encodeURIComponent(d.slug)}`,
  }));

  const topics = useMemo(() => {
    const all = base.flatMap((d) => d.topics ?? []);
    return ["all", ...uniq(all).sort((a, b) => a.localeCompare(b))];
  }, [base]);

  const collections = useMemo(() => {
    const all = base
      .map((d) => d.collection)
      .filter((x): x is string => !!x)
      .map((x) => x.trim())
      .filter(Boolean);
    return ["all", ...uniq(all).sort((a, b) => a.localeCompare(b))];
  }, [base]);

  const fuse = useMemo(() => {
    if (!index) return null;
    return new Fuse(index, {
      includeScore: true,
      includeMatches: true,
      threshold: 0.35,
      ignoreLocation: true,
      keys: [
        { name: "title", weight: 2.0 },
        { name: "headings", weight: 1.6 },
        { name: "summary", weight: 1.4 },
        { name: "topics", weight: 1.0 },
        { name: "searchText", weight: 0.7 },
      ],
    });
  }, [index]);

  const results = useMemo(() => {
    const q = query.trim();

    function applyFilters(xs: IndexDoc[]) {
      return xs
        .filter((d) => (stage === "all" ? true : d.stage === stage))
        .filter((d) => (topic === "all" ? true : (d.topics ?? []).includes(topic)))
        .filter((d) => (collection === "all" ? true : (d.collection ?? "") === collection))
        .filter((d) => (bookmarkedOnly ? bookmarks.has(d.slug) : true));
    }

    if (!q) {
      return applyFilters(base).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : a.title.localeCompare(b.title)));
    }

    if (!fuse) {
      const ql = q.toLowerCase();
      return applyFilters(base)
        .filter((d) => `${d.title} ${d.summary} ${d.searchText} ${(d.headings ?? []).join(" ")}`.toLowerCase().includes(ql))
        .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : a.title.localeCompare(b.title)));
    }

    const expanded = expandQuery(q, synonyms);
    const hits = fuse.search(expanded).map((h) => ({ ...h.item, _score: h.score ?? 1 }));
    return applyFilters(hits).sort((a, b) => (a._score! - b._score!));
  }, [base, bookmarks, bookmarkedOnly, collection, fuse, query, stage, synonyms, topic]);

  function toggleBookmark(slug: string) {
    setBookmarks((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      writeBookmarks(next);
      return next;
    });
  }

  function saveCurrentSearch() {
    const trimmed = query.trim();
    const name =
      trimmed || stage !== "all" || topic !== "all" || collection !== "all" || bookmarkedOnly
        ? `Search: ${trimmed || "filters"}`
        : "Search: (empty)";
    const item: SavedSearch = {
      id: `${Date.now()}`,
      name,
      q: trimmed,
      stage,
      topic,
      collection,
      bookmarkedOnly,
    };
    const next = [item, ...savedSearches].slice(0, 20);
    setSavedSearches(next);
    writeSavedSearches(next);
  }

  function applySaved(s: SavedSearch) {
    setQuery(s.q);
    setStage(s.stage);
    setTopic(s.topic);
    setCollection(s.collection);
    setBookmarkedOnly(s.bookmarkedOnly);
  }

  function deleteSaved(id: string) {
    const next = savedSearches.filter((s) => s.id !== id);
    setSavedSearches(next);
    writeSavedSearches(next);
  }

  return (
    <div className="space-y-6">
      <section className="card p-6">
        <div className="grid gap-3 md:grid-cols-5">
          <label className="block md:col-span-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Search</div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search docs..."
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
            />
          </label>

          <label className="block">
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Stage</div>
            <select
              value={stage}
              onChange={(e) => setStage(e.target.value as StageFilter)}
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
            >
              <option value="all">All</option>
              <option value="official">Official</option>
              <option value="final">Final</option>
              <option value="draft">Draft</option>
            </select>
          </label>

          <label className="block">
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Topic</div>
            <select
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
            >
              {topics.map((t) => (
                <option key={t} value={t}>
                  {t === "all" ? "All" : t}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Collection</div>
            <select
              value={collection}
              onChange={(e) => setCollection(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
            >
              {collections.map((c) => (
                <option key={c} value={c}>
                  {c === "all" ? "All" : c}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input type="checkbox" checked={bookmarkedOnly} onChange={(e) => setBookmarkedOnly(e.target.checked)} />
            Bookmarked only
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn btn-secondary" onClick={saveCurrentSearch}>
              Save search
            </button>
            <Link href="/docs.json" className="btn btn-secondary">
              docs.json
            </Link>
          </div>
        </div>
      </section>

      {savedSearches.length ? (
        <section className="card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold">Saved searches</h2>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setSavedSearches([]);
                writeSavedSearches([]);
              }}
            >
              Clear
            </button>
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {savedSearches.map((s) => (
              <div key={s.id} className="rounded-2xl border border-zinc-200 bg-white/70 p-4 backdrop-blur">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-zinc-900">{s.name}</div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {[
                        s.q ? `q="${s.q}"` : null,
                        s.stage !== "all" ? `stage=${s.stage}` : null,
                        s.topic !== "all" ? `topic=${s.topic}` : null,
                        s.collection !== "all" ? `collection=${s.collection}` : null,
                        s.bookmarkedOnly ? "bookmarked=1" : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "Empty"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="btn btn-secondary" onClick={() => applySaved(s)}>
                      Apply
                    </button>
                    <button className="btn btn-secondary" onClick={() => deleteSaved(s.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="text-xs text-zinc-500">
        Showing {results.length} docs{index ? "" : " (index loading...)"}
      </div>

      <div className="grid gap-4">
        {results.map((doc) => {
          const owners = doc.owners?.length ? doc.owners.join(", ") : "Unowned";
          const reviewed = doc.lastReviewedAt ?? "Not reviewed";
          const reviewFlag = needsReview({ lastReviewedAt: doc.lastReviewedAt ?? undefined }) ? "Needs review" : null;
          const isBookmarked = bookmarks.has(doc.slug);

          return (
            <div key={doc.slug} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`chip ${stageBadgeClass(doc.stage)}`}>{doc.stage}</span>
                    {reviewFlag ? <span className="chip bg-amber-100 text-amber-900">{reviewFlag}</span> : null}
                    {doc.citationsCount ? <span className="chip chip-muted">citations</span> : null}
                    {doc.versionsCount > 1 ? <span className="chip chip-muted">{doc.versionsCount} versions</span> : null}
                    {doc.collection ? <span className="chip chip-outline">{doc.collection}</span> : null}
                  </div>

                  <Link href={doc.url} className="mt-2 block text-2xl font-semibold tracking-tight text-zinc-900">
                    {highlightSimple(doc.title, query)}
                  </Link>
                  <p className="mt-2 text-zinc-700">{highlightSimple(doc.summary, query)}</p>

                  <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-zinc-500">
                    <div>Updated: {doc.updatedAt}</div>
                    <div>Reviewed: {reviewed}</div>
                    <div>Owners: {owners}</div>
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  <button
                    className={isBookmarked ? "btn btn-primary" : "btn btn-secondary"}
                    onClick={() => toggleBookmark(doc.slug)}
                    type="button"
                  >
                    {isBookmarked ? "Bookmarked" : "Bookmark"}
                  </button>
                  <Link href={`/docs/${encodeURIComponent(doc.slug)}/diff`} className="btn btn-secondary">
                    Diff
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
