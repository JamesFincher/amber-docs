"use client";

import { diffLines } from "diff";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { DocRecord } from "@/lib/docs";

function fmtOption(d: Pick<DocRecord, "version" | "updatedAt" | "stage">) {
  return `v${d.version} · ${d.updatedAt} · ${d.stage}`;
}

export function DiffClient(props: { slug: string; versions: Array<Pick<DocRecord, "version" | "updatedAt" | "stage" | "markdown" | "title">> }) {
  const latest = props.versions[0];
  const defaultFrom = props.versions[1] ?? latest;

  const [from, setFrom] = useState<string>(defaultFrom.version);
  const [to, setTo] = useState<string>(latest.version);
  const [showUnchanged, setShowUnchanged] = useState<boolean>(true);

  const fromDoc = props.versions.find((v) => v.version === from) ?? defaultFrom;
  const toDoc = props.versions.find((v) => v.version === to) ?? latest;

  const parts = useMemo(() => diffLines(fromDoc.markdown, toDoc.markdown), [fromDoc.markdown, toDoc.markdown]);
  const visibleParts = showUnchanged ? parts : parts.filter((p) => p.added || p.removed);

  return (
    <main className="page max-w-6xl">
      <header className="mb-8 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-zinc-700">Compare versions</p>
            <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">What changed?</h1>
            <p className="mt-1 text-zinc-700">
              {toDoc.title} ({props.slug})
            </p>
          </div>
          <nav className="flex flex-wrap gap-2">
            <Link href={`/docs/${encodeURIComponent(props.slug)}`} className="btn btn-secondary">
              Back to doc
            </Link>
            <Link href={`/assistant?doc=${encodeURIComponent(props.slug)}`} className="btn btn-secondary">
              Ask AI
            </Link>
            <Link href="/docs" className="btn btn-secondary">
              Documents
            </Link>
            <Link href="/help" className="btn btn-secondary">
              Help
            </Link>
          </nav>
        </div>
      </header>

      <section className="card p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-base font-semibold text-zinc-800">
            Older version (From)
            <select
              className="mt-2 w-full control"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            >
              {props.versions.map((v) => (
                <option key={v.version} value={v.version}>
                  {fmtOption(v)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-base font-semibold text-zinc-800">
            Newer version (To)
            <select
              className="mt-2 w-full control"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            >
              {props.versions.map((v) => (
                <option key={v.version} value={v.version}>
                  {fmtOption(v)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-zinc-700">
            Green is added text. Red is removed text. This compares Markdown line-by-line.
          </p>
          <label className="flex items-center gap-3 text-base text-zinc-800">
            <input
              type="checkbox"
              checked={showUnchanged}
              onChange={(e) => setShowUnchanged(e.target.checked)}
              className="h-5 w-5"
            />
            Show unchanged text
          </label>
        </div>
      </section>

      <section className="mt-6 card overflow-hidden">
        <div className="grid">
          {visibleParts.map((p, i) => (
            <pre
              key={i}
              className={
                p.added
                  ? "m-0 whitespace-pre-wrap bg-emerald-50 px-5 py-3 font-mono text-sm text-emerald-950"
                  : p.removed
                    ? "m-0 whitespace-pre-wrap bg-rose-50 px-5 py-3 font-mono text-sm text-rose-950"
                    : "m-0 whitespace-pre-wrap bg-white px-5 py-3 font-mono text-sm text-zinc-800"
              }
            >
              {p.value}
            </pre>
          ))}
        </div>
      </section>
    </main>
  );
}
