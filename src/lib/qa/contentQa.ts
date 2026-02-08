import fs from "node:fs";
import path from "node:path";

import { listDocSlugs, listDocVersions, loadAllDocs } from "../content/docs.server";
import { loadGlossary } from "../content/blocks.server";

export type Failure = {
  code: string;
  message: string;
};

export type ContentQaOptions = {
  // Root of the project containing `public/` for asset checks.
  projectRoot?: string;
  // Optionally override the content directory for the duration of the run.
  contentDir?: string;
  // Skip external link checks (defaults to env SKIP_EXTERNAL_LINKS=1).
  skipExternalLinks?: boolean;
  // Injectable fetch for testing.
  fetchImpl?: typeof fetch;
};

export type ContentQaResult = {
  ok: boolean;
  failures: Failure[];
  docsCount: number;
};

function isValidDateString(value: string | undefined | null): boolean {
  if (!value) return false;
  const d = new Date(value);
  return !Number.isNaN(d.getTime());
}

function fail(code: string, message: string, failures: Failure[]) {
  failures.push({ code, message });
}

function findInternalLinks(
  markdown: string,
): Array<{ kind: "docs" | "raw"; slug: string; version: string | null; raw: string }> {
  const out: Array<{ kind: "docs" | "raw"; slug: string; version: string | null; raw: string }> = [];
  const re = /\]\((\/[^)\s#]+)(#[^)]+)?\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown))) {
    const href = m[1];
    const raw = m[0];

    // /docs/<slug>
    let mm = href.match(/^\/docs\/([^/]+)$/);
    if (mm) {
      out.push({ kind: "docs", slug: mm[1], version: null, raw });
      continue;
    }

    // /docs/<slug>/v/<version>
    mm = href.match(/^\/docs\/([^/]+)\/v\/([^/]+)$/);
    if (mm) {
      out.push({ kind: "docs", slug: mm[1], version: mm[2], raw });
      continue;
    }

    // /raw/<slug>
    mm = href.match(/^\/raw\/([^/]+)$/);
    if (mm) {
      out.push({ kind: "raw", slug: mm[1], version: null, raw });
      continue;
    }

    // /raw/v/<slug>/<version>
    mm = href.match(/^\/raw\/v\/([^/]+)\/([^/]+)$/);
    if (mm) {
      out.push({ kind: "raw", slug: mm[1], version: mm[2], raw });
      continue;
    }
  }
  return out;
}

function findExternalLinks(markdown: string): string[] {
  const urls: string[] = [];
  const re = /\]\((https?:\/\/[^)\s]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown))) urls.push(m[1]);
  return urls;
}

function stripCodeFences(markdown: string): string {
  // For simple scanning policies (numbers, glossary case).
  return markdown.replace(/```[\s\S]*?```/g, " ");
}

function containsH2(markdown: string): boolean {
  const lines = markdown.split(/\r?\n/);
  let inFence = false;
  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (/^##\s+/.test(line)) return true;
  }
  return false;
}

function listPublicFiles(projectRoot: string): Set<string> {
  const root = path.join(projectRoot, "public");
  const out = new Set<string>();
  if (!fs.existsSync(root)) return out;

  const stack = [root];
  while (stack.length) {
    const dir = stack.pop()!;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else out.add(full);
    }
  }

  return out;
}

function findAssetLinks(markdown: string): string[] {
  // Matches images: ![alt](/path)
  const out: string[] = [];
  const re = /!\[[^\]]*\]\((\/[^)\s]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown))) out.push(m[1]);
  return out;
}

async function validateExternalLinks(args: {
  urls: string[];
  failures: Failure[];
  fetchImpl: typeof fetch;
  skipExternalLinks: boolean;
}) {
  if (args.urls.length === 0) return;
  if (args.skipExternalLinks) return;

  const unique = Array.from(new Set(args.urls)).slice(0, 250);
  const timeoutMs = 8000;
  const concurrency = 8;

  async function check(url: string) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      // HEAD is faster, but many hosts block it. Fall back to GET.
      const head = await args.fetchImpl(url, { method: "HEAD", redirect: "follow", signal: ctrl.signal });
      if (head.ok || (head.status >= 300 && head.status < 400) || head.status === 429) return;
      const get = await args.fetchImpl(url, { method: "GET", redirect: "follow", signal: ctrl.signal });
      if (get.ok || (get.status >= 300 && get.status < 400) || get.status === 429) return;
      fail("external_link", `External link failed (${head.status}/${get.status}): ${url}`, args.failures);
    } catch {
      fail("external_link", `External link failed (network): ${url}`, args.failures);
    } finally {
      clearTimeout(t);
    }
  }

  const queue = unique.slice();
  const workers = Array.from({ length: concurrency }, async () => {
    while (queue.length) {
      const next = queue.pop();
      if (!next) break;
      await check(next);
    }
  });

  await Promise.all(workers);
}

export async function runContentQa(options: ContentQaOptions = {}): Promise<ContentQaResult> {
  const failures: Failure[] = [];

  const projectRoot = options.projectRoot ?? process.cwd();
  const skipExternalLinks = options.skipExternalLinks ?? process.env.SKIP_EXTERNAL_LINKS === "1";
  const fetchImpl = options.fetchImpl ?? fetch;

  const prevContentDir = process.env.AMBER_DOCS_CONTENT_DIR;
  if (options.contentDir) process.env.AMBER_DOCS_CONTENT_DIR = options.contentDir;
  try {
    const allDocs = loadAllDocs();
    const slugs = listDocSlugs();
    const docs = slugs.flatMap((slug) => listDocVersions(slug));
    const allSlugs = new Set(allDocs.map((d) => d.slug));
    const glossary = loadGlossary();
    const publicFiles = listPublicFiles(projectRoot);

    const slugVersion = new Set<string>();
    const bySlug = new Map<string, typeof docs>();
    const canonicalByTopic = new Map<string, (typeof docs)[number]>();

    for (const d of allDocs) {
      const key = `${d.slug}@${d.version}`;
      if (slugVersion.has(key)) fail("duplicate_doc_version", `Duplicate doc version: ${key}`, failures);
      slugVersion.add(key);
    }

    for (const d of docs) {
      const key = `${d.slug}@${d.version}`;

      const arr = bySlug.get(d.slug) ?? [];
      arr.push(d);
      bySlug.set(d.slug, arr);

      if (!d.title.trim()) fail("missing_title", `Missing title for ${key}`, failures);
      if (!d.summary.trim()) fail("missing_summary", `Missing summary for ${key}`, failures);
      if (!isValidDateString(d.updatedAt)) fail("bad_updatedAt", `Bad updatedAt for ${key}: ${d.updatedAt}`, failures);
      if (d.lastReviewedAt && !isValidDateString(d.lastReviewedAt))
        fail("bad_lastReviewedAt", `Bad lastReviewedAt for ${key}: ${d.lastReviewedAt}`, failures);

      if (!containsH2(d.markdown)) fail("missing_h2", `Doc ${key} should have at least one H2 (## ...)`, failures);

      // Canonical docs (optional): used for contradiction scans vs canonical facts.
      if (d.canonicalFor?.length) {
        if (d.stage !== "official") {
          fail("canonical_not_official", `Canonical doc ${key} must be Official`, failures);
        }
        for (const topic of d.canonicalFor) {
          const prev = canonicalByTopic.get(topic);
          if (prev) {
            fail(
              "duplicate_canonical",
              `Duplicate canonical doc for topic "${topic}": ${prev.slug}@${prev.version} and ${key}`,
              failures,
            );
            continue;
          }
          canonicalByTopic.set(topic, d);
        }
      }

      if (d.stage === "official") {
        if (!d.owners.length) fail("official_missing_owners", `Official doc ${key} missing owners`, failures);
        if (!isValidDateString(d.lastReviewedAt))
          fail("official_missing_lastReviewedAt", `Official doc ${key} missing/invalid lastReviewedAt`, failures);
        if (!d.topics.length) fail("official_missing_topics", `Official doc ${key} should have at least 1 topic`, failures);
        if (!d.citations.length)
          fail("official_missing_citations", `Official doc ${key} should include citations (even if internal)`, failures);
        if (!d.approvals.length)
          fail("official_missing_approvals", `Official doc ${key} should include approvals (promotion gate)`, failures);

        // Claims heuristic: if we see any numbers/dates, ensure there is at least one citation.
        const scan = stripCodeFences(d.markdown);
        const hasNumbers = /\b\d+(?:\.\d+)?%?\b/.test(scan);
        const hasDates = /\b\d{4}-\d{2}-\d{2}\b/.test(scan);
        if ((hasNumbers || hasDates) && !d.citations.length) {
          fail("official_claims_no_citations", `Official doc ${key} has numeric/date claims but no citations`, failures);
        }

        // Contradiction scan (optional): compare `facts` to canonical doc facts when topics match.
        for (const topic of d.topics) {
          const canonical = canonicalByTopic.get(topic);
          if (!canonical) continue;
          if (canonical.slug === d.slug && canonical.version === d.version) continue;
          for (const [factKey, factValue] of Object.entries(d.facts ?? {})) {
            const canonValue = (canonical.facts ?? {})[factKey];
            if (!canonValue) continue;
            if (canonValue !== factValue) {
              fail(
                "fact_contradiction",
                `Official doc ${key} fact "${factKey}"="${factValue}" contradicts canonical ${canonical.slug}@${canonical.version} ("${canonValue}") for topic "${topic}"`,
                failures,
              );
            }
          }
        }
      }

      // Related slugs should exist (latest alias is fine).
      for (const s of d.relatedSlugs ?? []) {
        if (!allSlugs.has(s)) {
          fail("bad_related_slug", `Doc ${key} has relatedSlugs entry that does not exist: "${s}"`, failures);
        }
      }

      // Internal links should resolve (support versioned and unversioned).
      for (const link of findInternalLinks(d.markdown)) {
        if (link.version) {
          const exists = docs.some((x) => x.slug === link.slug && x.version === link.version);
          if (!exists) {
            const target =
              link.kind === "raw"
                ? `/raw/v/${link.slug}/${link.version}`
                : `/docs/${link.slug}/v/${link.version}`;
            fail("broken_internal_link", `Doc ${key} links to missing ${target}: ${link.raw}`, failures);
          }
        } else {
          const exists = docs.some((x) => x.slug === link.slug);
          if (!exists) {
            fail("broken_internal_link", `Doc ${key} links to missing /${link.kind}/${link.slug}: ${link.raw}`, failures);
          }
        }
      }

      // Asset links should exist in public/.
      for (const asset of findAssetLinks(d.markdown)) {
        const expected = path.join(projectRoot, "public", asset.replace(/^\//, ""));
        if (!publicFiles.has(expected)) {
          fail("missing_asset", `Doc ${key} references missing asset: ${asset}`, failures);
        }
      }

      // Terminology enforcement (light): glossary terms must match case when referenced in official docs.
      if (d.stage === "official") {
        const scan = stripCodeFences(d.markdown);
        for (const g of glossary) {
          const term = g.term;
          const escaped = term.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&");
          const reAny = new RegExp(`\\b${escaped}\\b`, "i");
          if (!reAny.test(scan)) continue;
          const reExact = new RegExp(`\\b${escaped}\\b`, "g");
          if (!reExact.test(scan)) {
            fail("glossary_case", `Official doc ${key} references glossary term with incorrect case: "${term}"`, failures);
          }
        }
      }
    }

    // Per-slug sanity: versions should be unique and latest should be deterministically sorted by updatedAt.
    for (const [slug, versions] of bySlug.entries()) {
      const sorted = [...versions].sort((a, b) =>
        a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0,
      );
      const latest = sorted[0];
      if (!latest) continue;
      if (!isValidDateString(latest.updatedAt)) fail("latest_bad_updatedAt", `Latest for ${slug} has invalid updatedAt`, failures);
    }

    // External links (global, deduped).
    const external = docs.flatMap((d) => findExternalLinks(d.markdown));
    await validateExternalLinks({ urls: external, failures, fetchImpl, skipExternalLinks });

    return { ok: failures.length === 0, failures, docsCount: docs.length };
  } finally {
    if (options.contentDir) {
      if (prevContentDir === undefined) delete process.env.AMBER_DOCS_CONTENT_DIR;
      else process.env.AMBER_DOCS_CONTENT_DIR = prevContentDir;
    }
  }
}
