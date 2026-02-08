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

  const fromDoc = props.versions.find((v) => v.version === from) ?? defaultFrom;
  const toDoc = props.versions.find((v) => v.version === to) ?? latest;

  const parts = useMemo(() => diffLines(fromDoc.markdown, toDoc.markdown), [fromDoc.markdown, toDoc.markdown]);

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <header className="mb-8 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Review</p>
            <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">Diff</h1>
            <p className="mt-1 text-zinc-600">
              {toDoc.title} ({props.slug})
            </p>
          </div>
          <nav className="flex flex-wrap gap-2 text-sm">
            <Link href={`/docs/${encodeURIComponent(props.slug)}`} className="btn btn-secondary">
              Back to doc
            </Link>
            <Link href="/docs" className="btn btn-secondary">
              Docs
            </Link>
          </nav>
        </div>
      </header>

      <section className="card p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium text-zinc-700">
            From
            <select
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
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
          <label className="block text-sm font-medium text-zinc-700">
            To
            <select
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
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
        <p className="mt-4 text-sm text-zinc-600">
          Additions are highlighted in green; deletions in red. This diff is line-based (Markdown).
        </p>
      </section>

      <section className="mt-6 card overflow-hidden">
        <div className="grid">
          {parts.map((p, i) => (
            <pre
              key={i}
              className={
                p.added
                  ? "m-0 whitespace-pre-wrap bg-emerald-50 px-5 py-2 font-mono text-xs text-emerald-950"
                  : p.removed
                    ? "m-0 whitespace-pre-wrap bg-rose-50 px-5 py-2 font-mono text-xs text-rose-950"
                    : "m-0 whitespace-pre-wrap bg-white px-5 py-2 font-mono text-xs text-zinc-700"
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

