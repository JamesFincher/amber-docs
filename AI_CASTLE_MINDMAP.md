# Amber Docs + Amber AI ("Castle")

Date: 2026-02-08

## Mindmap v1 (7 Layers)

Amber Docs (product)
  UI surfaces
    Site header + search
      Primary actions
        Documents
          Search + filters
            Result cards
              Open doc detail
        Ask AI
          Amber AI chat
            Tool-calling loop
              Returns final answer or tool calls
                Can include draft.docText
        Write + publish
          Studio (local folder)
            Connect content/docs
              Create/update/publish/unpublish/finalize
                Stored as files
    Documents
      Library
        Search by keywords
          Synonyms expansion
            /synonyms.json
              Token-based expansion
                Improves recall
        Filter by status/topic/reading list
          Status = stage (draft/final/official)
            Governance chip
              Needs review heuristic
                Drives prompts + review
        Ask AI about a doc
          Link into Ask AI
            Prefills review task
              AI fetches doc via tools
                Produces improvements + draft
    Document detail
      Read markdown
        Table of contents
          Jump navigation
            Sticky sidebar
              Notes + feedback
                Stored locally
        Governance metadata
          Stage + version
            Visibility + publish state
              Citations + approvals
                Audit trail
        AI assist
          Open in Ask AI
            Prefilled review workflow
              AI reads via get_doc
                Returns draft + action plan
          AI helper prompts
            Full-doc prompt
              Section prompts
                Copy to external tools
    Templates
      Template picker
        Required + optional sections
          Markdown scaffold
            Prompt builder
              Gemini generation
                Draft markdown output
      Import to Studio
        Save to local storage
          Open Studio#import
            Load imported draft
              Create doc file
    Reusable text (Blocks)
      Disclaimers
        Search + tags
          Copy button
            Paste into doc
              Consistency + safety
      Glossary
        Search + tags
          Copy button
            Paste into doc
              Shared vocabulary
      Custom items
        Create locally
          Export/import JSON
            Ask AI to draft block
              Save_custom_* tools
    Studio (Write + publish)
      Folder connection
        File list
          Select a doc
            Edit metadata + markdown
              Save edits
        Publish controls
          Publish/unpublish
            Set archived flag
              Controls export visibility
                Affects /docs + /raw
        Stage controls
          Draft/final/official
            Finalize (official)
              lastReviewedAt enforcement
                Governance baseline
        Advanced
          Citations + approvals
            Audit log
              Actor name
                Traceability

Amber AI (internal assistant)
  Provider
    Google AI (Gemini)
      API key stored locally
        LocalStorage keys
          amber-docs:ai:gemini:key:v1
            Used in Templates + Ask AI
      Model selection
        Default: gemini-2.0-flash
          User override
            Stored locally
  Core agent loop
    Prompt builder
      SYSTEM + TOOLS + TRANSCRIPT
        Strict JSON output
          parseAgentResponse
            tool_calls | final
    Tool execution
      search_docs
        Fuse over /search-index.json
          Weighted fields
            title/headings/summary/topics
              Returns ranked results
      get_doc
        Fetch /raw[/v]
          Parse frontmatter + markdown
            Truncate for safety
              Provides doc body
      get_relevant_chunks
        Fetch /chunks.json
          Token scoring
            Returns top excerpts
              Grounding + citations hints
      list_templates/render_template
        Built-in + custom templates
          buildMarkdownSkeleton
            buildPrompt
              Produces scaffold + prompt
      list_blocks
        Built-in + custom blocks
          Disclaimers + glossary
            Used for safe language
              Can be saved locally
      save_custom_disclaimer/save_custom_glossary_entry
        Persist to browser storage
          Immediately available in Blocks page
            Standardize language
              Reduce duplicated editing
      Workspace (File System Access API)
        connect folder
          scan content/docs
            list/read docs
              Includes unpublished drafts
        file edits (guarded)
          allowFileWrites toggle
            create/update/delete versions
              publish/unpublish/finalize
                Writes Markdown + frontmatter
      send_to_studio
        Save draft via studioImport
          Redirect user to Studio#import
            Create doc file
              Publish when ready

Outputs (returning value to the user)
  In-chat answer
    Plain-language steps
      Action plan
        Links to relevant docs
          Source-needed markers
            Governance quality
  Draft doc
    final.draft.docText
      Copy/download
        Send to Studio
          Or write directly to files
            Publish/finalize workflow

## User Stories (Representative)

- As a non-technical reader, I want to type a plain-language question and get the right document plus clear steps, so I can solve my problem without knowing where docs live.
- As a doc author, I want AI to draft a new document using approved templates and reusable text, so my docs start consistent and safe.
- As a doc maintainer, I want AI to update an existing doc in my local folder (with audit entries), so I can keep docs current without manual frontmatter work.
- As a reviewer, I want AI to extract factual claims and flag missing sources, so I can verify correctness before marking a doc Official.
- As an operator, I want a one-click way to publish/unpublish/finalize, so I can control what appears in exports without CLI.
- As a governance owner, I want every AI file edit to leave an audit trail, so changes are attributable and reviewable.
- As a new team member, I want the system to guide me through connecting the docs folder and using Studio, so I can contribute safely.

## Mindmap v2 (Refined)

Amber Docs (simple UX)
  Find
    Search (Docs)
      Filters (status/topic/list/bookmarks)
        Ask AI fallback
          "I don't know what to search"
            AI asks clarifying questions
              Returns 1-3 best docs
  Read
    Doc detail
      Governance at-a-glance
        Status + review + citations
          Ask AI: "Explain / improve"
            AI fetches doc + context
              Returns improved draft
  Write
    Templates
      Scaffold + prompt
        Gemini generate
          Send to Studio
            Create file (unpublished)
    Studio
      Connect folder
        Edit metadata + markdown
          Publish/unpublish/finalize
            Runs checks guidance
  Reuse
    Blocks
      Copy disclaimers + glossary
        Ask AI: "Draft a new block"
          Save custom block locally

Amber AI (keys to the kingdom)
  Guardrails
    No file writes unless enabled
      Clear UI warning
        User-controlled folder access
          Audited edits
  Tools
    Discovery: search_docs
      Reading: get_doc + chunks
        Composition: templates + blocks
          Persistence: workspace FS + Studio import

## Checklist (Build + QA)

- [x] Core AI provider (Gemini) usable from the browser
- [x] Internal AI chat (Ask AI) supports tool calling and draft output
- [x] AI can search docs index + read doc markdown
- [x] AI can use templates + blocks (and save custom ones)
- [x] AI can connect to local docs folder (File System Access API)
- [x] AI can create/update/delete doc files when file edits are enabled
- [x] AI can publish/unpublish/finalize docs in the connected folder
- [x] Studio import bridge: AI/Templates -> Studio
- [x] AI entry points exist in Documents list + Doc detail + Blocks + Studio
- [x] Static export build works (no request header reads in routes)
- [x] Tests added for agent loop + edge cases
- [x] lint/typecheck/test/build/build:public all pass
