import { loadAllDocs, listDocSlugs, listDocVersions } from "@/lib/content/docs.server";

export const dynamic = "force-static";

const SCHEMA_VERSION = 1;

export function GET() {
  const all = loadAllDocs();
  const slugs = listDocSlugs();

  const bySlug = slugs.map((slug) => {
    const versions = listDocVersions(slug).map((d) => ({
      slug: d.slug,
      version: d.version,
      title: d.title,
      stage: d.stage,
      summary: d.summary,
      updatedAt: d.updatedAt,
      lastReviewedAt: d.lastReviewedAt ?? null,
      owners: d.owners ?? [],
      topics: d.topics ?? [],
      collection: d.collection ?? null,
      order: d.order ?? null,
      relatedSlugs: d.relatedSlugs ?? [],
      citations: d.citations ?? [],
      approvals: d.approvals ?? [],
      contentHash: d.contentHash,
      url: `/docs/${encodeURIComponent(d.slug)}/v/${encodeURIComponent(d.version)}`,
      rawUrl: `/raw/v/${encodeURIComponent(d.slug)}/${encodeURIComponent(d.version)}`,
    }));

    const latest = versions[0] ?? null;
    return {
      slug,
      latestVersion: latest?.version ?? null,
      latestUrl: latest ? `/docs/${encodeURIComponent(slug)}` : null,
      latestRawUrl: latest ? `/raw/${encodeURIComponent(slug)}` : null,
      versions,
    };
  });

  const payload = {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    docsCount: all.length,
    canonicalCount: slugs.length,
    docs: bySlug,
  };

  return Response.json(payload, {
    headers: {
      // Static hosting should override this via _headers, but keep for non-export runtimes.
      "cache-control": "public, max-age=300",
    },
  });
}
