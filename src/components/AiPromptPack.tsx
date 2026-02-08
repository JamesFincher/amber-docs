import { CopyButton } from "@/components/CopyButton";
import type { DocRecord } from "@/lib/docs";
import { extractH2Sections } from "@/lib/markdown";

function buildReviewPrompt(args: {
  doc: Pick<DocRecord, "title" | "slug" | "version" | "markdown">;
  relatedDocs: Array<Pick<DocRecord, "title" | "slug" | "markdown">>;
}): string {
  const context =
    args.relatedDocs.length === 0
      ? "No related docs provided."
      : args.relatedDocs
          .map((d) => `# ${d.title} (${d.slug})\n\n${d.markdown.trim()}\n`)
          .join("\n\n---\n\n");

  return `You are reviewing public-facing documentation for clarity and correctness.

Doc: ${args.doc.title} (${args.doc.slug}) v${args.doc.version}

Related docs (context):
${context}

Doc to review:
${args.doc.markdown.trim()}

Tasks:
1) Rewrite: produce a crisper version while preserving intent (Markdown).
2) Claims: list concrete factual claims and add a "(SOURCE NEEDED: ...)" note for each.
3) Contradictions: identify likely conflicts with the related docs and propose fixes.
4) Missing info: list questions that must be answered before promotion to Official.

Output format:
- Rewrite:
- Claims to verify:
- Potential contradictions:
- Questions:
`;
}

function buildSectionPrompt(args: {
  doc: Pick<DocRecord, "title" | "slug" | "version">;
  sectionHeading: string;
  sectionBody: string;
  relatedDocs: Array<Pick<DocRecord, "title" | "slug" | "markdown">>;
}): string {
  const context =
    args.relatedDocs.length === 0
      ? "No related docs provided."
      : args.relatedDocs
          .map((d) => `# ${d.title} (${d.slug})\n\n${d.markdown.trim()}\n`)
          .join("\n\n---\n\n");

  return `You are helping write and verify public-facing documentation.

Doc: ${args.doc.title} (${args.doc.slug}) v${args.doc.version}
Section: ${args.sectionHeading}

Related docs (context):
${context}

Section to review:
${args.sectionBody.trim()}

Tasks:
1) Rewrite: rewrite this section to be crisp, specific, and readable. Preserve intent. Use Markdown.
2) Claims: list concrete claims and what evidence/source would verify each claim (no browsing required).
3) Contradictions: note any likely conflicts with the related docs and suggest a fix.
4) Questions: list missing info needed to finalize this section.

Output format:
- Rewrite:
- Claims to verify:
- Potential contradictions:
- Questions:
`;
}

export function AiPromptPack({ doc, relatedDocs }: { doc: DocRecord; relatedDocs: DocRecord[] }) {
  const sections = extractH2Sections(doc.markdown);
  const docPrompt = buildReviewPrompt({ doc, relatedDocs });

  return (
    <section className="rounded-xl border border-zinc-200 bg-white/60 p-6 backdrop-blur">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">AI prompt pack</h2>
        <CopyButton text={docPrompt} label="Copy full-doc prompt" />
      </div>
      <p className="mb-4 text-sm text-zinc-600">
        Copy prompts into your model of choice for rewrite, claim extraction, and contradiction scanning.
      </p>

      <details className="rounded-lg border border-zinc-200 bg-white/60 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-zinc-900">Full-doc review prompt</summary>
        <textarea
          className="mt-3 h-56 w-full rounded-md border border-zinc-300 p-3 font-mono text-xs"
          value={docPrompt}
          readOnly
        />
      </details>

      {sections.length ? (
        <div className="mt-5 grid gap-4">
          {sections.map((s) => {
            const prompt = buildSectionPrompt({
              doc,
              sectionHeading: s.heading,
              sectionBody: s.body,
              relatedDocs,
            });
            return (
              <details key={s.heading} className="rounded-lg border border-zinc-200 bg-white/60 p-4">
                <summary className="cursor-pointer text-sm font-semibold text-zinc-900">
                  Section: {s.heading}
                </summary>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-zinc-500">Rewrite + claims + contradictions</div>
                  <CopyButton text={prompt} label="Copy section prompt" />
                </div>
                <textarea
                  className="mt-3 h-44 w-full rounded-md border border-zinc-300 p-3 font-mono text-xs"
                  value={prompt}
                  readOnly
                />
              </details>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
