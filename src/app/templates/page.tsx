"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CopyButton } from "@/components/CopyButton";
import {
  buildMarkdownSkeleton,
  buildPrompt,
  buildSectionPromptPack,
  docTemplates,
  type DocTemplate,
} from "@/lib/templates";

function getTemplateById(id: string): DocTemplate {
  return docTemplates.find((template) => template.id === id) ?? docTemplates[0];
}

export default function TemplateToolPage() {
  const [templateId, setTemplateId] = useState(docTemplates[0].id);
  const [topic, setTopic] = useState("Amber Protocol Governance Update");
  const [values, setValues] = useState<Record<string, string>>({});

  const selectedTemplate = useMemo(() => getTemplateById(templateId), [templateId]);

  const promptOutput = useMemo(
    () => buildPrompt(selectedTemplate, values, topic),
    [selectedTemplate, values, topic],
  );

  const markdownOutput = useMemo(
    () => buildMarkdownSkeleton(selectedTemplate, values, topic),
    [selectedTemplate, values, topic],
  );

  const sectionPrompts = useMemo(
    () => buildSectionPromptPack(selectedTemplate, values, topic),
    [selectedTemplate, values, topic],
  );

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-6 py-12">
      <header className="space-y-3">
        <nav className="flex flex-wrap gap-3 text-sm">
          <Link href="/" className="underline decoration-black/20 underline-offset-4 hover:decoration-black/40">
            Home
          </Link>
          <Link
            href="/docs"
            className="underline decoration-black/20 underline-offset-4 hover:decoration-black/40"
          >
            Docs
          </Link>
          <Link
            href="/blocks"
            className="underline decoration-black/20 underline-offset-4 hover:decoration-black/40"
          >
            Blocks
          </Link>
        </nav>
        <h1 className="text-3xl font-semibold">Document Template Tool</h1>
        <p className="max-w-3xl text-zinc-600">
          Generate reusable, uniform document shapes and AI-ready prompts. Pick a template, fill required
          fields, then copy either the generation prompt or markdown scaffold.
        </p>
      </header>

      <section className="grid gap-6 rounded-xl border border-zinc-200 p-6 lg:grid-cols-2">
        <div className="space-y-4">
          <label className="block text-sm font-medium text-zinc-700">
            Template type
            <select
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
            >
              {docTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium text-zinc-700">
            Topic
            <input
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Example: Q3 Treasury Strategy"
            />
          </label>

          <p className="rounded-md bg-zinc-50 p-3 text-sm text-zinc-600">{selectedTemplate.description}</p>

          <div className="space-y-3">
            {selectedTemplate.requiredFields.map((field) => (
              <label key={field.key} className="block text-sm font-medium text-zinc-700">
                {field.label}
                <input
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2"
                  value={values[field.key] ?? ""}
                  onChange={(e) =>
                    setValues((prev) => ({
                      ...prev,
                      [field.key]: e.target.value,
                    }))
                  }
                  placeholder={field.placeholder}
                />
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-zinc-200 p-4">
            <h2 className="mb-2 text-lg font-semibold">Template sections</h2>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-zinc-700">
              {selectedTemplate.sections.map((section) => (
                <li key={section}>{section}</li>
              ))}
            </ol>
          </div>

          <div className="rounded-lg border border-zinc-200 p-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Prompt output</h2>
              <CopyButton text={promptOutput} label="Copy prompt" />
            </div>
            <textarea
              className="h-64 w-full rounded-md border border-zinc-300 p-3 font-mono text-xs"
              value={promptOutput}
              readOnly
            />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 p-6">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Markdown scaffold</h2>
          <CopyButton text={markdownOutput} label="Copy scaffold" />
        </div>
        <textarea
          className="h-80 w-full rounded-md border border-zinc-300 p-3 font-mono text-xs"
          value={markdownOutput}
          readOnly
        />
      </section>

      <section className="rounded-xl border border-zinc-200 p-6">
        <h2 className="mb-2 text-lg font-semibold">Section-by-section prompt pack</h2>
        <p className="mb-4 text-sm text-zinc-600">
          Use these prompts to generate each section independently (rewrite + fact-check notes included).
        </p>
        <div className="grid gap-4">
          {sectionPrompts.map((p) => (
            <div key={p.section} className="rounded-lg border border-zinc-200 bg-white/60 p-4 backdrop-blur">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="font-semibold text-zinc-900">{p.section}</div>
                <CopyButton text={p.prompt} label="Copy section prompt" />
              </div>
              <textarea
                className="mt-3 h-40 w-full rounded-md border border-zinc-300 p-3 font-mono text-xs"
                value={p.prompt}
                readOnly
              />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
