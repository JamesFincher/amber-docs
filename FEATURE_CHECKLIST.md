# Feature Build Checklist

This checklist tracks implementation of the features described in `PRODUCT_MINDMAP.md`.

## Reader Experience
- [x] Search docs (title + summary + markdown)
- [x] Highlight search matches in results
- [x] Browse filters: stage
- [x] Browse filters: topics/tags
- [x] Sort docs (updated date)
- [x] Show freshness metadata (updated, last reviewed, owners)
- [x] "Needs review" badge when missing/stale last reviewed
- [x] Doc table of contents (H2/H3)
- [x] Stable anchors for headings + per-section permalinks
- [x] Copy raw markdown button
- [x] Related docs section

## Integrator Experience
- [x] Machine-readable docs index endpoint (`/docs.json`)
- [x] Stable raw markdown endpoint (`/raw/[slug]`)
- [x] Predictable caching headers for raw endpoint

## Writing System
- [x] Template outputs: single-shot prompt
- [x] Template outputs: markdown scaffold
- [x] Template outputs: section-by-section prompt pack (rewrite/fact-check/consistency)
- [x] Copy buttons for template outputs
- [x] Reusable snippet library page (`/blocks`) with disclaimers/glossary stubs

## Review + Trust
- [x] Doc-level AI checks displayed
- [x] Citations-present badge (based on metadata)

## Operations / QA
- [x] Content QA script: duplicate slugs
- [x] Content QA script: internal link validation
- [x] Content QA script: required metadata rules by stage
- [x] Content QA script: heading structure sanity checks
- [x] Wire QA into `pnpm build`
- [x] CI passes: `pnpm lint`, `pnpm typecheck`, `pnpm build`
