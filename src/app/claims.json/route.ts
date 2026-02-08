import { listLatestDocs } from "@/lib/content/docs.server";

export const dynamic = "force-static";

function toClaimText(markdown: string): string {
  // Like `toSearchText`, but keep `-` so ISO dates (YYYY-MM-DD) remain detectable.
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_>#]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniq(xs: string[]) {
  return Array.from(new Set(xs));
}

function extract(pattern: RegExp, text: string): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
  while ((m = re.exec(text))) out.push(m[0]);
  return out;
}

export function GET() {
  const docs = listLatestDocs();

  const payload = {
    generatedAt: new Date().toISOString(),
    docs: docs.map((d) => {
      const text = toClaimText(d.markdown);
      const numbers = uniq(extract(/\b\d+(?:\.\d+)?%?\b/gi, text)).slice(0, 200);
      const dates = uniq(extract(/\b\d{4}-\d{2}-\d{2}\b/g, text)).slice(0, 200);
      return {
        slug: d.slug,
        version: d.version,
        title: d.title,
        numbers,
        dates,
      };
    }),
  };

  return Response.json(payload, {
    headers: {
      "cache-control": "public, max-age=300",
    },
  });
}
