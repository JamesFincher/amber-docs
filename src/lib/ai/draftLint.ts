import matter from "gray-matter";
import { isIsoDate } from "@/lib/content/docsWorkflow.shared";
import type { DocStage, DocVisibility } from "@/lib/docs";

export type DraftLintIssue = {
  code: string;
  message: string;
};

export type DraftLintResult = {
  ok: boolean;
  issues: DraftLintIssue[];
  frontmatter: Record<string, unknown>;
  markdown: string;
};

function isStage(v: unknown): v is DocStage {
  return v === "draft" || v === "final" || v === "official";
}

function isVisibility(v: unknown): v is DocVisibility {
  return v === "public" || v === "internal" || v === "private";
}

function safeStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x ?? "")).map((x) => x.trim()).filter(Boolean);
}

function safeCitations(v: unknown): Array<{ label: string; url?: string }> {
  if (!Array.isArray(v)) return [];
  const out: Array<{ label: string; url?: string }> = [];
  for (const item of v) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const label = typeof obj.label === "string" ? obj.label.trim() : "";
    if (!label) continue;
    const url = typeof obj.url === "string" ? obj.url.trim() : "";
    out.push(url ? { label, url } : { label });
  }
  return out;
}

function safeApprovals(v: unknown): Array<{ name: string; date: string }> {
  if (!Array.isArray(v)) return [];
  const out: Array<{ name: string; date: string }> = [];
  for (const item of v) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const name = typeof obj.name === "string" ? obj.name.trim() : "";
    const date = typeof obj.date === "string" ? obj.date.trim() : "";
    if (!name || !date) continue;
    out.push({ name, date });
  }
  return out;
}

function hasH2(markdown: string): boolean {
  const lines = markdown.split(/\r?\n/);
  let inFence = false;
  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (/^##\s+/.test(t)) return true;
  }
  return false;
}

export function lintDraftDocText(docText: string): DraftLintResult {
  const issues: DraftLintIssue[] = [];
  const raw = (docText ?? "").trim();
  if (!raw) {
    return { ok: false, issues: [{ code: "empty", message: "Draft is empty." }], frontmatter: {}, markdown: "" };
  }

  let parsed: matter.GrayMatterFile<string>;
  try {
    parsed = matter(raw);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      issues: [{ code: "frontmatter_parse_error", message: `Frontmatter parse failed: ${msg}` }],
      frontmatter: {},
      markdown: raw,
    };
  }

  const fm = (parsed.data ?? {}) as Record<string, unknown>;
  const markdown = String(parsed.content ?? "").trimEnd() + "\n";

  const slug = typeof fm.slug === "string" ? fm.slug.trim() : "";
  const title = typeof fm.title === "string" ? fm.title.trim() : "";
  const summary = typeof fm.summary === "string" ? fm.summary.trim() : "";
  const updatedAtValue = fm.updatedAt;
  const updatedAt = typeof updatedAtValue === "string" ? updatedAtValue.trim() : "";
  const versionValue = fm.version;
  const version = typeof versionValue === "string" ? versionValue.trim() : "";

  const stage: DocStage | null = isStage(fm.stage) ? fm.stage : null;
  const visibility: DocVisibility | null = isVisibility(fm.visibility) ? fm.visibility : null;
  const archived = typeof fm.archived === "boolean" ? fm.archived : null;

  if (!slug) issues.push({ code: "missing_slug", message: "Missing required frontmatter: slug" });
  if (!title) issues.push({ code: "missing_title", message: "Missing required frontmatter: title" });
  if (!summary) issues.push({ code: "missing_summary", message: "Missing required frontmatter: summary" });
  if (!updatedAt) {
    if (updatedAtValue instanceof Date) {
      issues.push({
        code: "updatedAt_not_string",
        message: 'frontmatter.updatedAt must be a string. Quote it like: updatedAt: "2026-02-08".',
      });
    } else {
      issues.push({ code: "missing_updatedAt", message: "Missing required frontmatter: updatedAt (YYYY-MM-DD)" });
    }
  } else if (!isIsoDate(updatedAt)) {
    issues.push({ code: "bad_updatedAt", message: `updatedAt should look like YYYY-MM-DD (got "${updatedAt}")` });
  }

  if (!version) {
    if (versionValue instanceof Date) {
      issues.push({
        code: "version_not_string",
        message: 'frontmatter.version must be a string. Quote it like: version: "2026-02-08".',
      });
    } else {
      issues.push({ code: "missing_version", message: "Missing required frontmatter: version (usually YYYY-MM-DD)" });
    }
  }
  if (!stage) issues.push({ code: "bad_stage", message: 'frontmatter.stage must be one of: "draft" | "final" | "official"' });
  if (archived === null) issues.push({ code: "missing_archived", message: "Missing frontmatter.archived (published flag). Use true for unpublished drafts." });
  if (!visibility) issues.push({ code: "bad_visibility", message: 'frontmatter.visibility must be one of: "public" | "internal" | "private"' });

  if (!hasH2(markdown)) {
    issues.push({ code: "missing_h2", message: "Doc content should include at least one H2 heading (## ...)." });
  }

  if (stage === "official") {
    const lastReviewedAtValue = fm.lastReviewedAt;
    const lastReviewedAt = typeof lastReviewedAtValue === "string" ? lastReviewedAtValue.trim() : "";
    const owners = safeStringArray(fm.owners);
    const topics = safeStringArray(fm.topics);
    const citations = safeCitations(fm.citations);
    const approvals = safeApprovals(fm.approvals);

    if (!lastReviewedAt) {
      if (lastReviewedAtValue instanceof Date) {
        issues.push({
          code: "official_lastReviewedAt_not_string",
          message: 'frontmatter.lastReviewedAt must be a string. Quote it like: lastReviewedAt: "2026-02-08".',
        });
      } else {
        issues.push({
          code: "official_missing_lastReviewedAt",
          message: "Official docs must include lastReviewedAt (YYYY-MM-DD).",
        });
      }
    } else if (!isIsoDate(lastReviewedAt)) {
      issues.push({ code: "official_missing_lastReviewedAt", message: "Official docs must include lastReviewedAt (YYYY-MM-DD)." });
    }
    if (!owners.length) issues.push({ code: "official_missing_owners", message: "Official docs should include at least 1 owner." });
    if (!topics.length) issues.push({ code: "official_missing_topics", message: "Official docs should include at least 1 topic." });
    if (!citations.length) issues.push({ code: "official_missing_citations", message: "Official docs should include at least 1 citation." });
    if (!approvals.length) issues.push({ code: "official_missing_approvals", message: "Official docs should include at least 1 approval." });
  }

  return { ok: issues.length === 0, issues, frontmatter: fm, markdown };
}
