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

export type SectionPrompt = {
  section: string;
  prompt: string;
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

function renderFields(template: DocTemplate, inputValues: Record<string, string>): string {
  return template.requiredFields
    .map((field) => `${field.label}: ${inputValues[field.key] || "<fill this>"}`)
    .join("\n");
}

function renderSectionList(template: DocTemplate): string {
  return template.sections.map((section, idx) => `${idx + 1}. ${section}`).join("\n");
}

export function buildPrompt(template: DocTemplate, inputValues: Record<string, string>, topic: string): string {
  const fields = renderFields(template, inputValues);
  const sectionList = renderSectionList(template);

  return `You are an expert documentation strategist.

Create a ${template.name} document for: ${topic || "<topic>"}

Requirements:
${fields}

Return markdown with exactly these sections:
${sectionList}

Quality bar:
- Keep claims concrete and verifiable.
- Do not invent facts. If something is unknown, say so.
- For every number/date/name that matters, add a "(SOURCE NEEDED: ...)" note.
- Include assumptions explicitly.
- Flag open questions and unresolved risks.
- Keep style concise and decision-oriented.
`;
}

export function buildSectionPromptPack(
  template: DocTemplate,
  inputValues: Record<string, string>,
  topic: string,
): SectionPrompt[] {
  const fields = renderFields(template, inputValues);
  const outline = renderSectionList(template);
  const name = template.name;

  return template.sections.map((section) => ({
    section,
    prompt: `You are drafting a ${name}.

Topic: ${topic || "<topic>"}

Requirements:
${fields}

Full outline (do not change section names):
${outline}

Task:
- Write ONLY the section titled "${section}" as Markdown under a "## ${section}" heading.
- Keep it concise and decision-oriented.
- Do not invent facts. If unknown, state what's missing.
- Extract concrete claims and add "(SOURCE NEEDED: ...)" after each claim that needs verification.
- End with an "Open questions" bullet list if anything blocks completion.
`,
  }));
}

export function buildMarkdownSkeleton(template: DocTemplate, inputValues: Record<string, string>, topic: string): string {
  const header = `# ${topic || "Untitled"} (${template.name})`;

  const metadata = template.requiredFields
    .map((field) => `- **${field.label}:** ${inputValues[field.key] || "TBD"}`)
    .join("\n");

  const sections = template.sections.map((section) => `## ${section}\n\n_TODO: add content._`).join("\n\n");

  return `${header}\n\n## Metadata\n${metadata}\n\n${sections}\n`;
}
