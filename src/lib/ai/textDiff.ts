import { diffLines } from "diff";

export type DiffPreview = {
  summary: string;
  diff: string;
  truncated: boolean;
  addedLines: number;
  removedLines: number;
};

function countLines(value: string): number {
  if (!value) return 0;
  const parts = value.split("\n");
  // Drop trailing empty line created by split when text ends with \n.
  if (parts.length && parts[parts.length - 1] === "") parts.pop();
  return parts.length;
}

export function diffTextPreview(args: {
  from: string;
  to: string;
  maxLines?: number;
  maxChars?: number;
}): DiffPreview {
  const maxLines = Math.max(20, Math.min(800, args.maxLines ?? 220));
  const maxChars =
    typeof args.maxChars === "number" && Number.isFinite(args.maxChars)
      ? Math.max(100, Math.min(50_000, args.maxChars))
      : 10_000;

  const parts = diffLines(args.from, args.to);

  let addedLines = 0;
  let removedLines = 0;
  const lines: string[] = [];
  let truncated = false;

  for (const p of parts) {
    const prefix = p.added ? "+" : p.removed ? "-" : " ";
    const cnt = countLines(p.value);
    if (p.added) addedLines += cnt;
    if (p.removed) removedLines += cnt;

    const chunkLines = p.value.split("\n");
    // Keep trailing empty string if present so unchanged newlines render as expected,
    // but don't emit an extra line at the end.
    for (let i = 0; i < chunkLines.length; i++) {
      const line = chunkLines[i]!;
      const isLastTrailingEmpty = i === chunkLines.length - 1 && line === "";
      if (isLastTrailingEmpty) continue;
      lines.push(`${prefix}${line}`);
      if (lines.length >= maxLines) {
        truncated = true;
        break;
      }
    }
    if (truncated) break;
  }

  let diff = lines.join("\n");
  if (diff.length > maxChars) {
    diff = diff.slice(0, maxChars);
    truncated = true;
  }

  const summary = `Added ${addedLines} line${addedLines === 1 ? "" : "s"}, removed ${removedLines} line${removedLines === 1 ? "" : "s"}.`;
  return { summary, diff, truncated, addedLines, removedLines };
}
