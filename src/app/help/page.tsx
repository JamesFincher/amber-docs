import Link from "next/link";
import { listLatestDocs } from "@/lib/content/docs.server";

export const metadata = {
  title: "Help | Amber Docs",
  description: "Simple, click-by-click help for using Amber Docs.",
};

export default function HelpPage() {
  const first = listLatestDocs()[0] ?? null;
  const exampleDocUrl = first ? `/docs/${encodeURIComponent(first.slug)}` : "/docs";
  const exampleDiffUrl = first ? `/docs/${encodeURIComponent(first.slug)}/diff` : "/docs";

  return (
    <main className="page max-w-6xl">
      <header className="mb-8 space-y-3">
        <p className="text-sm font-semibold text-zinc-700">Help</p>
        <h1 className="font-display text-4xl font-semibold tracking-tight">How to use Amber Docs</h1>
        <p className="max-w-3xl text-zinc-800">
          This is a simple guide for reading, finding, and reusing documentation. If you only know how to use a web browser, you are in the right place.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <h2 className="font-display text-2xl font-semibold">1) Find a document</h2>
          <ol className="mt-3 space-y-2 text-zinc-800">
            <li>
              <span className="font-semibold">Step 1:</span> Use the search box at the top of the page.
            </li>
            <li>
              <span className="font-semibold">Step 2:</span> Open <span className="font-semibold">Documents</span> for filters (status, topic, reading list).
            </li>
            <li>
              <span className="font-semibold">Step 3:</span> Click a document title to open it.
            </li>
          </ol>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link className="btn btn-primary" href="/docs">
              Open Documents
            </Link>
            <Link className="btn btn-secondary" href={exampleDocUrl}>
              Open an example
            </Link>
          </div>
        </div>

        <div className="card p-6">
          <h2 className="font-display text-2xl font-semibold">2) Save a bookmark</h2>
          <p className="mt-3 text-zinc-800">
            On any document page, click <span className="font-semibold">Save bookmark</span>. Then go back to{" "}
            <span className="font-semibold">Documents</span> and turn on <span className="font-semibold">Only show bookmarks</span>.
          </p>
          <div className="mt-4">
            <Link className="btn btn-secondary" href="/docs">
              Find my bookmarks
            </Link>
          </div>
        </div>

        <div className="card p-6">
          <h2 className="font-display text-2xl font-semibold">3) Compare versions</h2>
          <p className="mt-3 text-zinc-800">
            On a document page, click <span className="font-semibold">Compare versions</span> to see what changed.
            Green is added text. Red is removed text.
          </p>
          <div className="mt-4">
            <Link className="btn btn-secondary" href={exampleDiffUrl}>
              Compare an example
            </Link>
          </div>
        </div>

        <div className="card p-6">
          <h2 className="font-display text-2xl font-semibold">4) Write + publish a document</h2>
          <p className="mt-3 text-zinc-800">
            Use <span className="font-semibold">Write + publish</span> to create a new doc file and then publish it when it is ready.
            You can also use Templates or Ask AI, then click <span className="font-semibold">Send to Write + publish</span> to bring a draft here without copy/paste.
          </p>
          <div className="mt-4">
            <Link className="btn btn-primary" href="/studio">
              Open Write + publish
            </Link>
          </div>
        </div>

        <div className="card p-6">
          <h2 className="font-display text-2xl font-semibold">5) Use Templates</h2>
          <p className="mt-3 text-zinc-800">
            Templates help you write consistent docs. Pick a template, fill a few fields, then copy the prompt or scaffold.
            Optional: generate a first draft with <span className="font-semibold">Google AI (Gemini)</span> and download Markdown.
            Tip: you can also click <span className="font-semibold">Send to Write + publish</span> to import the draft directly into Studio.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link className="btn btn-primary" href="/templates">
              Open Templates
            </Link>
            <Link className="btn btn-secondary" href="/assistant">
              Open Ask AI
            </Link>
          </div>
        </div>

        <div className="card p-6">
          <h2 className="font-display text-2xl font-semibold">6) Copy reusable text</h2>
          <p className="mt-3 text-zinc-800">
            Use <span className="font-semibold">Reusable text</span> to copy disclaimers and glossary definitions into a document.
          </p>
          <div className="mt-4">
            <Link className="btn btn-primary" href="/blocks">
              Open Reusable text
            </Link>
          </div>
        </div>

        <div className="card p-6">
          <h2 className="font-display text-2xl font-semibold">7) Notes and feedback</h2>
          <p className="mt-3 text-zinc-800">
            Each document has <span className="font-semibold">Notes</span> (your personal notes) and <span className="font-semibold">Feedback</span>.
            Notes and votes are saved locally in your browser.
          </p>
        </div>
      </section>

      <section className="mt-8 card p-6">
        <h2 className="font-display text-2xl font-semibold">Where is my data stored?</h2>
        <p className="mt-3 text-zinc-800">
          Some things are stored on this computer (in your browser), and some are stored in the repo (as files).
        </p>
        <div className="mt-4 grid gap-3 text-zinc-800">
          <div>
            <span className="font-semibold">Stored in your browser (this computer):</span> bookmarks, saved searches, notes,
            feedback votes, custom blocks, custom templates, and any Gemini API key you paste into Templates/Ask AI.
          </div>
          <div>
            <span className="font-semibold">Stored as files in the repo:</span> documents live in <code>content/docs</code>,
            templates in <code>content/templates</code>, blocks in <code>content/blocks</code>.
          </div>
        </div>
      </section>

      <section className="mt-8 card p-6">
        <h2 className="font-display text-2xl font-semibold">Reading lists</h2>
        <p className="mt-3 text-zinc-800">
          Reading lists group documents in a recommended order. Use them when you are new to a topic or want to learn step-by-step.
        </p>
        <div className="mt-4">
          <Link className="btn btn-secondary" href="/paths">
            Browse reading lists
          </Link>
        </div>
      </section>

      <section className="mt-8 card p-6">
        <h2 className="font-display text-2xl font-semibold">Publish, visibility, and Official docs</h2>
        <div className="mt-3 grid gap-3 text-zinc-800">
          <div>
            <span className="font-semibold">Publish/unpublish:</span> if a doc is unpublished, it is hidden from the Documents list and exports.
            Studio shows this as “Published? Yes/No”.
          </div>
          <div>
            <span className="font-semibold">Visibility:</span> docs can be <span className="font-semibold">Public</span>,{" "}
            <span className="font-semibold">Internal</span>, or <span className="font-semibold">Private</span>. Public docs can appear in the public export.
          </div>
          <div>
            <span className="font-semibold">Official:</span> Official docs should include citations and approvals. Studio has a “Citations + approvals” editor under Advanced.
          </div>
        </div>
      </section>

      <section className="mt-8 card p-6">
        <h2 className="font-display text-2xl font-semibold">Checks and sharing</h2>
        <div className="mt-3 grid gap-3 text-zinc-800">
          <div>
            <span className="font-semibold">Run checks:</span> in Studio, go to Step 4 and copy the check commands (<code>pnpm qa</code>, <code>pnpm test</code>, <code>pnpm build</code>).
          </div>
          <div>
            <span className="font-semibold">Share with your team:</span> Studio includes a step-by-step “Create a PR” guide under Advanced.
          </div>
        </div>
      </section>
    </main>
  );
}
