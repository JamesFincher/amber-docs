import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

export type SynonymsMap = Record<string, string[]>;

const SynonymsSchema = z.record(z.string(), z.array(z.string().min(1)));

function contentRoot() {
  return process.env.AMBER_DOCS_CONTENT_DIR ?? path.join(process.cwd(), "content");
}

export function loadSynonyms(): SynonymsMap {
  const file = path.join(contentRoot(), "search", "synonyms.json");
  if (!fs.existsSync(file)) return {};
  const raw = fs.readFileSync(file, "utf8");
  const data = JSON.parse(raw) as unknown;
  return SynonymsSchema.parse(data);
}
