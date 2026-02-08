---
slug: ai-review-workflow
version: "2026-02-06"
title: "AI Review Workflow"
stage: final
summary: "Standard process for brainstorming, fact-checking, and consistency checks across Claude, OpenAI, Kimi, and internal context."
updatedAt: "2026-02-06"
lastReviewedAt: "2026-02-06"
owners:
  - "Docs Maintainer"
topics:
  - process
  - ai
collection: "Foundations"
order: 2
aiChecks:
  - "Compare model outputs and collect disagreements"
  - "Require citation placeholders for all numeric statements"
  - "Generate contradiction report before promotion"
relatedContext:
  - "Prompt library"
  - "Compliance checklist"
  - "Style guide"
relatedSlugs:
  - "executive-summary"
citations:
  - label: "Prompt library (internal)"
---

# AI Review Workflow

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

