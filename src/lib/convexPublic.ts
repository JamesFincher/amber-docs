import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";

let _client: ConvexHttpClient | null = null;

function client(): ConvexHttpClient {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_CONVEX_URL. Did you run `pnpm convex dev`?");
  }
  _client = new ConvexHttpClient(url);
  return _client;
}

export async function listOfficialDocs() {
  return await client().query(api.docs.listOfficial, {});
}

export async function getOfficialDocBySlug(slug: string) {
  return await client().query(api.docs.getOfficialBySlug, { slug });
}

