import { safeFilePart } from "@/lib/content/docsWorkflow.shared";

// Extract the first H1 ("# Title") as a reasonable default title.
export function titleFromMarkdown(markdown: string, fallback: string): string {
  const lines = markdown.split("\n");
  for (const line of lines) {
    const m = /^#\s+(.+)$/.exec(line.trim());
    if (m && m[1]) return m[1].trim();
  }
  return fallback;
}

// Best-effort summary for imported files: first non-empty non-heading line.
export function summaryFromMarkdown(markdown: string): string {
  const lines = markdown.split("\n");
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#")) continue;
    if (line.startsWith(">")) continue;
    if (line.startsWith("- ")) continue;
    if (line.startsWith("* ")) continue;
    if (/^\d+\.\s+/.test(line)) continue;
    // Strip basic emphasis markers so the summary reads cleanly.
    const cleaned = line.replace(/[*_`]+/g, "").trim();
    if (!cleaned) continue;
    return cleaned.length > 180 ? `${cleaned.slice(0, 177)}...` : cleaned;
  }
  return "";
}

export function slugFromFilename(fileName: string): string {
  const base = fileName.replace(/\.(md|mdx|txt)$/i, "");
  const normalized = safeFilePart(base.trim().toLowerCase());
  return normalized || "new-doc";
}

