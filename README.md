# Amber Protocol Docs

Public documentation workspace for Amber Protocol, designed for human readers and AI consumption.

## Product surface

- `/` — Product landing page for the docs workspace
- `/docs` — Documentation library with lifecycle stage badges (Draft / Final / Official)
- `/docs/[slug]` — Individual markdown docs with AI checks and related context
- `/docs.json` — Machine-readable index of docs metadata (for integrators)
- `/templates` — Reusable template builder that outputs AI prompts + markdown scaffolds
- `/blocks` — Reusable snippet library (disclaimers + glossary)


## Template tool (new)

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

`pnpm build` runs QA automatically (duplicate slugs, internal links, required metadata rules).

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

## Convex

Convex schema and functions are in `convex/`. Start local Convex dev server with:

```bash
npx convex dev
```
