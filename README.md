# Amber Docs

Markdown-first company documentation with:
- draft → final → official publishing
- immutable revisions
- per-doc notes
- AI prompt packs (copy/paste into Claude, OpenAI, Kimi, etc.)
- public rendered docs + public raw Markdown endpoints

## Stack

- Next.js (App Router) for UI + public site
- Convex for storage + versioning/workflows
- Markdown rendering via `react-markdown` (GFM) + sanitization

## Routes

- Public docs:
  - `/docs` (list official)
  - `/docs/[slug]` (render official)
  - `/raw/[slug]` (official Markdown, best for AI + copy/paste)
- Admin/editor:
  - `/admin`
  - `/admin/[slug]`

## Local Dev

```bash
pnpm install
pnpm convex dev
```

This configures Convex and writes `.env.local` (ignored by git) with:
- `CONVEX_DEPLOYMENT`
- `NEXT_PUBLIC_CONVEX_URL`
- `NEXT_PUBLIC_CONVEX_SITE_URL`

### Configure Admin Writes

Writes go through a Convex HTTP action protected by a shared secret:

1. Pick a secret value (any random string).
2. Set it in Convex:

```bash
pnpm convex env set DOCS_WRITE_SECRET "your-secret"
```

3. Set it for Next.js (in `.env.local`):

```bash
DOCS_WRITE_SECRET=your-secret
```

### (Optional) Protect `/admin` With Basic Auth

Set these in `.env.local`:

```bash
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-me
```

### Run Everything

```bash
pnpm dev
```

Then open:
- http://localhost:3000/admin

Click **Seed Template** to create the starter “Executive Summary” doc.

## Deploy

Host the Next.js app on Vercel (or similar) and set env vars:
- `NEXT_PUBLIC_CONVEX_URL`
- `NEXT_PUBLIC_CONVEX_SITE_URL`
- `DOCS_WRITE_SECRET`
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` (recommended)

Also set `DOCS_WRITE_SECRET` in your Convex deployment env for the same environment (dev/prod) via `pnpm convex env set ...` (use `--prod` for production).

## Data Model (Convex)

- `docs`: one row per doc (slug/title + pointers to draft/final/official revisions)
- `revisions`: immutable markdown snapshots per doc
- `notes`: lightweight annotations per doc (optionally tied to a revision/section)

