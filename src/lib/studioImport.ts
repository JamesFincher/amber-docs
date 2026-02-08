import type { Approval, Citation, DocStage, DocVisibility } from "@/lib/docs";

export type StudioImportSuggested = {
  title?: string;
  slug?: string;
  summary?: string;
  stage?: DocStage;
  version?: string;
  updatedAt?: string;
  visibility?: DocVisibility;
  owners?: string[];
  topics?: string[];
  collection?: string;
  order?: number;
  citations?: Citation[];
  approvals?: Approval[];
};

export type StudioImportDraft = {
  v: 1;
  source: "assistant" | "templates";
  createdAt: string;
  docText?: string;
  markdown?: string;
  suggested?: StudioImportSuggested;
};

export const STUDIO_IMPORT_KEY = "amber-docs:studio:import:v1";

function hasLocalStorage(): boolean {
  try {
    return typeof localStorage !== "undefined";
  } catch {
    return false;
  }
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

function isStage(v: unknown): v is DocStage {
  return v === "draft" || v === "final" || v === "official";
}

function isVisibility(v: unknown): v is DocVisibility {
  return v === "public" || v === "internal" || v === "private";
}

function safeCitations(v: unknown): Citation[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: Citation[] = [];
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

function safeApprovals(v: unknown): Approval[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: Approval[] = [];
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

export function saveStudioImport(draft: StudioImportDraft): boolean {
  if (!hasLocalStorage()) return false;
  try {
    localStorage.setItem(STUDIO_IMPORT_KEY, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function readStudioImport(): StudioImportDraft | null {
  if (!hasLocalStorage()) return null;
  try {
    const raw = localStorage.getItem(STUDIO_IMPORT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const obj = parsed as Record<string, unknown>;
    if (obj.v !== 1) return null;
    if (obj.source !== "assistant" && obj.source !== "templates") return null;
    if (typeof obj.createdAt !== "string" || !obj.createdAt.trim()) return null;

    const suggestedRaw = obj.suggested;
    const suggestedObj =
      suggestedRaw && typeof suggestedRaw === "object" && !Array.isArray(suggestedRaw)
        ? (suggestedRaw as Record<string, unknown>)
        : null;

    const suggested: StudioImportSuggested | undefined = suggestedObj
      ? {
          title: typeof suggestedObj.title === "string" ? suggestedObj.title : undefined,
          slug: typeof suggestedObj.slug === "string" ? suggestedObj.slug : undefined,
          summary: typeof suggestedObj.summary === "string" ? suggestedObj.summary : undefined,
          stage: isStage(suggestedObj.stage) ? suggestedObj.stage : undefined,
          version: typeof suggestedObj.version === "string" ? suggestedObj.version : undefined,
          updatedAt: typeof suggestedObj.updatedAt === "string" ? suggestedObj.updatedAt : undefined,
          visibility: isVisibility(suggestedObj.visibility) ? suggestedObj.visibility : undefined,
          owners: isStringArray(suggestedObj.owners) ? suggestedObj.owners : undefined,
          topics: isStringArray(suggestedObj.topics) ? suggestedObj.topics : undefined,
          collection: typeof suggestedObj.collection === "string" ? suggestedObj.collection : undefined,
          order: typeof suggestedObj.order === "number" && Number.isFinite(suggestedObj.order) ? suggestedObj.order : undefined,
          citations: safeCitations(suggestedObj.citations),
          approvals: safeApprovals(suggestedObj.approvals),
        }
      : undefined;

    const docText = typeof obj.docText === "string" ? obj.docText : undefined;
    const markdown = typeof obj.markdown === "string" ? obj.markdown : undefined;
    if (!docText && !markdown && !suggested) return null;

    return {
      v: 1,
      source: obj.source,
      createdAt: obj.createdAt,
      docText,
      markdown,
      suggested,
    };
  } catch {
    return null;
  }
}

export function clearStudioImport(): void {
  if (!hasLocalStorage()) return;
  try {
    localStorage.removeItem(STUDIO_IMPORT_KEY);
  } catch {
    // ignore
  }
}

