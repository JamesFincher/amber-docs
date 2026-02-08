# Amber Docs: Production Release Checklist

Use this before pushing to `main` (Cloudflare Pages deploys from `main`).

## Automated Checks (Must Pass)

- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] `pnpm test`
- [ ] `pnpm build`
- [ ] `pnpm build:public`
- [ ] `pnpm coverage` (informational; should not introduce major coverage regressions)

## Security / Secrets

- [ ] No API keys committed (Google `AIza…`, OpenAI `sk-…`, etc.)
- [ ] `.env.example` updated for any new required env vars (but no real secrets)

## Studio (Write + Publish)

- [ ] Step 1: Connect `content/docs` folder (Chrome/Edge desktop)
- [ ] Step 1b: Upload/preview/import files works (Rendered + Raw preview)
- [ ] Step 2: Create new doc file works (starts unpublished)
- [ ] Step 3: Edit existing doc works (save, download edited file)
- [ ] Publish / Unpublish toggles visibility in `/docs` list as expected
- [ ] Stage changes work (Draft/Final/Official)
- [ ] Clone new version creates a new file (unpublished draft)
- [ ] Delete requires confirmation and removes the file

## Ask AI (AI Spine)

- [ ] Gemini model defaults include `gemini-3-flash` and `gemini-3-pro`
- [ ] “Use Gemini 3 Flash / Pro” quick-pick buttons work
- [ ] Attachments: attach `.md/.mdx/.txt`, send message, AI uses it as context
- [ ] Draft checks appear for generated doc drafts (frontmatter + structure)
- [ ] “Fix draft with AI” rewrites the draft to address the checklist
- [ ] Workspace tools respect safety rules (publish/unpublish confirm, deletes gated)

## Templates

- [ ] Template prompts + markdown scaffold render correctly
- [ ] Generate Markdown via Gemini works
- [ ] “Send to Write + publish” transfers the draft into Studio

## Public Export (Static)

- [ ] `pnpm build:public` succeeds
- [ ] Internal/private docs are excluded from the public export

