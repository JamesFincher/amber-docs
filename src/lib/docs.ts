export type DocStage = "draft" | "final" | "official";

export type DocRecord = {
  slug: string;
  title: string;
  stage: DocStage;
  updatedAt: string;
  summary: string;
  markdown: string;
  aiChecks: string[];
  relatedContext: string[];
};

export const docs: DocRecord[] = [
  {
    slug: "executive-summary",
    title: "Executive Summary",
    stage: "official",
    updatedAt: "2026-02-07",
    summary:
      "Top-level narrative for Amber Protocol, including the mission, product direction, and strategic priorities.",
    aiChecks: [
      "Cross-check KPI claims against quarterly metrics sheet",
      "Verify roadmap dates against product calendar",
      "Scan for unsupported factual claims",
    ],
    relatedContext: ["Product roadmap", "Token economics memo", "Security posture brief"],
    markdown: `# Executive Summary

Amber Protocol provides a **docs-first operating system** for internal strategy and public communication.

## What is official right now

- Public docs are readable by humans and AI systems.
- Draft content can be promoted through **Draft → Final → Official**.
- Notes and AI review prompts are tracked with each doc lifecycle.

## Business goals (current quarter)

1. Publish a complete public docs baseline.
2. Reduce ambiguity in strategy communication.
3. Improve fact-check speed with AI-assisted review loops.
`,
  },
  {
    slug: "ai-review-workflow",
    title: "AI Review Workflow",
    stage: "final",
    updatedAt: "2026-02-06",
    summary:
      "Standard process for brainstorming, fact-checking, and consistency checks across Claude, OpenAI, Kimi, and internal context.",
    aiChecks: [
      "Compare model outputs and collect disagreements",
      "Require citation placeholders for all numeric statements",
      "Generate contradiction report before promotion",
    ],
    relatedContext: ["Prompt library", "Compliance checklist", "Style guide"],
    markdown: `# AI Review Workflow

Use this workflow before promoting a doc to **Official**.

## Step 1: Break down sections

- Convert executive summary into atomic sections.
- Assign one verification prompt per section.

## Step 2: Multi-model review

- Run prompts across multiple models.
- Capture points of disagreement.

## Step 3: Promotion gate

A document can be promoted when:

- factual claims have corroboration,
- unresolved contradictions are closed,
- changelog message is complete.
`,
  },
  {
    slug: "partner-announcement-template",
    title: "Partner Announcement Template",
    stage: "draft",
    updatedAt: "2026-02-05",
    summary:
      "Reusable markdown template for partnership announcements with legal, factual, and narrative checkpoints.",
    aiChecks: [
      "Validate partner naming/legal entities",
      "Check quote attribution accuracy",
      "Confirm launch dates and timezone handling",
    ],
    relatedContext: ["PR style guide", "Legal approval SOP"],
    markdown: `# Partner Announcement Template

> Draft template for external announcements.

## Headline

Clear, specific, and verifiable.

## Body

- What was launched
- Why it matters
- What users should do next

## Final checks

- Legal approval
- Technical accuracy
- Link integrity
`,
  },
];

export function getDocBySlug(slug: string): DocRecord | undefined {
  return docs.find((doc) => doc.slug === slug);
}

export function stageBadgeClass(stage: DocStage): string {
  switch (stage) {
    case "draft":
      return "bg-amber-100 text-amber-800";
    case "final":
      return "bg-blue-100 text-blue-800";
    case "official":
      return "bg-emerald-100 text-emerald-800";
  }
}
