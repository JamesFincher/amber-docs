import crypto from "node:crypto";
import { listLatestDocs } from "@/lib/content/docs.server";

export const dynamic = "force-static";

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function GET() {
  const docs = listLatestDocs();
  const buildId = sha256(docs.map((d) => `${d.slug}@${d.version}:${d.contentHash}`).join("\n"));

  const payload = {
    generatedAt: new Date().toISOString(),
    buildId,
    docs: docs.map((d) => ({
      slug: d.slug,
      version: d.version,
      updatedAt: d.updatedAt,
      contentHash: d.contentHash,
      url: `/docs/${encodeURIComponent(d.slug)}`,
    })),
  };

  return Response.json(payload, {
    headers: {
      "cache-control": "public, max-age=60",
    },
  });
}

