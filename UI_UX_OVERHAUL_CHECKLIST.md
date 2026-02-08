# Amber Docs UI/UX Overhaul Checklist (Senior-Friendly)

Goal: make every core feature usable by a non-technical 64-year-old who only knows how to use a web browser.

## Success Criteria
- [ ] Any page can be understood in 10 seconds (what it is + what to do next).
- [ ] Primary actions are obvious and labeled in plain English (no jargon).
- [x] Default typography is comfortable (>= 18px body, generous line-height).
- [x] All interactive targets are easy to hit (>= 44px height, clear focus ring).
- [ ] Advanced/technical options exist but are hidden behind "Advanced" sections.
- [ ] Users can complete these tasks without prior training:
  - [ ] Find a document using search.
  - [ ] Filter documents by topic/stage.
  - [ ] Bookmark a document and find bookmarks again.
  - [ ] Compare two versions of a document.
  - [ ] Copy raw Markdown.
  - [ ] Use a template to generate an AI prompt + Markdown scaffold.
  - [ ] Generate a draft with Gemini (Google AI) and download Markdown.
  - [ ] Create a new doc file and publish/unpublish it (browser-only).
  - [ ] Copy a disclaimer/glossary entry from Blocks.
  - [ ] Leave feedback and a note (local).

## Global UI
- [x] Add a visible "Help" entry in the main navigation.
- [x] Add "Write + publish" in the main navigation.
- [x] Add "Ask AI" in the main navigation.
- [x] Add a "Skip to content" link for keyboard users.
- [x] Increase base font sizes and reduce tiny text usage (`text-xs`).
- [x] Improve contrast and remove readability-reducing glass/blur where possible.
- [x] Standardize button styles and spacing across all pages.
- [ ] Ensure all forms have real labels (not just placeholders).

## Home Page
- [x] Replace marketing-first hero with task-first "Start here" guidance.
- [x] Provide 3 primary actions: Find a doc, Write a doc, Copy standard language.
- [x] Move machine endpoints into an "Advanced" section.

## Docs Library (/docs)
- [x] Reword controls to plain English ("Stage" -> "Status", "Collection" -> "Reading list").
- [x] Add a one-click "Reset" action for filters.
- [x] Explain bookmarks/saved searches are stored on this computer.
- [x] Make results list scan-friendly (larger title, clearer metadata).

## Doc Detail (/docs/[slug])
- [x] Add a "What can I do here?" actions panel (Bookmark, Compare versions, Copy, Raw view).
- [x] Re-label actions in plain language ("Diff" -> "Compare versions", "Raw" -> "View Markdown").
- [x] Make reading layout simpler (reduce 3-column density; keep tools discoverable).
- [x] Keep AI tools, Notes, Feedback reachable with clear section headings.

## Compare Versions (/docs/[slug]/diff)
- [x] Re-label and explain comparison (what’s green/red).
- [x] Increase text size for diff output.
- [x] Add option to hide unchanged text (optional).

## Templates (/templates)
- [x] Turn into a 3-step flow: Pick template, Fill details, Copy outputs.
- [x] Make outputs easier to copy/download and less code-editor-like by default.
- [x] Add optional native generation with Google AI (Gemini).
- [x] Hide custom JSON registry behind "Advanced".

## Write + Publish (/studio)
- [x] Add a click-by-click flow for connecting `content/docs` and creating files.
- [x] Add publish/unpublish/finalize/official and delete/version actions (local folder access).

## Ask AI (/assistant)
- [x] Add a plain-language AI assistant that can include internal docs context (via `chunks.json`).

## Blocks (/blocks)
- [x] Focus UI on "Search and Copy".
- [x] Use friendlier language ("Disclaimers" + "Glossary" explained).
- [x] Hide import/export and creation behind "Advanced".

## Paths (/paths)
- [x] Rename UI labels to "Reading lists" (keep route as `/paths`).
- [x] Add a short explanation of how to use prev/next navigation.

## Help (/help)
- [x] Add a simple help page with clickable steps (screenshots optional later).
- [ ] Include short tutorials for each feature and where data is stored (local vs repo).

## QA / Tests
- [x] Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
- [x] Add/adjust UI smoke tests for the new navigation labels + help page.
