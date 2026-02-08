import crypto from "node:crypto";
import { listLatestDocs } from "@/lib/content/docs.server";
import { extractH2Sections, toSearchText } from "@/lib/markdown";
import { createSlugger } from "@/lib/slugger";

export const dynamic = "force-static";

const SCHEMA_VERSION = 1;

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

type Chunk = {
  chunkId: string;
  slug: string;
  version: string;
  title: string;
  heading: string | null;
  text: string;
  contentHash: string;
  url: string;
};

export function GET() {
  const docs = listLatestDocs();

  const chunks: Chunk[] = docs.flatMap((d): Chunk[] => {
    const slugger = createSlugger();
    const sections = extractH2Sections(d.markdown);
    if (!sections.length) {
      const text = toSearchText(d.markdown);
      const chunkId = sha256(`${d.slug}@${d.version}:doc:${sha256(text)}`);
      return [
        {
          chunkId,
          slug: d.slug,
          version: d.version,
          title: d.title,
          heading: null,
          text,
          contentHash: sha256(text),
          url: `/docs/${encodeURIComponent(d.slug)}`,
        },
      ];
    }

    return sections.map((s) => {
      const text = toSearchText(s.body);
      const id = slugger.slug(s.heading);
      const chunkId = sha256(`${d.slug}@${d.version}:${s.heading}:${sha256(text)}`);
      return {
        chunkId,
        slug: d.slug,
        version: d.version,
        title: d.title,
        heading: s.heading,
        text,
        contentHash: sha256(text),
        url: `/docs/${encodeURIComponent(d.slug)}#${encodeURIComponent(id)}`,
      };
    });
  });

  const payload = {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    chunksCount: chunks.length,
    chunks,
  };

  return Response.json(payload, {
    headers: {
      "cache-control": "public, max-age=300",
    },
  });
}
