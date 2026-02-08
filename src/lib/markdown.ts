import { createSlugger } from "./slugger";

export type TocItem = {
  id: string;
  depth: 2 | 3;
  text: string;
};

function headingTextToPlain(text: string): string {
  return text
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_~]/g, "")
    .replace(/<[^>]+>/g, "")
    .trim();
}

export function extractToc(markdown: string): TocItem[] {
  const slugger = createSlugger();
  const lines = markdown.split(/\r?\n/);
  const toc: TocItem[] = [];
  let inFence = false;

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = line.match(/^(#{2,3})\s+(.+?)\s*#*\s*$/);
    if (!m) continue;
    const depth = m[1].length;
    if (depth !== 2 && depth !== 3) continue;
    const text = headingTextToPlain(m[2]);
    const id = slugger.slug(text);
    toc.push({ id, depth: depth as 2 | 3, text });
  }

  return toc;
}

export function toSearchText(markdown: string): string {
  // Basic markdown -> text approximation for client-side search.
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_>#-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractH2Sections(markdown: string): Array<{ heading: string; body: string }> {
  const lines = markdown.split(/\r?\n/);
  const sections: Array<{ heading: string; body: string }> = [];
  let inFence = false;
  let current: { heading: string; body: string } | null = null;

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      inFence = !inFence;
    }

    if (!inFence) {
      const m = line.match(/^##\s+(.+?)\s*#*\s*$/);
      if (m) {
        if (current) sections.push({ heading: current.heading, body: current.body.trim() + "\n" });
        current = { heading: headingTextToPlain(m[1]), body: "" };
        continue;
      }
    }

    if (current) current.body += line + "\n";
  }

  if (current) sections.push({ heading: current.heading, body: current.body.trim() + "\n" });
  return sections;
}
