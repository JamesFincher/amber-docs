export type TemplateField = {
  key: string;
  label: string;
  placeholder: string;
};

export type TemplateSection = {
  title: string;
  optional?: boolean;
};

export type DocTemplate = {
  id: string;
  name: string;
  description: string;
  tags: string[];
  requiredFields: TemplateField[];
  sections: TemplateSection[];
};

export type SectionPrompt = {
  section: string;
  prompt: string;
};

export function resolveSections(template: DocTemplate, enabledOptional: Set<string>): string[] {
  return template.sections
    .filter((s) => !s.optional || enabledOptional.has(s.title))
    .map((s) => s.title);
}

function renderFields(template: DocTemplate, inputValues: Record<string, string>): string {
  return template.requiredFields
    .map((field) => `${field.label}: ${inputValues[field.key] || "<fill this>"}`)
    .join("\n");
}

function renderSectionList(sections: string[]): string {
  return sections.map((section, idx) => `${idx + 1}. ${section}`).join("\n");
}

export function buildPrompt(args: {
  template: DocTemplate;
  inputValues: Record<string, string>;
  topic: string;
  enabledOptional: Set<string>;
}): string {
  const fields = renderFields(args.template, args.inputValues);
  const sectionList = renderSectionList(resolveSections(args.template, args.enabledOptional));

  return `You are an expert documentation strategist.

Create a ${args.template.name} document for: ${args.topic || "<topic>"}

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

export function buildSectionPromptPack(args: {
  template: DocTemplate;
  inputValues: Record<string, string>;
  topic: string;
  enabledOptional: Set<string>;
}): SectionPrompt[] {
  const fields = renderFields(args.template, args.inputValues);
  const sections = resolveSections(args.template, args.enabledOptional);
  const outline = renderSectionList(sections);
  const name = args.template.name;

  return sections.map((section) => ({
    section,
    prompt: `You are drafting a ${name}.

Topic: ${args.topic || "<topic>"}

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

export function buildMarkdownSkeleton(args: {
  template: DocTemplate;
  inputValues: Record<string, string>;
  topic: string;
  enabledOptional: Set<string>;
}): string {
  const header = `# ${args.topic || "Untitled"} (${args.template.name})`;

  const metadata = args.template.requiredFields
    .map((field) => `- **${field.label}:** ${args.inputValues[field.key] || "TBD"}`)
    .join("\n");

  const sections = resolveSections(args.template, args.enabledOptional)
    .map((section) => `## ${section}\n\n_TODO: add content._`)
    .join("\n\n");

  return `${header}\n\n## Metadata\n${metadata}\n\n${sections}\n`;
}

