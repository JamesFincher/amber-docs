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
  const variant = state === "copied" ? "btn btn-primary" : state === "error" ? "btn btn-danger" : "btn btn-secondary";

  return (
    <button
      type="button"
      onClick={onCopy}
      className={variant}
      aria-live="polite"
      title={label}
    >
      {textLabel}
    </button>
  );
}
