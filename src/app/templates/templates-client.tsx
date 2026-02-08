"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DocTemplate } from "@/lib/templates";
import { buildMarkdownSkeleton, buildPrompt, buildSectionPromptPack } from "@/lib/templates";
import { CopyButton } from "@/components/CopyButton";
import { geminiGenerateText } from "@/lib/ai/gemini";

const CUSTOM_KEY = "amber-docs:templates:custom:v1";
const GEMINI_KEY = "amber-docs:ai:gemini:key:v1";
const GEMINI_MODEL_KEY = "amber-docs:ai:gemini:model:v1";

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
  const [geminiApiKey, setGeminiApiKey] = useState<string>("");
  const [geminiModel, setGeminiModel] = useState<string>("gemini-2.0-flash");
  const [generated, setGenerated] = useState<string>("");
  const [genBusy, setGenBusy] = useState<boolean>(false);
  const [genError, setGenError] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const loaded = readCustomTemplates();
    setCustom(loaded);
    setCustomJson(JSON.stringify(loaded, null, 2));
  }, []);

  useEffect(() => {
    try {
      const key = localStorage.getItem(GEMINI_KEY);
      const model = localStorage.getItem(GEMINI_MODEL_KEY);
      if (key) setGeminiApiKey(key);
      if (model) setGeminiModel(model);
    } catch {
      // ignore
    }
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

  function downloadText(filename: string, text: string, mime = "text/plain") {
    const blob = new Blob([text], { type: `${mime}; charset=utf-8` });
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

  async function onGenerateWithGemini() {
    const key = geminiApiKey.trim();
    const model = geminiModel.trim();
    if (!key) return alert("Add your Google AI (Gemini) API key first.");
    if (!model) return alert("Choose a Gemini model first.");

    setGenBusy(true);
    setGenError(null);
    try {
      try {
        localStorage.setItem(GEMINI_KEY, key);
        localStorage.setItem(GEMINI_MODEL_KEY, model);
      } catch {
        // ignore
      }

      const prompt = `${promptOutput.trim()}\n\nOutput requirements:\n- Return only the final Markdown document.\n- Do not wrap it in code fences.\n`;
      const out = await geminiGenerateText({
        apiKey: key,
        model,
        prompt,
        temperature: 0.4,
        maxOutputTokens: 4096,
      });
      setGenerated(out.text.trimEnd() + "\n");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setGenError(msg);
      setGenerated("");
    } finally {
      setGenBusy(false);
    }
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
            <h2 className="font-display text-2xl font-semibold">Step 4 (Optional): Generate with Google AI</h2>
            <p className="mt-1 text-zinc-700">
              This calls the Gemini API directly from your browser. Your API key is saved locally on this computer (in this browser) to avoid retyping.
            </p>
          </div>
          <button className="btn btn-primary" type="button" onClick={onGenerateWithGemini} disabled={genBusy}>
            {genBusy ? "Generating..." : "Generate Markdown"}
          </button>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <label className="block">
            <div className="text-sm font-semibold text-zinc-800">Gemini API key</div>
            <input
              className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base"
              value={geminiApiKey}
              onChange={(e) => setGeminiApiKey(e.target.value)}
              placeholder="Paste your key here"
              type="password"
              autoComplete="off"
            />
            <div className="mt-2 text-sm text-zinc-600">
              Tip: If you do not want it remembered, clear this field after you generate.
            </div>
          </label>

          <label className="block">
            <div className="text-sm font-semibold text-zinc-800">Model</div>
            <input
              className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base"
              value={geminiModel}
              onChange={(e) => setGeminiModel(e.target.value)}
              placeholder="Example: gemini-2.0-flash"
              autoComplete="off"
            />
            <div className="mt-2 text-sm text-zinc-600">
              Suggested: <span className="font-semibold">gemini-2.0-flash</span> for speed, or <span className="font-semibold">gemini-2.5-pro</span> for depth (if available).
            </div>
          </label>
        </div>

        {genError ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            <div className="font-semibold">Generation failed</div>
            <div className="mt-1">{genError}</div>
          </div>
        ) : null}

        <div className="mt-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="font-display text-2xl font-semibold">Generated Markdown</div>
            <div className="flex flex-wrap items-center gap-2">
              <CopyButton text={generated} label="Copy generated" />
              <button
                className="btn btn-secondary"
                type="button"
                disabled={!generated.trim()}
                onClick={() => downloadText(`${topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "document"}.md`, generated, "text/markdown")}
              >
                Download .md
              </button>
            </div>
          </div>
          <textarea
            className="h-80 w-full rounded-xl border border-zinc-200 bg-white p-4 font-mono text-sm text-zinc-900"
            value={generated}
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
