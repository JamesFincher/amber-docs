import { loadDisclaimers, loadGlossary } from "@/lib/content/blocks.server";
import { BlocksClient } from "./blocks-client";

export const metadata = {
  title: "Blocks | Amber Protocol",
  description: "Reusable snippet library (disclaimers, glossary, standard callouts).",
};

export default function BlocksPage() {
  const disclaimers = loadDisclaimers();
  const glossary = loadGlossary();
  return <BlocksClient disclaimers={disclaimers} glossary={glossary} />;
}

