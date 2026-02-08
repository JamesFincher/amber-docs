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
- [x] Native generation with Google AI (Gemini) on Templates page
- [x] Reusable snippet library page (`/blocks`) with disclaimers/glossary stubs
- [x] Write + publish UI (`/studio`) for file creation/editing and lifecycle operations
- [x] Doc workflow CLI scripts (`pnpm docs:*`) for create/clone/update/publish/unpublish/finalize/official/delete

## Review + Trust
- [x] Doc-level AI checks displayed
- [x] Citations-present badge (based on metadata)

## Operations / QA
- [x] Content QA script: duplicate slugs
- [x] Content QA script: internal link validation
- [x] Content QA script: required metadata rules by stage
- [x] Content QA script: heading structure sanity checks
- [x] Unpublished (archived) docs ignored by QA and excluded app-wide
- [x] Wire QA into `pnpm build`
- [x] CI passes: `pnpm lint`, `pnpm typecheck`, `pnpm build`

---

## Build-Out (vNext)

These are the next features implied by the “Build-Out vNext” section in `PRODUCT_MINDMAP.md`.

### Reader Experience
- [x] Information architecture: collections/series + reading paths
- [x] Breadcrumbs + prev/next navigation
- [x] Search v2: build-time index + fuzzy matching (+ optional synonyms)
- [x] Doc versioning: version selector + “latest” alias
- [x] Doc-to-doc diffs (between versions)
- [x] Feedback widget (helpful/unhelpful + report issue)
- [x] Bookmarks / saved searches

### Writing System
- [x] File-based docs source (move docs out of `src/lib/docs.ts`)
- [x] Frontmatter schema validation (stage/owners/reviewedAt/topics/citations/approvals)
- [x] Assets pipeline (images/diagrams)
- [x] MDX support (optional) (safe HTML support via markdown renderer; `.mdx` files supported)
- [x] Template authoring: schema-driven templates + optional/conditional sections
- [x] Template sharing: team registry + export/import
- [x] Blocks: tags + search + custom blocks

### Review + Trust
- [x] Promotion gates: Draft→Final→Official with required approvals
- [x] Revision history UI + diff view (doc + per-section diffs)
- [x] Inline comments/notes with resolved state
- [x] Automated claim extraction (numbers/entities) + citation-required policy
- [x] Terminology enforcement against glossary
- [x] External link validation in CI (timeouts + redirects)
- [x] Contradiction scans vs canonical docs (optional) (canonical + `facts` frontmatter QA)

### Integrator Experience
- [x] Versioned `docs.json` schema (documented contract)
- [x] ETag/Last-Modified for `docs.json` and `raw/*`
- [x] Chunked export for RAG (stable chunk IDs)
- [x] Embeddings manifest (hashes + update diffs)
- [x] Webhooks for doc updates (signed payloads)

### Operations / QA
- [x] PR preview deploys (Cloudflare Pages) + preview URL comment
- [x] Build performance budgets + caching strategy (`public/_headers` + `pnpm perf:budget`)
- [x] Security: secret scanning + dependency auditing
- [x] Accessibility checks (CI) + keyboard navigation QA
- [x] Analytics (privacy-safe) + error tracking (client + 404s)

### Security/Admin (If/When Hybrid)
- [x] Private docs with auth + roles + redaction rules (audience/visibility + redaction markers; deploy-level auth recommended)
- [x] Audit log for promotions/approvals (frontmatter `audit` + UI display)
- [x] Export public site from approved-only content (`pnpm build:public`)
