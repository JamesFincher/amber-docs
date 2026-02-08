"use client";

import { useEffect, useMemo, useState } from "react";

const FEEDBACK_KEY = "amber-docs:feedback:v1";

type FeedbackVote = "up" | "down";

function readFeedback(): Record<string, FeedbackVote> {
  try {
    const raw = localStorage.getItem(FEEDBACK_KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw) as unknown;
    if (!obj || typeof obj !== "object") return {};
    return obj as Record<string, FeedbackVote>;
  } catch {
    return {};
  }
}

function writeFeedback(votes: Record<string, FeedbackVote>) {
  localStorage.setItem(FEEDBACK_KEY, JSON.stringify(votes, null, 2));
}

export function FeedbackWidget(props: { doc: { slug: string; version: string; title: string } }) {
  const key = `${props.doc.slug}@${props.doc.version}`;
  const [vote, setVote] = useState<FeedbackVote | null>(null);

  useEffect(() => {
    const votes = readFeedback();
    setVote(votes[key] ?? null);
  }, [key]);

  const issueUrl = useMemo(() => {
    const base = "https://github.com/JamesFincher/amber-docs/issues/new";
    const title = `Docs feedback: ${props.doc.title} (v${props.doc.version})`;
    const body = [
      "What is wrong or missing?",
      "",
      "- Expected:",
      "- Actual:",
      "- Suggested fix:",
      "",
      "Context:",
      `- Doc: /docs/${props.doc.slug}/v/${props.doc.version}`,
      `- Raw: /raw/v/${props.doc.slug}/${props.doc.version}`,
      "",
      "(If this is a private/internal reference, redact before submitting.)",
    ].join("\n");
    const qs = new URLSearchParams({ title, body }).toString();
    return `${base}?${qs}`;
  }, [props.doc.slug, props.doc.title, props.doc.version]);

  function set(next: FeedbackVote) {
    const votes = readFeedback();
    votes[key] = next;
    writeFeedback(votes);
    setVote(next);
  }

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-display text-lg font-semibold">Feedback</div>
          <div className="mt-1 text-sm text-zinc-600">Was this doc helpful?</div>
        </div>
        <a href={issueUrl} className="btn btn-secondary" target="_blank" rel="noreferrer">
          Report issue
        </a>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className={vote === "up" ? "btn btn-primary" : "btn btn-secondary"} onClick={() => set("up")}>
          Helpful
        </button>
        <button type="button" className={vote === "down" ? "btn btn-primary" : "btn btn-secondary"} onClick={() => set("down")}>
          Not helpful
        </button>
        {vote ? <div className="ml-1 text-sm text-zinc-500">Saved locally.</div> : null}
      </div>
    </div>
  );
}
