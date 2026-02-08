import { loadTemplates } from "@/lib/content/templates.server";
import { TemplatesClient } from "./templates-client";

export const metadata = {
  title: "Templates | Amber Protocol",
  description: "Generate reusable, uniform doc shapes and AI-ready prompts.",
};

export default function TemplatesPage() {
  const templates = loadTemplates();
  return <TemplatesClient templates={templates} />;
}

