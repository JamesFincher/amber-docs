import { loadDisclaimers, loadGlossary } from "@/lib/content/blocks.server";
import { loadTemplates } from "@/lib/content/templates.server";
import { AiAssistantClient } from "@/components/AiAssistantClient";

export const metadata = {
  title: "Ask AI | Amber Protocol",
  description: "Use Google AI (Gemini) with internal docs context to draft or improve documents.",
};

export default function AssistantPage() {
  const disclaimers = loadDisclaimers();
  const glossary = loadGlossary();
  const templates = loadTemplates();
  return <AiAssistantClient disclaimers={disclaimers} glossary={glossary} templates={templates} />;
}
