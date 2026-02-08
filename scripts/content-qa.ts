import { docs } from "../src/lib/docs";

type Failure = {
  code: string;
  message: string;
};

function isValidDateString(value: string | undefined): boolean {
  if (!value) return false;
  const d = new Date(value);
  return !Number.isNaN(d.getTime());
}

function fail(code: string, message: string, failures: Failure[]) {
  failures.push({ code, message });
}

function findInternalLinks(markdown: string): Array<{ kind: "docs" | "raw"; slug: string; raw: string }> {
  const out: Array<{ kind: "docs" | "raw"; slug: string; raw: string }> = [];
  const re = /\]\((\/(docs|raw)\/([^)\s#]+))(#[^)]+)?\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown))) {
    const kind = m[2] as "docs" | "raw";
    const slug = m[3];
    out.push({ kind, slug, raw: m[0] });
  }
  return out;
}

async function main() {
  const failures: Failure[] = [];
  const slugs = new Set<string>();

  for (const d of docs) {
    if (slugs.has(d.slug)) {
      fail("duplicate_slug", `Duplicate slug: "${d.slug}"`, failures);
    }
    slugs.add(d.slug);

    if (!d.title.trim()) fail("missing_title", `Missing title for slug "${d.slug}"`, failures);
    if (!d.summary.trim()) fail("missing_summary", `Missing summary for slug "${d.slug}"`, failures);
    if (!isValidDateString(d.updatedAt)) fail("bad_updatedAt", `Bad updatedAt for "${d.slug}": ${d.updatedAt}`, failures);

    // Ignore headings inside fenced code blocks.
    const lines = d.markdown.split(/\r?\n/);
    let inFence = false;
    let hasH2 = false;
    for (const line of lines) {
      if (line.trim().startsWith("```")) {
        inFence = !inFence;
        continue;
      }
      if (inFence) continue;
      if (/^##\s+/.test(line)) {
        hasH2 = true;
        break;
      }
    }
    if (!hasH2) fail("missing_h2", `Doc "${d.slug}" should have at least one H2 (## ...)`, failures);

    if (d.stage === "official") {
      if (!d.owners?.length) fail("official_missing_owners", `Official doc "${d.slug}" missing owners`, failures);
      if (!isValidDateString(d.lastReviewedAt))
        fail("official_missing_lastReviewedAt", `Official doc "${d.slug}" missing/invalid lastReviewedAt`, failures);
      if (!(d.topics?.length ?? 0))
        fail("official_missing_topics", `Official doc "${d.slug}" should have at least 1 topic`, failures);
    }

    for (const s of d.relatedSlugs ?? []) {
      if (!slugs.has(s) && !docs.some((x) => x.slug === s)) {
        fail("bad_related_slug", `Doc "${d.slug}" has relatedSlugs entry that does not exist: "${s}"`, failures);
      }
    }

    for (const link of findInternalLinks(d.markdown)) {
      if (!docs.some((x) => x.slug === link.slug)) {
        fail(
          "broken_internal_link",
          `Doc "${d.slug}" has broken internal link to /${link.kind}/${link.slug}: ${link.raw}`,
          failures,
        );
      }
    }
  }

  if (failures.length) {
    console.error(`Content QA failed (${failures.length}):`);
    for (const f of failures) console.error(`- [${f.code}] ${f.message}`);
    process.exit(1);
  }

  console.log(`Content QA passed (${docs.length} docs).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
