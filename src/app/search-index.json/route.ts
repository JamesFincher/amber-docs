import { listDocSlugs, listDocVersions } from "@/lib/content/docs.server";

export const dynamic = "force-static";

export function GET() {
  const slugs = listDocSlugs();
  const out = slugs.map((slug) => {
    const versions = listDocVersions(slug);
    const latest = versions[0];
    if (!latest) return null;
    return {
      slug,
      version: latest.version,
      title: latest.title,
      stage: latest.stage,
      summary: latest.summary,
      updatedAt: latest.updatedAt,
      lastReviewedAt: latest.lastReviewedAt ?? null,
      owners: latest.owners ?? [],
      topics: latest.topics ?? [],
      collection: latest.collection ?? null,
      order: latest.order ?? null,
      headings: latest.headings ?? [],
      searchText: latest.searchText ?? "",
      contentHash: latest.contentHash,
      citationsCount: latest.citations?.length ?? 0,
      versionsCount: versions.length,
      url: `/docs/${encodeURIComponent(latest.slug)}`,
    };
  }).filter(Boolean);

  return Response.json(out, {
    headers: {
      "cache-control": "public, max-age=300",
    },
  });
}

