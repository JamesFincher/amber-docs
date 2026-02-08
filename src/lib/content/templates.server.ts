import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { DocTemplate } from "../templates";

const TemplateFieldSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  placeholder: z.string().min(1),
});

const TemplateSectionSchema = z.object({
  title: z.string().min(1),
  optional: z.boolean().optional(),
});

const DocTemplateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  tags: z.array(z.string().min(1)).optional(),
  requiredFields: z.array(TemplateFieldSchema),
  sections: z.array(TemplateSectionSchema),
});

function contentRoot() {
  return process.env.AMBER_DOCS_CONTENT_DIR ?? path.join(process.cwd(), "content");
}

function templatesDir() {
  return path.join(contentRoot(), "templates");
}

export function loadTemplates(): DocTemplate[] {
  const dir = templatesDir();
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));

  const out: DocTemplate[] = [];
  for (const f of files) {
    const raw = fs.readFileSync(path.join(dir, f), "utf8");
    const data = JSON.parse(raw) as unknown;
    const t = DocTemplateSchema.parse(data);
    out.push({
      ...t,
      tags: t.tags ?? [],
    });
  }

  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}
