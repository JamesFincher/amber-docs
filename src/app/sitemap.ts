import type { MetadataRoute } from "next";
import { listOfficialDocs } from "@/lib/convexPublic";

function baseUrl() {
  return process.env.SITE_URL ?? "http://localhost:3000";
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const docs = await listOfficialDocs().catch(() => []);
  const base = baseUrl().replace(/\/+$/, "");

  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/docs`, changeFrequency: "daily", priority: 0.8 },
    ...docs.map((d) => ({
      url: `${base}/docs/${encodeURIComponent(d.slug)}`,
      lastModified: new Date(d.updatedAt),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}

