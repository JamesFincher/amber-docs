# Amber Protocol Docs

Markdown-first documentation workspace for drafting, reviewing, versioning, and publishing public docs with AI-friendly workflows.

## What this repo provides

- **Public-readable docs UX**: publish finalized docs so they can be crawled by AI tools and humans.
- **Draft → Final → Official flow**: support iterative authoring and promotion to official versions.
- **Versioned content model in Convex**: document records, versions, statuses, and notes.
- **Simple copy/paste AI workflow**: markdown-first editing + prompt-ready content blocks.

## Local development

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000.

## Convex backend

This repo includes a Convex backend under `convex/`.

Run Convex locally in another terminal:

```bash
npx convex dev
```

## Deploy to Cloudflare + map `docs.amberprotocol.org`

### 1) Push this repo to GitHub

If remote is not yet configured:

```bash
git remote add origin <YOUR_GITHUB_REPO_URL>
git push -u origin work
```

### 2) Create a Cloudflare Pages project

1. In Cloudflare Dashboard, go to **Workers & Pages → Create → Pages → Connect to Git**.
2. Select this GitHub repository.
3. Framework preset: **Next.js**.
4. Build command: `pnpm build`.
5. Output directory: `.next` (or accept Cloudflare's Next.js default if auto-detected).
6. Set environment variables as needed (for example Convex deployment URLs).
7. Deploy.

### 3) Add custom domain `docs.amberprotocol.org`

1. Open the deployed Pages project.
2. Go to **Custom domains → Set up a custom domain**.
3. Enter `docs.amberprotocol.org`.
4. Cloudflare will create/verify the required DNS record in the `amberprotocol.org` zone.

### 4) Verify DNS and TLS

- Wait for status to become **Active**.
- Confirm HTTPS is issued and valid.
- Verify the site resolves:

```bash
curl -I https://docs.amberprotocol.org
```

## Notes

I cannot directly create Cloudflare DNS/project resources from this environment without Cloudflare account/API credentials, but the repo is now documented so you can execute setup in under 5 minutes in the dashboard.
