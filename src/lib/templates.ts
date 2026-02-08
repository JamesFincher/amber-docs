export type TemplateField = {
  key: string;
  label: string;
  placeholder: string;
};

export type DocTemplate = {
  id: string;
  name: string;
  description: string;
  sections: string[];
  requiredFields: TemplateField[];
};

export const docTemplates: DocTemplate[] = [
  {
    id: "executive-brief",
    name: "Executive Brief",
    description: "Leadership summary with crisp strategy, outcomes, risks, and decisions.",
    sections: [
      "Context",
      "Strategic objective",
      "Key facts",
      "Risks and mitigations",
      "Decision required",
      "Next 30/60/90 day plan",
    ],
    requiredFields: [
      { key: "audience", label: "Audience", placeholder: "Executive team" },
      { key: "timeframe", label: "Timeframe", placeholder: "Q2 2026" },
      { key: "decision", label: "Decision Needed", placeholder: "Approve launch scope" },
    ],
  },
  {
    id: "product-launch",
    name: "Product Launch Note",
    description: "Cross-functional launch template for product, GTM, and support alignment.",
    sections: [
      "Launch summary",
      "User value",
      "Scope and non-goals",
      "Operational checklist",
      "Metrics and monitoring",
      "FAQ",
    ],
    requiredFields: [
      { key: "targetUser", label: "Target User", placeholder: "Protocol integrations team" },
      { key: "launchDate", label: "Launch Date", placeholder: "2026-03-15" },
      { key: "successMetric", label: "Primary Success Metric", placeholder: "Activation rate" },
    ],
  },
  {
    id: "partner-announcement",
    name: "Partner Announcement",
    description: "Public communication structure with legal and factual guardrails.",
    sections: [
      "Headline",
      "Announcement summary",
      "What is launching",
      "Why this matters",
      "Quotes",
      "Fact-check checklist",
    ],
    requiredFields: [
      { key: "partner", label: "Partner Name", placeholder: "Example Labs" },
      { key: "legalName", label: "Legal Entity", placeholder: "Example Labs, Inc." },
      { key: "publishDate", label: "Publish Date", placeholder: "2026-04-02" },
    ],
  },
];

export function buildPrompt(template: DocTemplate, inputValues: Record<string, string>, topic: string): string {
  const fields = template.requiredFields
    .map((field) => `${field.label}: ${inputValues[field.key] || "<fill this>"}`)
    .join("\n");

  const sectionList = template.sections.map((section, idx) => `${idx + 1}. ${section}`).join("\n");

  return `You are an expert documentation strategist.

Create a ${template.name} document for: ${topic || "<topic>"}

Requirements:
${fields}

Return markdown with exactly these sections:
${sectionList}

Quality bar:
- Keep claims concrete and verifiable.
- Include assumptions explicitly.
- Flag open questions and unresolved risks.
- Keep style concise and decision-oriented.
`;
}

export function buildMarkdownSkeleton(template: DocTemplate, inputValues: Record<string, string>, topic: string): string {
  const header = `# ${topic || "Untitled"} (${template.name})`;

  const metadata = template.requiredFields
    .map((field) => `- **${field.label}:** ${inputValues[field.key] || "TBD"}`)
    .join("\n");

  const sections = template.sections.map((section) => `## ${section}\n\n_TODO: add content._`).join("\n\n");

  return `${header}\n\n## Metadata\n${metadata}\n\n${sections}\n`;
}
