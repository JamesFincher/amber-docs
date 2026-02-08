"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DocTemplate } from "@/lib/templates";
import { buildMarkdownSkeleton, buildPrompt, buildSectionPromptPack } from "@/lib/templates";
import { CopyButton } from "@/components/CopyButton";

const CUSTOM_KEY = "amber-docs:templates:custom:v1";

function uniqById(templates: DocTemplate[]): DocTemplate[] {
  const map = new Map<string, DocTemplate>();
  for (const t of templates) map.set(t.id, t);
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function safeParseCustomTemplates(raw: string): DocTemplate[] | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    // Minimal runtime validation; full validation lives in the server loader + QA.
    const out: DocTemplate[] = [];
    for (const item of parsed) {
      if (typeof item !== "object" || item === null) return null;
      const any = item as Record<string, unknown>;
      if (typeof any.id !== "string" || typeof any.name !== "string" || typeof any.description !== "string") return null;
      if (!Array.isArray(any.requiredFields) || !Array.isArray(any.sections)) return null;
      out.push({
        id: any.id,
        name: any.name,
        description: any.description,
        tags: Array.isArray(any.tags) ? (any.tags.filter((x) => typeof x === "string") as string[]) : [],
        requiredFields: (any.requiredFields as unknown[]).map((f) => {
          const ff = f as Record<string, unknown>;
          return {
            key: String(ff.key ?? ""),
            label: String(ff.label ?? ""),
            placeholder: String(ff.placeholder ?? ""),
          };
        }),
        sections: (any.sections as unknown[]).map((s) => {
          const ss = s as Record<string, unknown>;
          return { title: String(ss.title ?? ""), optional: Boolean(ss.optional ?? false) };
        }),
      });
    }
    return out;
  } catch {
    return null;
  }
}

function readCustomTemplates(): DocTemplate[] {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY);
    if (!raw) return [];
    return safeParseCustomTemplates(raw) ?? [];
  } catch {
    return [];
  }
}

function writeCustomTemplates(templates: DocTemplate[]) {
  localStorage.setItem(CUSTOM_KEY, JSON.stringify(templates, null, 2));
}

export function TemplatesClient({ templates }: { templates: DocTemplate[] }) {
  const [custom, setCustom] = useState<DocTemplate[]>([]);
  const [templateId, setTemplateId] = useState<string>(templates[0]?.id ?? "");
  const [topic, setTopic] = useState("Amber Protocol Governance Update");
  const [values, setValues] = useState<Record<string, string>>({});
  const [enabledOptional, setEnabledOptional] = useState<Set<string>>(new Set());
  const [customJson, setCustomJson] = useState<string>("[]");

  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const loaded = readCustomTemplates();
    setCustom(loaded);
    setCustomJson(JSON.stringify(loaded, null, 2));
  }, []);

  const allTemplates = useMemo(() => uniqById([...templates, ...custom]), [templates, custom]);

  const selectedTemplate = useMemo(
    () => allTemplates.find((t) => t.id === templateId) ?? allTemplates[0],
    [allTemplates, templateId],
  );

  useEffect(() => {
    if (!selectedTemplate) return;
    setTemplateId(selectedTemplate.id);
    setEnabledOptional(new Set());
    setValues({});
  }, [selectedTemplate?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const promptOutput = useMemo(() => {
    if (!selectedTemplate) return "";
    return buildPrompt({ template: selectedTemplate, inputValues: values, topic, enabledOptional });
  }, [selectedTemplate, values, topic, enabledOptional]);

  const markdownOutput = useMemo(() => {
    if (!selectedTemplate) return "";
    return buildMarkdownSkeleton({ template: selectedTemplate, inputValues: values, topic, enabledOptional });
  }, [selectedTemplate, values, topic, enabledOptional]);

  const sectionPrompts = useMemo(() => {
    if (!selectedTemplate) return [];
    return buildSectionPromptPack({ template: selectedTemplate, inputValues: values, topic, enabledOptional });
  }, [selectedTemplate, values, topic, enabledOptional]);

  function toggleOptional(title: string) {
    setEnabledOptional((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  }

  function downloadJson(filename: string, json: unknown) {
    const blob = new Blob([JSON.stringify(json, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function onImportFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const parsed = safeParseCustomTemplates(text);
      if (!parsed) {
        alert("Invalid templates JSON. Expected an array of templates.");
        return;
      }
      setCustom(parsed);
      setCustomJson(JSON.stringify(parsed, null, 2));
      writeCustomTemplates(parsed);
    };
    reader.readAsText(file);
  }

  function onSaveCustomJson() {
    const parsed = safeParseCustomTemplates(customJson);
    if (!parsed) {
      alert("Invalid templates JSON. Expected an array of templates.");
      return;
    }
    setCustom(parsed);
    writeCustomTemplates(parsed);
    alert("Saved custom templates locally.");
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <header className="mb-8 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-zinc-700">Templates</p>
            <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">Write a document</h1>
          </div>
          <nav className="flex flex-wrap gap-2">
            <Link href="/docs" className="btn btn-secondary">
              Documents
            </Link>
            <Link href="/blocks" className="btn btn-secondary">
              Reusable text
            </Link>
            <Link href="/" className="btn btn-secondary">
              Home
            </Link>
            <Link href="/help" className="btn btn-secondary">
              Help
            </Link>
          </nav>
        </div>
        <p className="max-w-3xl text-zinc-800">
          Pick a template, fill in a few details, then copy the prompt or the Markdown scaffold. Advanced: you can import/export custom templates as JSON.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <div className="grid gap-4">
            <div className="font-display text-2xl font-semibold">Step 1: Pick a template</div>
            <label className="block text-base font-semibold text-zinc-800">
              Template type
              <select
                className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
              >
                {allTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-base font-semibold text-zinc-800">
              Topic (document title)
              <input
                className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Example: Q3 Treasury Strategy"
              />
            </label>

            {selectedTemplate ? (
              <div className="rounded-xl border border-zinc-200 bg-white p-4 text-base text-zinc-800">
                <div className="font-semibold text-zinc-900">{selectedTemplate.name}</div>
                <div className="mt-1">{selectedTemplate.description}</div>
                {selectedTemplate.tags.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedTemplate.tags.map((tag) => (
                      <span key={tag} className="chip chip-muted">
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {selectedTemplate ? (
              <div className="grid gap-3">
                <div className="font-display text-2xl font-semibold">Step 2: Fill in details</div>
                {selectedTemplate.requiredFields.map((field) => (
                  <label key={field.key} className="block text-base font-semibold text-zinc-800">
                    {field.label}
                    <input
                      className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base"
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
            ) : null}
          </div>
        </div>

        <div className="card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="font-display text-2xl font-semibold">Step 3: Choose sections</div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                className="btn btn-secondary"
                onClick={() => downloadJson("amber-templates.json", [...templates, ...custom])}
              >
                Export all
              </button>
              <button className="btn btn-secondary" onClick={() => fileRef.current?.click()}>
                Import
              </button>
              <input
                ref={fileRef}
                className="hidden"
                type="file"
                accept="application/json"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onImportFile(file);
                  e.currentTarget.value = "";
                }}
              />
            </div>
          </div>

          {selectedTemplate ? (
            <div className="mt-4 grid gap-2">
              {selectedTemplate.sections.map((s) => (
                <label
                  key={s.title}
                  className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3"
                >
                  <div className="text-base font-semibold text-zinc-900">{s.title}</div>
                  {s.optional ? (
                    <input
                      type="checkbox"
                      checked={enabledOptional.has(s.title)}
                      onChange={() => toggleOptional(s.title)}
                      className="h-5 w-5"
                    />
                  ) : (
                    <span className="chip chip-muted">required</span>
                  )}
                </label>
              ))}
            </div>
          ) : null}

          <details className="mt-6">
            <summary className="cursor-pointer text-base font-semibold text-zinc-900">
              Advanced: Custom templates (JSON)
            </summary>
            <p className="mt-2 text-zinc-700">
              You can save templates locally (in this browser), or export JSON and commit it to <code>content/templates/</code>.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button className="btn btn-primary" onClick={onSaveCustomJson}>
                Save locally
              </button>
              <button className="btn btn-secondary" onClick={() => downloadJson("amber-custom-templates.json", custom)}>
                Export custom
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setCustom([]);
                  setCustomJson("[]");
                  writeCustomTemplates([]);
                }}
              >
                Clear custom
              </button>
            </div>
            <textarea
              className="mt-3 h-56 w-full rounded-xl border border-zinc-200 bg-zinc-950 p-4 font-mono text-sm text-zinc-50"
              value={customJson}
              onChange={(e) => setCustomJson(e.target.value)}
              spellCheck={false}
            />
          </details>
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-2xl font-semibold">Copy: AI prompt</h2>
            <CopyButton text={promptOutput} label="Copy prompt" />
          </div>
          <textarea
            className="h-72 w-full rounded-xl border border-zinc-200 bg-white p-4 font-mono text-sm text-zinc-900"
            value={promptOutput}
            readOnly
            spellCheck={false}
          />
        </div>

        <div className="card p-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-2xl font-semibold">Copy: Markdown scaffold</h2>
            <CopyButton text={markdownOutput} label="Copy scaffold" />
          </div>
          <textarea
            className="h-72 w-full rounded-xl border border-zinc-200 bg-white p-4 font-mono text-sm text-zinc-900"
            value={markdownOutput}
            readOnly
            spellCheck={false}
          />
        </div>
      </section>

      <section className="mt-8 card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-semibold">Copy: Section-by-section prompts</h2>
            <p className="mt-1 text-zinc-700">
              Use these prompts to draft each section independently.
            </p>
          </div>
          <CopyButton
            text={sectionPrompts.map((p) => `## ${p.section}\n\n${p.prompt.trim()}\n`).join("\n\n---\n\n")}
            label="Copy all"
          />
        </div>
        <div className="mt-4 grid gap-4">
          {sectionPrompts.map((p) => (
            <div key={p.section} className="rounded-2xl border border-zinc-200 bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="font-semibold text-zinc-900">{p.section}</div>
                <CopyButton text={p.prompt} label="Copy section prompt" />
              </div>
              <textarea
                className="mt-3 h-44 w-full rounded-xl border border-zinc-200 bg-white p-4 font-mono text-sm text-zinc-900"
                value={p.prompt}
                readOnly
                spellCheck={false}
              />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
