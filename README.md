# Amber Protocol Docs

Public documentation workspace for Amber Protocol, designed for human readers and AI consumption.

## Product surface

- `/` — Product landing page for the docs workspace
- `/docs` — Documentation library with lifecycle stage badges (Draft / Final / Official)
- `/docs/[slug]` — Latest doc version (AI checks, notes, feedback, related context)
- `/docs/[slug]/v/[version]` — Pinned historical doc version
- `/docs/[slug]/diff` — Diff viewer between doc versions
- `/paths` — Collections + recommended reading paths (breadcrumbs + prev/next)
- `/templates` — Template tool (prompt pack + markdown scaffold + optional sections)
- `/blocks` — Blocks library (disclaimers + glossary + local custom blocks)

### Machine endpoints (integrators)

- `/docs.json` — Versioned docs index (schema version + content hashes)
- `/search-index.json` — Build-time search index used by the UI
- `/chunks.json` — Chunked docs export with stable chunk IDs (RAG-friendly)
- `/embeddings-manifest.json` — Doc + chunk content hashes (sync pipelines)
- `/updates.json` — Pollable build ID + latest doc hashes
- `/claims.json` — Lightweight extracted number/date claims per doc
- `/raw/[slug]` — Raw markdown for the latest version
- `/raw/v/[slug]/[version]` — Raw markdown for a pinned version


## Content model

- Docs live in `content/docs/*.md` (YAML frontmatter + markdown body).
- Templates live in `content/templates/*.json`.
- Blocks (disclaimers + glossary) live in `content/blocks/*.json`.
- Search synonyms live in `content/search/synonyms.json`.

## Template tool

The template tool lets you standardize document structures across teams.

1. Pick a template type (executive brief, launch note, partner announcement).
2. Fill required metadata fields.
3. Copy the generated AI prompt to Claude/OpenAI/Kimi.
4. Copy the markdown scaffold back into your docs workflow.

This keeps doc shapes consistent while still allowing model-assisted drafting.

## Quick start

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000.

## Content QA (CI gate)

```bash
pnpm qa
```

`pnpm build` runs QA automatically (frontmatter schema, internal links, assets, Official gates, external links).

## Deployment (Cloudflare Pages)

This project is configured as a static Next.js export for easy Cloudflare Pages hosting.

### One-time Cloudflare setup

1. Create a Cloudflare Pages project named **`amber-docs`**.
2. Set your custom domain to **`docs.amberprotocol.org`** in Pages → Custom domains.
3. Ensure the `amberprotocol.org` DNS zone is in Cloudflare.

### Deploy from local machine

```bash
pnpm deploy:cloudflare
```

This runs:

- `pnpm build` (produces static `out/`)
- `wrangler pages deploy out --project-name amber-docs`

### Deploy from GitHub Actions

A workflow is included at `.github/workflows/deploy-cloudflare-pages.yml`.

Add these GitHub repo secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Then pushing to `main` or `work` triggers deployment automatically.

Optional secrets (webhooks):

- `DOCS_WEBHOOK_URL`
- `DOCS_WEBHOOK_SECRET`

## Convex

Convex schema and functions are in `convex/`. Start local Convex dev server with:

```bash
npx convex dev
```
