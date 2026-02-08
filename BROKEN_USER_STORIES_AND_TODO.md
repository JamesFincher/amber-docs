# Broken User Stories + TODO (UI/UX + AI + Docs Workflow)

This document captures user stories that were *breaking in real use*, two solution passes, and an actionable TODO list.

## Broken User Stories (Observed)

1. **Finalize should not mean publish + official**
   - Story: "As a user, I ask Amber AI to finalize a doc so it is ready, but I do not want it auto-published or marked as officially approved."
   - Break: Ask AI's `workspace_finalize` was marking `stage=official` and setting `archived=false` (publishing).
   - Impact: Silent, dangerous lifecycle changes (approval semantics + visibility) from a single word.

2. **Read-only workspace connect should stay read-only**
   - Story: "As a cautious user, I connect my docs folder just to let AI read drafts, without granting write access."
   - Break: Folder connect could request `readwrite` even when "Allow file edits" was off.
   - Impact: Users grant more access than intended.

3. **AI deletes are too easy to trigger**
   - Story: "As a user, I want AI help, but I never want it to permanently delete files unless I explicitly opt in and confirm."
   - Break: Delete tool had no strong app-level guardrails.
   - Impact: Accidental irreversible data loss.

4. **Ask AI about a specific doc can be generic**
   - Story: "As a user, I click 'Ask AI about this doc' and expect the AI to reference the doc's actual content."
   - Break: The assistant did not automatically fetch that doc's content, so replies could be generic.
   - Impact: Lower trust and more back-and-forth.

5. **No cancel for long AI calls**
   - Story: "As a user, if I accidentally send a long prompt or the model stalls, I need a cancel button."
   - Break: No in-UI cancel; users must wait or refresh.
   - Impact: Frustration and lost work.

6. **Model/key setup is unclear for non-technical users**
   - Story: "As a non-technical user, I need a simple 'where do I get a key' and 'what model should I use' guidance."
   - Break: UI previously assumed familiarity.
   - Impact: Setup friction.

## Solutions (Pass 1)

1. Split lifecycle tools clearly:
   - `Finalize` => `stage=final` only.
   - `Official` => `stage=official` + `lastReviewedAt` (+ approvals).
   - `Publish/Unpublish` stays separate (`archived=false/true`).

2. Folder connect permission model:
   - If "Allow file edits" is off, connect with `mode="read"`.
   - If user turns edits on later, require reconnect to grant write access.

3. Delete safety:
   - Add an explicit "Allow deletes" toggle (default off).
   - Require `confirm=true` in the delete tool call.

4. Reliability:
   - Auto-inject `workspace_status` into every run.
   - If launched with `?doc=...`, auto-fetch that doc via `get_doc` and inject it.

5. Add Cancel:
   - Use `AbortController` and pass `signal` to Gemini fetch.

6. Setup guidance:
   - Link to Google AI Studio key page.
   - Provide a model datalist for common model names.

## User Stories Rewritten (Acceptance Criteria)

1. **Finalize (safe)**
   - Given a doc is connected, when I ask to "finalize", then only `stage` becomes `final`.
   - Publishing status does not change.
   - If the doc was official, `lastReviewedAt` should be cleared (official-only field).

2. **Official (explicit)**
   - Given a connected doc, when I ask to mark it official, then `stage=official`.
   - `lastReviewedAt` is set to today unless I provide `reviewedAt`.
   - Approvals are only changed if I provide them.

3. **Read-only by default**
   - If I do not enable file edits, the folder connect must not request write access.
   - If I enable file edits while connected read-only, the UI must tell me to reconnect.

4. **Deletes require opt-in + confirm**
   - Deletes are impossible unless:
     - file edits are enabled
     - folder is connected in read/write mode
     - "Allow deletes" is enabled
     - the tool call passes `confirm=true`

5. **Doc-specific assistant context**
   - If I click "Ask AI about this doc", the assistant must fetch that doc automatically and reference it.

6. **Cancelable runs**
   - When AI is working, a Cancel button must be visible and stop the request without showing a scary error.

## Solutions (Pass 2 Refinements)

1. Make tool outputs explicit to the agent:
   - Inject `workspace_status` and (when present) `get_doc` output as tool messages before the agent loop.

2. Prevent accidental elevated permissions:
   - Track `workspaceMode` ("read"/"readwrite") and block write tools unless write-ready.

3. Reduce user fear:
   - Cancel should show "Canceled." in the transcript rather than an error banner.

## Fixes Implemented (This Update)

- [x] Ask AI: `workspace_finalize` now sets `stage=final` only (no publish, no official).
- [x] Ask AI: added `workspace_official` tool (stage=official + review date + optional approvals).
- [x] Ask AI: folder connect respects read vs readwrite; write tools require reconnect if connected read-only.
- [x] Ask AI: delete guardrails (Advanced toggle + `confirm=true` required).
- [x] Ask AI: auto-inject `workspace_status` and `get_doc` when launched with `?doc=...`.
- [x] Ask AI: Cancel button wired via `AbortController`.
- [x] Ask AI: clearer key instructions + model suggestions.
- [x] Studio copy updated to mention Official stage explicitly.

## TODO (Remaining Gaps)

- [ ] Undo/rollback for AI file edits (backup file or automatic "clone new version before editing").
- [ ] Optional "dry run" mode for AI edits (preview diff before writing).
- [ ] Add a safer default agent policy: never publish/unpublish unless user explicitly says "publish/unpublish".
- [ ] Add onboarding flow for first-time users (what to click, where the folder is, what publish vs stage means).
- [ ] Persist custom Templates/Blocks beyond one browser (export/import or workspace file-based storage).

