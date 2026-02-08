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
      className="btn btn-secondary"
    >
      {textLabel}
    </button>
  );
}
