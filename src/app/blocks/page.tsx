import { loadDisclaimers, loadGlossary } from "@/lib/content/blocks.server";
import { BlocksClient } from "./blocks-client";

export const metadata = {
  title: "Reusable text | Amber Protocol",
  description: "Copy standard disclaimers and glossary definitions (and save custom ones locally).",
};

export default function BlocksPage() {
  const disclaimers = loadDisclaimers();
  const glossary = loadGlossary();
  return <BlocksClient disclaimers={disclaimers} glossary={glossary} />;
}
