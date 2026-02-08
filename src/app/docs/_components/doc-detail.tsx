import Link from "next/link";
import type { DocRecord } from "@/lib/docs";
import { hasCitations, needsReview, stageBadgeClass } from "@/lib/docs";
import { Markdown } from "@/components/Markdown";
import { Toc } from "@/components/Toc";
import { CopyButton } from "@/components/CopyButton";
import { AiPromptPack } from "@/components/AiPromptPack";
import { BookmarkButton } from "@/components/BookmarkButton";
import { FeedbackWidget } from "@/components/FeedbackWidget";
import { NotesPanel } from "@/components/NotesPanel";
import { VersionSelector } from "./version-selector";

function fmtDate(value: string | undefined) {
  if (!value) return null;
  // Keep display stable and unambiguous for governance.
  return value;
}

export function DocDetail(props: {
  doc: DocRecord;
  versions: DocRecord[];
  relatedDocs: DocRecord[];
  prev: DocRecord | null;
  next: DocRecord | null;
  isLatest: boolean;
}) {
  const { doc } = props;

  const owners = doc.owners.length ? doc.owners.join(", ") : "Unowned";
  const reviewed = doc.lastReviewedAt ? fmtDate(doc.lastReviewedAt) : "Not reviewed";
  const reviewFlag = needsReview(doc) ? "Needs review" : null;
  const citationsFlag = hasCitations(doc) ? "Citations present" : null;
  const visibilityLabel = doc.visibility === "public" ? "Public" : doc.visibility === "internal" ? "Internal" : "Private";

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-10">
      <nav className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-700">
          <Link href="/" className="underline decoration-black/10 underline-offset-4 hover:decoration-black/30">
            Home
          </Link>
          <span className="text-zinc-300">/</span>
          <Link href="/docs" className="underline decoration-black/10 underline-offset-4 hover:decoration-black/30">
            Documents
          </Link>
          {doc.collection ? (
            <>
              <span className="text-zinc-300">/</span>
              <Link
                href={`/paths/${encodeURIComponent(doc.collection.toLowerCase().replace(/[^a-z0-9]+/g, "-"))}`}
                className="underline decoration-black/10 underline-offset-4 hover:decoration-black/30"
              >
                {doc.collection}
              </Link>
            </>
          ) : null}
          <span className="text-zinc-300">/</span>
          <span className="text-zinc-900">{doc.title}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <VersionSelector slug={doc.slug} version={doc.version} versions={props.versions} isLatest={props.isLatest} />
          <Link
            href={`/assistant?doc=${encodeURIComponent(doc.slug)}&version=${encodeURIComponent(doc.version)}`}
            className="btn btn-primary"
          >
            Ask Amber AI
          </Link>
          <Link
            href={`/raw/v/${encodeURIComponent(doc.slug)}/${encodeURIComponent(doc.version)}`}
            className="btn btn-secondary"
          >
            View Markdown
          </Link>
          <CopyButton text={doc.markdown} label="Copy Markdown" />
          <Link href={`/docs/${encodeURIComponent(doc.slug)}/diff`} className="btn btn-secondary">
            Compare versions
          </Link>
          <BookmarkButton slug={doc.slug} />
        </div>
      </nav>

      <header className="mb-8 grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`chip ${stageBadgeClass(doc.stage)}`}>{doc.stage}</span>
            {props.isLatest ? <span className="chip chip-muted">latest</span> : <span className="chip chip-muted">historical</span>}
            {reviewFlag ? <span className="chip bg-amber-100 text-amber-900">{reviewFlag}</span> : null}
            {citationsFlag ? <span className="chip chip-muted">{citationsFlag}</span> : null}
            <span className="chip chip-muted">v{doc.version}</span>
          </div>
          <h1 className="mt-3 font-display text-5xl font-semibold tracking-tight">{doc.title}</h1>
          <p className="mt-3 max-w-3xl text-lg text-zinc-800">{doc.summary}</p>

          <div className="mt-5 flex flex-wrap gap-2">
            {doc.topics.map((t) => (
              <span key={t} className="chip chip-outline">
                {t}
              </span>
            ))}
          </div>
        </div>

        <div className="card p-5 lg:col-span-4">
          <div className="text-sm font-semibold text-zinc-700">Metadata</div>
          <dl className="mt-3 grid gap-3 text-base">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-zinc-500">Updated</dt>
              <dd className="font-medium text-zinc-900">{fmtDate(doc.updatedAt)}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-zinc-500">Reviewed</dt>
              <dd className="font-medium text-zinc-900">{reviewed}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-zinc-500">Owners</dt>
              <dd className="font-medium text-zinc-900 text-right">{owners}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-zinc-500">Visibility</dt>
              <dd className="font-medium text-zinc-900 text-right">{visibilityLabel}</dd>
            </div>
            {doc.approvals.length ? (
              <div className="pt-2">
                <dt className="text-zinc-500">Approvals</dt>
                <dd className="mt-2 space-y-1 text-zinc-800">
                  {doc.approvals.map((a) => (
                    <div key={`${a.name}:${a.date}`} className="flex items-center justify-between gap-4">
                      <span className="font-medium">{a.name}</span>
                      <span className="text-sm text-zinc-600">{a.date}</span>
                    </div>
                  ))}
                </dd>
              </div>
            ) : null}
            {doc.citations.length ? (
              <div className="pt-2">
                <dt className="text-zinc-500">Citations</dt>
                <dd className="mt-2 space-y-1 text-zinc-800">
                  {doc.citations.map((c) => (
                    <div key={c.label} className="text-sm">
                      {c.url ? (
                        <a href={c.url} className="underline decoration-black/10 underline-offset-4 hover:decoration-black/30">
                          {c.label}
                        </a>
                      ) : (
                        <span>{c.label}</span>
                      )}
                    </div>
                  ))}
                </dd>
              </div>
            ) : null}
          </dl>

          {doc.audit.length ? (
            <details className="mt-4 rounded-xl border border-zinc-200 bg-white p-4">
              <summary className="cursor-pointer text-sm font-semibold text-zinc-900">Audit log (advanced)</summary>
              <div className="mt-3 grid gap-2 text-sm text-zinc-800">
                {[...doc.audit]
                  .slice(-50)
                  .reverse()
                  .map((a) => (
                    <div key={`${a.at}:${a.action}`} className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <span className="font-semibold">{a.action}</span>
                        {a.actor ? <span className="text-zinc-600"> · {a.actor}</span> : null}
                        {a.note ? <span className="text-zinc-600"> · {a.note}</span> : null}
                      </div>
                      <div className="text-zinc-600">{a.at}</div>
                    </div>
                  ))}
              </div>
            </details>
          ) : null}
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-12">
        <article className="card p-7 lg:col-span-8">
          <Markdown value={doc.markdown} />
        </article>

        <aside className="lg:col-span-4">
          <div className="sticky top-28 space-y-4">
            <div className="card p-5">
              <h2 className="font-display text-xl font-semibold">What can I do here?</h2>
              <div className="mt-3 grid gap-2">
                <Link
                  href={`/assistant?doc=${encodeURIComponent(doc.slug)}&version=${encodeURIComponent(doc.version)}`}
                  className="btn btn-primary"
                >
                  Ask Amber AI
                </Link>
                <BookmarkButton slug={doc.slug} />
                <Link href={`/docs/${encodeURIComponent(doc.slug)}/diff`} className="btn btn-secondary">
                  Compare versions
                </Link>
                <Link
                  href={`/raw/v/${encodeURIComponent(doc.slug)}/${encodeURIComponent(doc.version)}`}
                  className="btn btn-secondary"
                >
                  View Markdown
                </Link>
                <CopyButton text={doc.markdown} label="Copy Markdown" />
              </div>
              <div className="mt-3 text-sm text-zinc-600">
                Bookmarks, notes, and feedback are stored locally in your browser.
              </div>
            </div>

            <Toc items={doc.toc} />

            {doc.collection ? (
              <div className="card p-5">
                <div className="text-sm font-semibold text-zinc-700">Reading list navigation</div>
                <div className="mt-3 grid gap-2">
                  {props.prev ? (
                    <Link
                      href={`/docs/${encodeURIComponent(props.prev.slug)}`}
                      className="btn btn-secondary w-full justify-between"
                    >
                      <span className="text-zinc-600">Previous</span>
                      <span className="truncate">{props.prev.title}</span>
                    </Link>
                  ) : (
                    <div className="text-sm text-zinc-600">No previous document in this list.</div>
                  )}
                  {props.next ? (
                    <Link
                      href={`/docs/${encodeURIComponent(props.next.slug)}`}
                      className="btn btn-secondary w-full justify-between"
                    >
                      <span className="text-zinc-600">Next</span>
                      <span className="truncate">{props.next.title}</span>
                    </Link>
                  ) : (
                    <div className="text-sm text-zinc-600">No next document in this list.</div>
                  )}
                </div>
              </div>
            ) : null}

            {doc.aiChecks.length ? (
              <details className="card p-5">
                <summary className="cursor-pointer font-display text-xl font-semibold">AI checks</summary>
                <ul className="mt-3 list-disc space-y-2 pl-6 text-zinc-800">
                  {doc.aiChecks.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </details>
            ) : null}

            {doc.relatedContext.length ? (
              <details className="card p-5">
                <summary className="cursor-pointer font-display text-xl font-semibold">Related context</summary>
                <ul className="mt-3 list-disc space-y-2 pl-6 text-zinc-800">
                  {doc.relatedContext.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </details>
            ) : null}

            <NotesPanel doc={{ slug: doc.slug, version: doc.version, toc: doc.toc }} />

            <FeedbackWidget doc={{ slug: doc.slug, version: doc.version, title: doc.title }} />
          </div>
        </aside>
      </section>

      <section className="mt-8">
        <AiPromptPack doc={doc} relatedDocs={props.relatedDocs} />
      </section>

      {props.relatedDocs.length ? (
        <section className="mt-8 card p-6">
          <h2 className="font-display text-xl font-semibold">Related docs</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {props.relatedDocs.map((d) => (
              <Link
                key={`${d.slug}:${d.version}`}
                href={`/docs/${encodeURIComponent(d.slug)}`}
                className="rounded-2xl border border-zinc-200 bg-white p-5 hover:bg-zinc-50"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold text-zinc-900">{d.title}</div>
                  <span className={`chip ${stageBadgeClass(d.stage)}`}>{d.stage}</span>
                </div>
                <div className="mt-1 text-sm text-zinc-600">{d.summary}</div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
