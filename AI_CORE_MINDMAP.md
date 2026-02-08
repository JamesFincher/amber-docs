# AI Core Mindmap (7 Layers Deep) + Stories + Checklist

This repo is a **static Next.js export** (`next.config.ts` uses `output: "export"`). That means:
- The app is great for **reading and generating docs in a browser**.
- Server-side write APIs are not available in production, so **file writes happen locally** (via `Write + publish` using the browser folder picker) or via **CLI scripts**.

As of this update, the product surface includes:
- `/docs` search + browse
- `/docs/[slug]` + versioned docs + diffs
- `/templates` (prompt/scaffold + Gemini generation)
- `/studio` (create/edit/publish/unpublish/finalize/delete doc files)
- `/assistant` (Gemini + internal docs context via `/chunks.json`)

---

## Mindmap (7 Layers Deep)

```mermaid
mindmap
  root(("Amber Docs: AI Core"))
    "Natural Language Interface"
      "Intent Router"
        "Create"
          "New document"
            "Template-based"
              "Field capture"
                "Prompt assembly"
                  "Gemini generation"
        "Edit"
          "Improve existing doc"
            "Rewrite sections"
              "Claim extraction"
                "Source placeholders"
                  "Promotion readiness"
        "Manage"
          "Lifecycle operations"
            "Publish/unpublish"
              "Visibility toggle"
                "Static export safety"
                  "Hidden drafts allowed"
        "Answer"
          "Question answering"
            "Context retrieval"
              "Chunk selection"
                "Grounded responses"
                  "Link to sources"
    "AI Providers"
      "Google AI (Gemini)"
        "Client-side calls"
          "User API key"
            "Local storage"
              "Model selection"
                "gemini-2.x family"
                  "Generate Markdown"
        "Prompting strategy"
          "Output contract"
            "Markdown-only"
              "Optional frontmatter"
                "No code fences"
                  "Copy/download workflows"
    "Internal Systems (Context + Tools)"
      "Docs Dataset"
        "Docs loader"
          "Frontmatter schema"
            "Stage (draft/final/official)"
              "Publish state (archived/unpublished)"
                "Build-time filtering"
                  "No static params for unpublished"
        "Versioning"
          "Latest alias"
            "Pinned versions"
              "Diff viewer"
                "Auditability"
                  "What changed"
      "Machine Exports"
        "chunks.json"
          "RAG-ready chunks"
            "Stable chunk IDs"
              "Context selection"
                "Top-N retrieval"
                  "Prompt injection control"
        "claims.json"
          "Numbers/dates"
            "Verification queue"
              "Citation needed"
                "Reviewer workflow"
                  "Official gate"
        "docs.json"
          "Index + hashes"
            "Integrations"
              "Polling via updates.json"
                "Sync pipelines"
                  "Webhook triggers"
      "Reusable Text"
        "Glossary"
          "Canonical terms"
            "Case enforcement"
              "AI prompt guidance"
                "Consistent language"
                  "Reduced drift"
        "Disclaimers"
          "Standard statements"
            "AI-assisted insertion"
              "Public safety"
                "Legal hygiene"
                  "Reader trust"
      "Quality Gates"
        "Content QA"
          "Broken links"
            "Internal links"
              "No links to unpublished docs"
                "Asset existence"
                  "Public/ integrity"
          "Official policy"
            "Owners/topics/reviewedAt"
              "Approvals required"
                "Terminology checks"
                  "External link validation"
    "File + Document Lifecycle"
      "Authoring Surfaces"
        "Write + publish (UI)"
          "Folder picker"
            "Create file"
              "Unpublished by default"
                "Publish when ready"
                  "Visible in /docs"
          "Edit file"
            "Frontmatter + Markdown"
              "Finalize / Official"
                "Set review date"
                  "Run QA in CI"
          "Delete / Clone"
            "New version"
              "Draft + unpublished"
                "Promote later"
                  "History preserved"
        "CLI workflow"
          "pnpm docs:new"
            "Create draft"
              "Standard filename"
                "Frontmatter scaffold"
                  "Commit to repo"
          "pnpm docs:publish"
            "Make visible"
              "Static export includes it"
                "Integrations see it"
                  "Docs.json updates"
    "UX (Senior-Friendly)"
      "Plain language"
        "Write + publish"
          "Ask AI"
            "Templates"
              "Reusable text"
                "Help"
                  "Click-by-click instructions"
      "Safe defaults"
        "Unpublished drafts"
          "No accidental publishing"
            "Clear buttons"
              "Large hit targets"
                "Readable typography"
                  "Minimal jargon"
```

---

## User Stories (Derived)

### Writer (non-technical)
1. As a writer, I want to create a new document in my browser so I do not need to learn git or a terminal.
2. Acceptance criteria: I can connect my `content/docs` folder and click **Create doc file**.
3. Acceptance criteria: New docs are **unpublished by default** and clearly labeled until I publish.

### Writer (AI-assisted)
1. As a writer, I want to generate a draft with Gemini so I can start from a complete, readable document.
2. Acceptance criteria: I can paste an API key, choose a model, and click **Generate Markdown**.
3. Acceptance criteria: Output is copyable and downloadable as a `.md` file.

### Maintainer (document lifecycle)
1. As a maintainer, I want publish/unpublish/finalize/official actions so document state is explicit.
2. Acceptance criteria: The UI and CLI both support **publish/unpublish** and **stage changes**.
3. Acceptance criteria: Unpublished docs are excluded from `/docs.json`, search, sitemap, and static params.

### Reviewer (quality + trust)
1. As a reviewer, I want QA checks to ignore unpublished drafts so work-in-progress docs do not break CI.
2. Acceptance criteria: Content QA does not enforce H2/Official gates on unpublished docs.
3. Acceptance criteria: Published docs cannot link to unpublished docs without failing QA.

### Integrator (RAG + automation)
1. As an integrator, I want stable machine endpoints so I can build RAG pipelines and monitoring.
2. Acceptance criteria: `/chunks.json` contains stable chunk IDs and readable chunk text.
3. Acceptance criteria: `/updates.json` provides a build ID and content hashes to detect changes.

---

## Mindmap (Refined Once More)

Refinements:
- Make **Publish state** first-class (separate from Draft/Final/Official).
- Treat AI as a **workflow tool**, not a feature island: it must read docs context, blocks, and lifecycle rules.
- Keep novice flow: **Ask AI → Save locally → Publish**.

```mermaid
mindmap
  root(("Amber Docs: Refined AI Core"))
    "Novice Flow"
      "Ask AI"
        "Use context (optional)"
          "chunks.json retrieval"
            "Top excerpts"
              "Grounded draft"
                "SOURCE NEEDED placeholders"
      "Save"
        "Write + publish"
          "Create file"
            "Unpublished draft"
              "Edit + verify"
                "Stage progression"
      "Publish"
        "Publish toggle"
          "Visible everywhere"
            "docs + search"
              "docs.json + sitemap"
                "Integrations update"
    "Lifecycle Model"
      "Visibility"
        "Published"
          "Included in build"
            "Static params"
              "Machine exports"
        "Unpublished"
          "Hidden drafts"
            "No accidental exposure"
              "QA ignores structure gates"
      "Stage"
        "Draft"
          "Work in progress"
        "Final"
          "Ready for sharing"
        "Official"
          "Governance stance"
            "Review date + approvals"
    "AI Contract"
      "Provider"
        "Gemini"
          "Client-side key"
            "Model selection"
      "Output"
        "Frontmatter (optional)"
          "Slug/version/title"
        "Markdown"
          "At least one H2"
      "Safety"
        "No invented facts"
          "Mark assumptions"
            "Citations placeholders"
```

---

## Checklist (Implementation + Follow-Ups)

### Completed (in this branch)
- [x] Publish/unpublish support via `archived` frontmatter (unpublished when `archived: true`)
- [x] App-wide filtering (unpublished docs excluded from lists, exports, sitemap, static params)
- [x] `Write + publish` UI (`/studio`) for create/edit/publish/unpublish/finalize/delete/version
- [x] Gemini client (`src/lib/ai/gemini.ts`) + tests
- [x] Templates page: Gemini generation
- [x] Ask AI page (`/assistant`) using `/chunks.json` context + glossary/disclaimers
- [x] Expanded test coverage + edge case tests + coverage run

### Next (good follow-ups)
- [ ] Add a “Run QA now” button in Studio (runs `pnpm qa` locally, or shows the exact command to run)
- [ ] Add optional “Create PR” guidance for non-technical users (step-by-step)
- [ ] Add structured “citation collection” UI for Official docs (labels + URLs)
- [ ] Add doc-type templates that auto-fill lifecycle metadata (owners/topics/approvals)

