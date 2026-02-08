import type { NextRequest } from "next/server";
import { getDocVersion, loadAllDocs } from "@/lib/content/docs.server";

export const dynamic = "force-static";

export function generateStaticParams() {
  return loadAllDocs().map((d) => ({ slug: d.slug, version: d.version }));
}

export async function GET(_request: NextRequest, context: { params: Promise<{ slug: string; version: string }> }) {
  const { slug, version } = await context.params;
  const doc = getDocVersion(slug, version);
  if (!doc) return new Response("Not found", { status: 404 });

  return new Response(doc.markdown, {
    status: 200,
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "cache-control": "public, max-age=60",
    },
  });
}

