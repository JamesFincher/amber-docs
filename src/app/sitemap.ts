import type { MetadataRoute } from "next";
import { listLatestDocs } from "@/lib/content/docs.server";

export const dynamic = "force-static";

function baseUrl() {
  return process.env.SITE_URL ?? "http://localhost:3000";
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = baseUrl().replace(/\/+$/, "");
  const docs = listLatestDocs();

  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/docs`, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/paths`, changeFrequency: "weekly", priority: 0.65 },
    { url: `${base}/studio`, changeFrequency: "weekly", priority: 0.65 },
    { url: `${base}/assistant`, changeFrequency: "weekly", priority: 0.65 },
    { url: `${base}/templates`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${base}/blocks`, changeFrequency: "weekly", priority: 0.55 },
    ...docs.map((doc) => ({
      url: `${base}/docs/${encodeURIComponent(doc.slug)}`,
      lastModified: new Date(doc.updatedAt),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
