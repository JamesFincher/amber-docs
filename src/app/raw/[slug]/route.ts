import type { NextRequest } from "next/server";
import { getLatestDoc, listDocSlugs } from "@/lib/content/docs.server";

export const dynamic = "force-static";

export function generateStaticParams() {
  return listDocSlugs().map((slug) => ({ slug }));
}

export async function GET(_request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const doc = getLatestDoc(slug);
  if (!doc) return new Response("Not found", { status: 404 });

  return new Response(doc.markdown, {
    status: 200,
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "cache-control": "public, max-age=60",
    },
  });
}

