import { docs } from "@/lib/docs";

export const dynamic = "force-static";

export function GET() {
  const payload = docs.map((d) => ({
    slug: d.slug,
    title: d.title,
    stage: d.stage,
    summary: d.summary,
    updatedAt: d.updatedAt,
    lastReviewedAt: d.lastReviewedAt ?? null,
    owners: d.owners ?? [],
    topics: d.topics ?? [],
    relatedSlugs: d.relatedSlugs ?? [],
    citations: d.citations ?? [],
    url: `/docs/${encodeURIComponent(d.slug)}`,
    rawUrl: `/raw/${encodeURIComponent(d.slug)}`,
  }));

  return Response.json(payload, {
    headers: {
      "cache-control": "public, max-age=300",
    },
  });
}

