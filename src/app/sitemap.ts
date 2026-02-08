import type { MetadataRoute } from "next";
import { docs } from "@/lib/docs";

export const dynamic = "force-static";

function baseUrl() {
  return process.env.SITE_URL ?? "http://localhost:3000";
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = baseUrl().replace(/\/+$/, "");

  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/docs`, changeFrequency: "daily", priority: 0.8 },
    ...docs.map((doc) => ({
      url: `${base}/docs/${encodeURIComponent(doc.slug)}`,
      lastModified: new Date(doc.updatedAt),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
