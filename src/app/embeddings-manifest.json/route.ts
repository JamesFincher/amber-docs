import crypto from "node:crypto";
import { listLatestDocs } from "@/lib/content/docs.server";
import { extractH2Sections, toSearchText } from "@/lib/markdown";
import { createSlugger } from "@/lib/slugger";

export const dynamic = "force-static";

const SCHEMA_VERSION = 1;

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function GET() {
  const docs = listLatestDocs();

  const payload = {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    docs: docs.map((d) => {
      const slugger = createSlugger();
      const sections = extractH2Sections(d.markdown);
      const chunks = sections.length
        ? sections.map((s) => {
            const id = slugger.slug(s.heading);
            const text = toSearchText(s.body);
            const chunkId = sha256(`${d.slug}@${d.version}:${id}:${sha256(text)}`);
            return {
              chunkId,
              heading: s.heading,
              headingId: id,
              contentHash: sha256(text),
            };
          })
        : [
            {
              chunkId: sha256(`${d.slug}@${d.version}:doc:${sha256(toSearchText(d.markdown))}`),
              heading: null,
              headingId: null,
              contentHash: sha256(toSearchText(d.markdown)),
            },
          ];

      return {
        slug: d.slug,
        version: d.version,
        title: d.title,
        contentHash: d.contentHash,
        chunks,
      };
    }),
  };

  return Response.json(payload, {
    headers: {
      "cache-control": "public, max-age=300",
    },
  });
}

