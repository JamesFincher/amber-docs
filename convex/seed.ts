import { internalMutation } from "./_generated/server";

export const ensureSeedData = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("docs").collect();
    if (existing.length > 0) return { created: 0 };

    const t = Date.now();
    const docId = await ctx.db.insert("docs", {
      slug: "executive-summary",
      title: "Executive Summary",
      createdAt: t,
      updatedAt: t,
      archived: false,
    });

    const markdown = `# Executive Summary

## Problem
Write the problem statement in 3-6 bullets. Keep it measurable.

## Solution
What are we building? Who is it for? Why now?

## Value
Impact, ROI, and why it matters to the business.

## Risks
Key risks and mitigations.

## Decisions Needed
What needs approval, by when, and who owns it?
`;

    const revisionId = await ctx.db.insert("revisions", {
      docId,
      number: 1,
      createdAt: t,
      markdown,
      message: "Seed executive summary template",
    });

    await ctx.db.patch(docId, {
      draftRevisionId: revisionId,
      updatedAt: t,
    });

    return { created: 1 };
  },
});
