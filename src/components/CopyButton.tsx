"use client";

import { useState } from "react";

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
      window.setTimeout(() => setState("idle"), 1200);
    } catch {
      setState("error");
      window.setTimeout(() => setState("idle"), 1200);
    }
  }

  const textLabel = state === "copied" ? "Copied" : state === "error" ? "Copy failed" : label;

  return (
    <button
      type="button"
      onClick={onCopy}
      className="inline-flex items-center justify-center rounded-md border border-black/10 bg-white/60 px-2.5 py-1.5 text-xs font-medium text-zinc-900 shadow-sm transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
    >
      {textLabel}
    </button>
  );
}

