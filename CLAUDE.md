# CLAUDE.md — Amber Docs

## Project Overview

Amber Docs is a static-first, AI-native documentation platform built with Next.js. It serves as a docs-first operating system for internal strategy and public communication. The site exports as pure HTML via `next build` with `output: "export"` and deploys to Cloudflare Pages.

## Tech Stack

- **Framework**: Next.js 16 (App Router, static export, React Compiler enabled)
- **Runtime**: React 19, TypeScript (strict mode)
- **Styling**: TailwindCSS 4 with `@tailwindcss/typography`
- **Backend**: Convex.dev (serverless DB with docs/revisions/notes tables)
- **AI**: Google Gemini (client-side, API key entered in UI)
- **Search**: Fuse.js (client-side fuzzy search, build-time index)
- **Markdown**: gray-matter (frontmatter), react-markdown, remark-gfm, rehype-raw/sanitize
- **Validation**: Zod schemas
- **Package manager**: pnpm (v10)
- **Node version**: 20

## Quick Reference Commands

```bash
pnpm dev              # Start Next.js + Convex dev servers concurrently
pnpm build            # QA checks -> Next.js build -> perf budget check
pnpm build:public     # Same as build, but filters to official+public docs only
pnpm test             # Run Vitest test suite (single run)
pnpm test:watch       # Run Vitest in watch mode
pnpm coverage         # Run tests with V8 coverage
pnpm lint             # ESLint (v9 flat config)
pnpm typecheck        # TypeScript check (tsc --noEmit)
pnpm qa               # Content QA (frontmatter, links, heading structure)
pnpm perf:budget      # Performance budget validation
```

### Doc Lifecycle CLI

```bash
pnpm docs:new         # Create a new doc
pnpm docs:clone       # Clone an existing doc as a new version
pnpm docs:update      # Update doc metadata
pnpm docs:publish     # Un-archive a doc
pnpm docs:unpublish   # Archive a doc (set archived: true)
pnpm docs:finalize    # Move stage from draft -> final
pnpm docs:official    # Move stage from final -> official
pnpm docs:delete      # Delete a specific doc version
```

## Project Structure

```
src/
  app/                  # Next.js App Router pages and route handlers
    docs/               # Doc viewer pages
    studio/             # Editor/studio UI
    assistant/          # AI assistant page
    templates/          # Template browser
    blocks/             # Reusable text blocks browser
    help/               # Help page
    docs.json/          # Static JSON API (versioned doc index)
    search-index.json/  # Static search index
    chunks.json/        # RAG-friendly doc chunks
    claims.json/        # Extracted fact claims
    embeddings-manifest.json/  # Content hashes for sync pipelines
    raw/[slug]/         # Raw markdown endpoint
    updates.json/       # Recent updates feed
    synonyms.json/      # Search synonyms
  lib/
    docs.ts             # Core types: DocRecord, DocStage, DocVisibility
    markdown.ts         # TOC extraction, search text, section parsing
    slugger.ts          # GitHub-style heading slug generation
    templates.ts        # Template loading/rendering
    content/
      docs.server.ts    # File-based doc loader (the backbone of static export)
      docsWorkflow.server.ts  # Doc lifecycle operations (create/update/delete/publish)
      blocks.server.ts  # Reusable text block loader
      search.ts         # Search synonym loader
    ai/                 # Gemini integration, draft linting, text diffing
    qa/                 # Content QA validations
    studio/             # File import/export utilities
  components/           # React UI components
content/
  docs/                 # Markdown source files (the canonical doc store)
  templates/            # JSON template definitions
  blocks/               # Reusable text snippets (glossary, disclaimers)
  search/               # Search synonyms
convex/                 # Convex backend (schema, queries, mutations, HTTP)
scripts/                # CLI utilities (QA, workflow, perf budget, webhooks)
tests/                  # Vitest test suites
```

## Architecture Decisions

### Static Export

All pages are pre-rendered at build time (`output: "export"`). There is no server-side rendering in production. API routes become static JSON files. This means:

- All data must be available at build time
- No `getServerSideProps` or server actions
- Route handlers use `export const dynamic = "force-static"`

### File-Based Content

Docs live as markdown files in `content/docs/`. The file-based loader in `src/lib/content/docs.server.ts` is the source of truth for the static build. Frontmatter is validated with Zod. The Convex database is used for the studio/editor UI, not for the static export.

### Audience Filtering

Docs have a `visibility` field (`public | internal | private`). At build time, the `AMBER_DOCS_AUDIENCE` and `AMBER_DOCS_PUBLIC_EXPORT` env vars control which docs appear. Markdown content can use `<!-- audience:internal:start -->` / `<!-- audience:internal:end -->` comment blocks for inline redaction.

## Content Conventions

### Frontmatter (Required Fields)

```yaml
slug: unique-identifier        # URL-safe, kebab-case
title: "Document Title"
stage: draft | final | official
summary: "One-line summary"
updatedAt: "2026-02-07"        # ISO date string
```

### Frontmatter (Common Optional Fields)

```yaml
version: "2026-02-07"          # Defaults to updatedAt if omitted
visibility: public | internal | private  # Default: public
archived: true                  # Hides from all views/exports
owners: ["Protocol Lead"]
topics: ["overview", "strategy"]
collection: "Foundations"       # Groups docs in reading lists
order: 1                        # Sort order within collection
lastReviewedAt: "2026-02-07"   # Triggers "needs review" if >90 days old
aiChecks: [...]                 # AI verification checklist items
relatedSlugs: [...]             # Links to other docs by slug
citations: [{ label, url? }]
approvals: [{ name, date }]
audit: [{ at, action, actor?, note?, fromStage?, toStage? }]
```

### Doc Lifecycle

Docs progress through stages: **Draft** -> **Final** -> **Official**. Only `official` docs appear in public builds (`build:public`). Setting `archived: true` removes a doc from all views without deleting the file.

### Markdown Rules

- Use H2 (`##`) and H3 (`###`) headings only; H1 is auto-generated from `title`
- Heading IDs are auto-generated with a GitHub-style slugger
- Links to other docs: `[text](/docs/slug)` or `[text](/raw/slug)`
- Support for GFM tables, strikethrough, raw HTML (sanitized)
- Versioned filenames: `{slug}-v{version}.md` or `{slug}.md`

## Testing

**Framework**: Vitest with jsdom for DOM tests.

Tests are in the `tests/` directory, mirroring the `src/` structure:

```
tests/
  ai/          # Gemini integration, draft linting, workspace tools
  content/     # Doc loaders, audience filtering, collections, workflow
  qa/          # Content QA validation
  routes/      # API endpoint output
  security/    # Secret scanning
  *.test.ts    # Utility and component tests
```

**Patterns**:
- File-based tests use temp directories via `AMBER_DOCS_CONTENT_DIR` env var
- Gemini API calls are mocked
- DOM tests use jsdom environment
- Tests clean up in `afterEach`

**Coverage** excludes: components, page/layout files, generated code, convex.

Run tests before any PR or merge — CI runs `pnpm test` then `pnpm build:public`.

## Linting & Type Checking

- **ESLint 9** (flat config): Next.js core-web-vitals + TypeScript + jsx-a11y
- **TypeScript**: Strict mode, path alias `@/*` -> `./src/*`
- The `react-hooks/set-state-in-effect` rule is intentionally disabled (localStorage hydration in effects)
- ESLint ignores: `.next/`, `out/`, `convex/_generated/`

## CI/CD

### Deploy Pipeline (`.github/workflows/deploy-cloudflare-pages.yml`)

Triggers on push to `main`/`work`, PRs, and manual dispatch:

1. `pnpm install --frozen-lockfile`
2. `pnpm test`
3. `pnpm build:public`
4. Deploy to Cloudflare Pages via wrangler
5. Comment preview URL on PRs (`pr-{number}.amber-docs.pages.dev`)

### Security Pipeline (`.github/workflows/security.yml`)

Runs on push/PR + weekly schedule:
- `pnpm audit --audit-level high`
- gitleaks secret scanning

## Environment Variables

See `.env.example` for all options. Key variables:

| Variable | Purpose |
|----------|---------|
| `CONVEX_DEPLOYMENT` | Convex backend deployment name |
| `NEXT_PUBLIC_CONVEX_URL` | Convex client URL |
| `NEXT_PUBLIC_GEMINI_DEFAULT_MODEL` | Default Gemini model (e.g., `gemini-3-flash`) |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Admin UI gate |
| `DOCS_WRITE_SECRET` | Shared secret for write operations |
| `AMBER_DOCS_CONTENT_DIR` | Override content directory (used by tests) |
| `AMBER_DOCS_AUDIENCE` | Build audience filter: `public`, `internal`, `private` |
| `AMBER_DOCS_PUBLIC_EXPORT` | Set to `1` for public-only official doc export |

**Never commit `.env` files or real secrets.** CI uses GitHub Actions secrets.

## Code Patterns

### Path Alias

Use `@/` for imports from `src/`:
```ts
import { DocRecord } from "@/lib/docs";
```

### Server vs Client Components

- Default to server components
- Add `"use client"` only for interactive features (studio, templates, assistant)
- Route handlers are all `force-static`

### Type Definitions

Core types are in `src/lib/docs.ts`. The `DocRecord` type is the central data structure representing a parsed document with frontmatter, derived fields (TOC, search text, content hash), and source path.

### Content Loading

`src/lib/content/docs.server.ts` loads all markdown from `content/docs/`, validates frontmatter with Zod, and caches results. The cache is keyed by `contentRoot()` so tests can point at fixture directories.

### Convex Database

Schema in `convex/schema.ts` — three tables: `docs`, `revisions`, `notes`. Uses pointer-style workflow (draft/final/official revision IDs on the doc record). Convex is for the editor UI; the static build reads only from the filesystem.

## Important Notes for AI Assistants

1. **Build chain**: `pnpm build` = QA + Next.js build + perf budget. Always run the full chain to verify changes.
2. **Static only**: No server-side rendering. Don't add `getServerSideProps`, server actions, or dynamic route handlers.
3. **Content in files**: The filesystem (`content/docs/*.md`) is the source of truth for the static site, not the database.
4. **Frontmatter validation**: All frontmatter is Zod-validated. Invalid frontmatter breaks the build.
5. **Test before committing**: Run `pnpm test` and `pnpm typecheck` before any commit.
6. **Accessibility**: The project uses jsx-a11y rules. Maintain semantic HTML, ARIA labels, and skip links.
7. **No image optimization**: Images are unoptimized (`images.unoptimized: true`) for static export compatibility.
8. **Turbopack**: Dev server uses Turbopack. If you encounter dev-only issues, check Turbopack compatibility.
