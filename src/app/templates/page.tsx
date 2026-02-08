import { loadTemplates } from "@/lib/content/templates.server";
import { TemplatesClient } from "./templates-client";

export const metadata = {
  title: "Templates | Amber Docs",
  description: "Create a new document using a template (with copyable prompts and scaffolds).",
};

export default function TemplatesPage() {
  const templates = loadTemplates();
  return <TemplatesClient templates={templates} />;
}
