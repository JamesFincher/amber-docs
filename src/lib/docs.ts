export type DocStage = "draft" | "final" | "official";

export type Citation = {
  label: string;
  url?: string;
};

export type Approval = {
  name: string;
  date: string;
};

export type TocItem = {
  id: string;
  depth: 2 | 3;
  text: string;
};

export type DocRecord = {
  slug: string;
  version: string;
  title: string;
  stage: DocStage;
  updatedAt: string;
  lastReviewedAt?: string;
  owners: string[];
  topics: string[];
  collection?: string;
  order?: number;
  summary: string;
  markdown: string;
  aiChecks: string[];
  relatedContext: string[];
  relatedSlugs: string[];
  citations: Citation[];
  approvals: Approval[];

  // Derived fields (build-time).
  toc: TocItem[];
  headings: string[];
  searchText: string;
  contentHash: string;

  // Local-only metadata.
  sourcePath: string;
};

export function docsTopics(d: DocRecord): string[] {
  return (d.topics ?? []).map((t) => t.trim()).filter(Boolean);
}

export function hasCitations(d: DocRecord): boolean {
  return (d.citations?.length ?? 0) > 0;
}

export function needsReview(d: Pick<DocRecord, "lastReviewedAt">, now = new Date()): boolean {
  if (!d.lastReviewedAt) return true;
  const reviewed = new Date(d.lastReviewedAt);
  if (Number.isNaN(reviewed.getTime())) return true;
  // Default policy: review within 90 days.
  const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
  return now.getTime() - reviewed.getTime() > ninetyDaysMs;
}

export function stageBadgeClass(stage: DocStage): string {
  switch (stage) {
    case "draft":
      return "bg-amber-100 text-amber-900";
    case "final":
      return "bg-sky-100 text-sky-900";
    case "official":
      return "bg-emerald-100 text-emerald-900";
  }
}

export function docKey(d: Pick<DocRecord, "slug" | "version">): string {
  return `${d.slug}@${d.version}`;
}
