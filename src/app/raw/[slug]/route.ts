import { getLatestDoc, listDocSlugs } from "@/lib/content/docs.server";

export const dynamic = "force-static";

export function generateStaticParams() {
  return listDocSlugs().map((slug) => ({ slug }));
}

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const doc = getLatestDoc(slug);
  if (!doc) return new Response("Not found", { status: 404 });

  const etag = `"${doc.contentHash}"`;
  const lastModified = !Number.isNaN(new Date(doc.updatedAt).getTime()) ? new Date(doc.updatedAt) : new Date(0);
  const headers: Record<string, string> = {
    "content-type": "text/markdown; charset=utf-8",
    etag,
    "last-modified": lastModified.toUTCString(),
    "cache-control": "public, max-age=60",
  };

  return new Response(doc.markdown, { status: 200, headers });
}
