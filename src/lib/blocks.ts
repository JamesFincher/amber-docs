export type Snippet = {
  id: string;
  title: string;
  body: string;
};

export type GlossaryEntry = {
  term: string;
  definition: string;
};

export const disclaimers: Snippet[] = [
  {
    id: "not-financial-advice",
    title: "Not Financial Advice",
    body:
      "This documentation is provided for informational purposes only and does not constitute financial, legal, or tax advice.",
  },
  {
    id: "no-warranty",
    title: "No Warranty",
    body:
      "This documentation is provided \"as is\" without warranties of any kind, express or implied. Use at your own risk.",
  },
];

export const glossary: GlossaryEntry[] = [
  {
    term: "Official",
    definition: "Content that represents the current published stance and is safe to rely on publicly.",
  },
  {
    term: "Final",
    definition: "Content that is near-ready but may still change; review is largely complete.",
  },
  {
    term: "Draft",
    definition: "Work-in-progress content; not yet approved for external reliance.",
  },
];

