import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

export type Snippet = {
  id: string;
  title: string;
  body: string;
  tags: string[];
};

export type GlossaryEntry = {
  term: string;
  definition: string;
  synonyms: string[];
  tags: string[];
};

const SnippetSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
  tags: z.array(z.string().min(1)).optional(),
});

const GlossaryEntrySchema = z.object({
  term: z.string().min(1),
  definition: z.string().min(1),
  synonyms: z.array(z.string().min(1)).optional(),
  tags: z.array(z.string().min(1)).optional(),
});

function contentRoot() {
  return path.join(process.cwd(), "content");
}

function readJsonFile(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
}

export function loadDisclaimers(): Snippet[] {
  const file = path.join(contentRoot(), "blocks", "disclaimers.json");
  const data = readJsonFile(file);
  const arr = z.array(SnippetSchema).parse(data);
  return arr.map((s) => ({ ...s, tags: s.tags ?? [] }));
}

export function loadGlossary(): GlossaryEntry[] {
  const file = path.join(contentRoot(), "blocks", "glossary.json");
  const data = readJsonFile(file);
  const arr = z.array(GlossaryEntrySchema).parse(data);
  return arr.map((g) => ({ ...g, synonyms: g.synonyms ?? [], tags: g.tags ?? [] }));
}

