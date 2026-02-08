import crypto from "node:crypto";

import { listDocSlugs, listDocVersions } from "@/lib/content/docs.server";

export const dynamic = "force-static";

const SCHEMA_VERSION = 1;

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function GET() {
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
      owners: d.owners,
      topics: d.topics,
      collection: d.collection ?? null,
      order: d.order ?? null,
      relatedSlugs: d.relatedSlugs,
      citations: d.citations,
      approvals: d.approvals,
      contentHash: d.contentHash,
      url: `/docs/${encodeURIComponent(d.slug)}/v/${encodeURIComponent(d.version)}`,
      rawUrl: `/raw/v/${encodeURIComponent(d.slug)}/${encodeURIComponent(d.version)}`,
    }));

    // listDocSlugs() is derived from visible docs, so each slug has at least one visible version.
    const latest = versions[0]!;
    return {
      slug,
      latestVersion: latest.version,
      latestUrl: `/docs/${encodeURIComponent(slug)}`,
      latestRawUrl: `/raw/${encodeURIComponent(slug)}`,
      versions,
    };
  });

  const docsCount = bySlug.reduce((sum, s) => sum + s.versions.length, 0);
  const lastUpdatedAt =
    bySlug.flatMap((s) => s.versions.map((v) => v.updatedAt)).sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))[0] ??
    null;
  const lastModified = lastUpdatedAt && !Number.isNaN(new Date(lastUpdatedAt).getTime()) ? new Date(lastUpdatedAt) : new Date(0);

  const payload = {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: lastModified.toISOString(),
    docsCount,
    canonicalCount: slugs.length,
    docs: bySlug,
  };

  const body = JSON.stringify(payload);
  const etag = `"${sha256(body)}"`;
  const headers: Record<string, string> = {
    "content-type": "application/json; charset=utf-8",
    etag,
    "last-modified": lastModified.toUTCString(),
    // Static hosting should override this via _headers, but keep for non-export runtimes.
    "cache-control": "public, max-age=300",
  };

  return new Response(body, { status: 200, headers });
}
