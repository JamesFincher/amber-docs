"use client";

import { useEffect, useMemo, useState } from "react";
import type { TocItem } from "@/lib/markdown";

type Note = {
  id: string;
  createdAt: number;
  body: string;
  sectionId: string | null;
  resolved: boolean;
};

const NOTES_KEY = "amber-docs:notes:v1";

function readAllNotes(): Record<string, Note[]> {
  try {
    const raw = localStorage.getItem(NOTES_KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw) as unknown;
    if (!obj || typeof obj !== "object") return {};
    return obj as Record<string, Note[]>;
  } catch {
    return {};
  }
}

function writeAllNotes(map: Record<string, Note[]>) {
  localStorage.setItem(NOTES_KEY, JSON.stringify(map, null, 2));
}

function fmt(ts: number) {
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

export function NotesPanel(props: { doc: { slug: string; version: string; toc: TocItem[] } }) {
  const key = `${props.doc.slug}@${props.doc.version}`;
  const [notes, setNotes] = useState<Note[]>([]);
  const [body, setBody] = useState("");
  const [sectionId, setSectionId] = useState<string>("__doc__");
  const [showResolved, setShowResolved] = useState(false);

  const sectionOptions = useMemo(() => {
    const out: Array<{ id: string; label: string }> = [{ id: "__doc__", label: "Whole doc" }];
    for (const t of props.doc.toc) {
      if (t.depth !== 2) continue;
      out.push({ id: t.id, label: t.text });
    }
    return out;
  }, [props.doc.toc]);

  useEffect(() => {
    const map = readAllNotes();
    setNotes(map[key] ?? []);
  }, [key]);

  function save(next: Note[]) {
    const map = readAllNotes();
    map[key] = next;
    writeAllNotes(map);
    setNotes(next);
  }

  function add() {
    const trimmed = body.trim();
    if (!trimmed) return;
    const note: Note = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      createdAt: Date.now(),
      body: trimmed,
      sectionId: sectionId === "__doc__" ? null : sectionId,
      resolved: false,
    };
    save([note, ...notes]);
    setBody("");
  }

  const visible = showResolved ? notes : notes.filter((n) => !n.resolved);

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-display text-xl font-semibold">Notes</div>
          <div className="mt-1 text-zinc-700">Personal notes for this document version (stored on this computer).</div>
        </div>
        <label className="flex items-center gap-3 text-base text-zinc-800">
          <input
            type="checkbox"
            checked={showResolved}
            onChange={(e) => setShowResolved(e.target.checked)}
            className="h-5 w-5"
          />
          Show resolved
        </label>
      </div>

      <div className="mt-4 grid gap-2">
        <label className="text-sm font-semibold text-zinc-800">
          Section
          <select
            className="mt-2 w-full control"
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
          >
            {sectionOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <div className="text-sm font-semibold text-zinc-800">Note</div>
          <textarea
            className="mt-2 h-28 w-full control"
            placeholder="Add a note (what to verify, what changed, open questions)."
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </label>
        <div className="flex items-center justify-between gap-3">
          <button className="btn btn-primary" onClick={add} type="button">
            Add note
          </button>
          {notes.length ? (
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => {
                if (!confirm("Clear all notes for this doc version?")) return;
                save([]);
              }}
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>

      {visible.length ? (
        <div className="mt-4 grid gap-3">
          {visible.map((n) => (
            <div key={n.id} className="rounded-2xl border border-zinc-200 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-600">
                    <span>{fmt(n.createdAt)}</span>
                    {n.sectionId ? (
                      <a href={`#${n.sectionId}`} className="underline decoration-black/10 underline-offset-4 hover:decoration-black/30">
                        section
                      </a>
                    ) : (
                      <span>whole doc</span>
                    )}
                    {n.resolved ? <span className="chip chip-muted">resolved</span> : null}
                  </div>
                  <div className="mt-3 whitespace-pre-wrap text-zinc-900">{n.body}</div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    className={n.resolved ? "btn btn-secondary" : "btn btn-primary"}
                    type="button"
                    onClick={() => {
                      const next = notes.map((x) => (x.id === n.id ? { ...x, resolved: !x.resolved } : x));
                      save(next);
                    }}
                  >
                    {n.resolved ? "Unresolve" : "Resolve"}
                  </button>
                  <button
                    className="btn btn-secondary"
                    type="button"
                    onClick={() => {
                      const next = notes.filter((x) => x.id !== n.id);
                      save(next);
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 text-zinc-700">No notes yet.</div>
      )}
    </div>
  );
}
