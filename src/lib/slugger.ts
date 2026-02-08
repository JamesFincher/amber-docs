function normalizeForSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    // Keep ASCII only; strip punctuation-ish.
    .replace(/['"`]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export type Slugger = {
  slug: (value: string) => string;
};

// GitHub-ish heading slugger: same text produces the same base slug,
// and duplicates get suffixed: "foo", "foo-1", "foo-2", ...
export function createSlugger(): Slugger {
  const counts = new Map<string, number>();
  return {
    slug(value: string) {
      const base = normalizeForSlug(value) || "section";
      const n = counts.get(base) ?? 0;
      counts.set(base, n + 1);
      return n === 0 ? base : `${base}-${n}`;
    },
  };
}

