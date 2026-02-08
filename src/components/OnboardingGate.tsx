"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const ONBOARDING_KEY = "amber-docs:onboarding:done:v1";

export function OnboardingGate() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const done = localStorage.getItem(ONBOARDING_KEY);
      if (!done) setOpen(true);
    } catch {
      // If localStorage is blocked, don't force a modal.
      setOpen(false);
    }
  }, []);

  function dismiss() {
    setOpen(false);
    try {
      localStorage.setItem(ONBOARDING_KEY, new Date().toISOString());
    } catch {
      // ignore
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-3xl border border-black/10 bg-white p-6 shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-zinc-700">First time here?</div>
            <h2 className="mt-1 font-display text-3xl font-semibold tracking-tight">Start with 3 simple steps</h2>
            <p className="mt-2 text-zinc-700">
              Amber Docs is designed for non-technical users. You can safely read docs, draft new ones, and publish them when ready.
            </p>
          </div>
          <button className="btn btn-secondary" type="button" onClick={dismiss}>
            Close
          </button>
        </div>

        <div className="mt-5 grid gap-3">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <div className="text-base font-semibold text-zinc-900">1) Find an answer</div>
            <p className="mt-1 text-sm text-zinc-700">Use search and reading paths to find the right document.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link className="btn btn-primary" href="/docs" onClick={dismiss}>
                Go to Documents
              </Link>
              <Link className="btn btn-secondary" href="/paths" onClick={dismiss}>
                Browse reading paths
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <div className="text-base font-semibold text-zinc-900">2) Draft a document</div>
            <p className="mt-1 text-sm text-zinc-700">
              Use Templates to scaffold a doc. Optional: generate a first draft with Google AI (Gemini).
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link className="btn btn-primary" href="/templates" onClick={dismiss}>
                Go to Templates
              </Link>
              <Link className="btn btn-secondary" href="/assistant" onClick={dismiss}>
                Ask AI
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <div className="text-base font-semibold text-zinc-900">3) Publish when ready</div>
            <p className="mt-1 text-sm text-zinc-700">
              Use Write + publish (Studio). You connect your <code>content/docs</code> folder, then publish/unpublish and mark Final/Official.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link className="btn btn-primary" href="/studio" onClick={dismiss}>
                Go to Write + publish
              </Link>
              <Link className="btn btn-secondary" href="/help" onClick={dismiss}>
                Read Help
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="text-sm text-amber-950">
            Tip: <span className="font-semibold">Publish/unpublish</span> controls whether a doc shows up in the app.{" "}
            <span className="font-semibold">Final/Official</span> controls its approval status.
          </div>
          <button className="btn btn-secondary" type="button" onClick={dismiss}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

