import { loadSynonyms } from "@/lib/content/search.server";

export const dynamic = "force-static";

export function GET() {
  const synonyms = loadSynonyms();
  return Response.json(synonyms, {
    headers: {
      "cache-control": "public, max-age=3600",
    },
  });
}

