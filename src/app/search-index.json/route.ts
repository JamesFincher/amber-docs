import { listDocVersions, listLatestDocs } from "@/lib/content/docs.server";

export const dynamic = "force-static";

export function GET() {
  const latest = listLatestDocs();
  const out = latest.map((d) => {
    const versionsCount = listDocVersions(d.slug).length;
    return {
      slug: d.slug,
      version: d.version,
      title: d.title,
      stage: d.stage,
      summary: d.summary,
      updatedAt: d.updatedAt,
      lastReviewedAt: d.lastReviewedAt ?? null,
      owners: d.owners,
      topics: d.topics,
      collection: d.collection ?? null,
      order: d.order ?? null,
      headings: d.headings,
      searchText: d.searchText,
      contentHash: d.contentHash,
      citationsCount: d.citations.length,
      versionsCount,
      url: `/docs/${encodeURIComponent(d.slug)}`,
    };
  });

  return Response.json(out, {
    headers: {
      "cache-control": "public, max-age=300",
    },
  });
}
