import fs from "node:fs";
import { pathToFileURL } from "node:url";
import type { Approval } from "../src/lib/docs";
import {
  cloneLatestToNewVersion,
  createDocFile,
  deleteAllDocVersions,
  deleteDocVersion,
  finalizeDocVersion,
  parseStage,
  promoteDocVersionToOfficial,
  publishDocVersion,
  unpublishDocVersion,
  updateDocFile,
} from "../src/lib/content/docsWorkflow.server";

type Parsed = {
  command: string | null;
  flags: Record<string, string | boolean>;
  positionals: string[];
};

function parseArgv(argv: string[]): Parsed {
  const flags: Record<string, string | boolean> = {};
  const positionals: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i] ?? "";
    if (token.startsWith("--")) {
      const raw = token.slice(2);
      const eq = raw.indexOf("=");
      const key = (eq >= 0 ? raw.slice(0, eq) : raw).trim();
      if (!key) continue;

      const inline = eq >= 0 ? raw.slice(eq + 1) : null;
      if (inline !== null) {
        flags[key] = inline;
        continue;
      }

      const next = argv[i + 1];
      if (next && !next.startsWith("-")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
      continue;
    }

    positionals.push(token);
  }

  const [command, ...rest] = positionals;
  return { command: command ?? null, flags, positionals: rest };
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

function asBool(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  if (typeof v !== "string") return null;
  if (v === "1" || v.toLowerCase() === "true") return true;
  if (v === "0" || v.toLowerCase() === "false") return false;
  return null;
}

function parseList(v: string | null): string[] {
  if (!v) return [];
  return v
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function parseApprovals(v: string | null): Approval[] {
  if (!v) return [];
  const out: Approval[] = [];
  for (const item of v.split(",")) {
    const [name, date] = item.split(":").map((x) => x.trim());
    if (!name || !date) continue;
    out.push({ name, date });
  }
  return out;
}

function usage(): string {
  return `Amber Docs workflow

Usage:
  pnpm tsx scripts/docs-workflow.ts <command> [flags]

Commands:
  new         Create a new doc file (default: unpublished draft)
  clone       Clone latest published doc into a new version (default: unpublished draft)
  update      Patch frontmatter and/or markdown for a doc version
  publish     Publish a doc version (makes it visible in the app)
  unpublish   Unpublish a doc version (hides it from the app)
  finalize    Mark a doc version as Final
  official    Mark a doc version as Official (sets lastReviewedAt)
  archive     Alias for unpublish
  delete      Delete one doc version file
  delete-all  Delete all versions for a slug

Common flags:
  --slug <slug> --version <version>

new flags:
  --title <title> --summary <summary> [--updated-at YYYY-MM-DD] [--stage draft|final|official] [--publish]

clone flags:
  [--new-version <version>] [--new-updated-at YYYY-MM-DD] [--from-archived] [--publish]

update flags:
  [--title ...] [--summary ...] [--owners a,b] [--topics a,b] [--collection ...] [--order 1]
  [--stage draft|final|official] [--archived true|false] [--published true|false]
  [--markdown-file /path/to/file.md]

official flags:
  [--reviewed-at YYYY-MM-DD] [--approvals alice:YYYY-MM-DD,bob:YYYY-MM-DD]
`;
}

export async function main(argv = process.argv.slice(2)) {
  const parsed = parseArgv(argv);
  const cmd = parsed.command;
  const flags = parsed.flags;

  if (!cmd || flags.help === true || flags.h === true) {
    console.log(usage());
    return;
  }

  try {
    if (cmd === "new") {
      const slug = asString(flags.slug);
      const title = asString(flags.title);
      const summary = asString(flags.summary);
      if (!slug || !title || !summary) throw new Error("new requires --slug, --title, --summary");

      const stageRaw = asString(flags.stage);
      const stage = stageRaw ? parseStage(stageRaw) : undefined;
      const published = flags.publish === true ? true : undefined;

      const updatedAt = asString(flags["updated-at"]);
      const version = asString(flags.version);
      const owners = parseList(asString(flags.owners));
      const topics = parseList(asString(flags.topics));
      const collection = asString(flags.collection) ?? undefined;
      const order = asString(flags.order) ? Number(flags.order) : undefined;

      const r = createDocFile({
        slug,
        title,
        summary,
        stage,
        updatedAt: updatedAt ?? undefined,
        version: version ?? undefined,
        published,
        owners,
        topics,
        collection,
        order: Number.isFinite(order as number) ? order : undefined,
      });

      console.log(`Created: ${r.filePath} (v${r.version})`);
      return;
    }

    if (cmd === "clone") {
      const slug = asString(flags.slug);
      if (!slug) throw new Error("clone requires --slug");
      const published = flags.publish === true ? true : undefined;
      const fromArchived = flags["from-archived"] === true;

      const stageRaw = asString(flags.stage);
      const stage = stageRaw ? parseStage(stageRaw) : undefined;

      const r = cloneLatestToNewVersion({
        slug,
        newVersion: asString(flags["new-version"]) ?? undefined,
        newUpdatedAt: asString(flags["new-updated-at"]) ?? undefined,
        stage,
        fromArchived,
        published,
      });
      console.log(`Cloned: ${r.filePath} (v${r.version}) from v${r.from.version}`);
      return;
    }

    if (cmd === "update") {
      const slug = asString(flags.slug);
      const version = asString(flags.version);
      if (!slug || !version) throw new Error("update requires --slug and --version");

      const patchFrontmatter: Record<string, unknown> = {};
      const title = asString(flags.title);
      const summary = asString(flags.summary);
      if (title) patchFrontmatter.title = title;
      if (summary) patchFrontmatter.summary = summary;

      const owners = asString(flags.owners);
      if (owners !== null) patchFrontmatter.owners = parseList(owners);

      const topics = asString(flags.topics);
      if (topics !== null) patchFrontmatter.topics = parseList(topics);

      const collection = asString(flags.collection);
      if (collection !== null) patchFrontmatter.collection = collection;

      const orderRaw = asString(flags.order);
      if (orderRaw !== null) {
        const order = Number(orderRaw);
        if (!Number.isFinite(order) || order <= 0) throw new Error("--order must be a positive number");
        patchFrontmatter.order = Math.trunc(order);
      }

      const stageRaw = asString(flags.stage);
      if (stageRaw) patchFrontmatter.stage = parseStage(stageRaw);

      const archivedRaw = flags.archived === true ? "true" : asString(flags.archived);
      const publishedRaw = flags.published === true ? "true" : asString(flags.published);
      if (archivedRaw !== null && publishedRaw !== null) throw new Error("Pass only one of: --archived, --published");
      if (archivedRaw !== null) {
        const archived = asBool(archivedRaw);
        if (archived === null) throw new Error("--archived must be true/false");
        patchFrontmatter.archived = archived;
      }
      if (publishedRaw !== null) {
        const published = asBool(publishedRaw);
        if (published === null) throw new Error("--published must be true/false");
        patchFrontmatter.archived = !published;
      }

      const updatedAt = asString(flags["updated-at"]);
      if (updatedAt) patchFrontmatter.updatedAt = updatedAt;
      const lastReviewedAt = asString(flags["last-reviewed-at"]);
      if (lastReviewedAt) patchFrontmatter.lastReviewedAt = lastReviewedAt;

      let patchMarkdown: string | undefined;
      const mdFile = asString(flags["markdown-file"]);
      if (mdFile) patchMarkdown = fs.readFileSync(mdFile, "utf8");

      const r = updateDocFile({
        slug,
        version,
        patchFrontmatter: Object.keys(patchFrontmatter).length ? patchFrontmatter : undefined,
        patchMarkdown,
      });
      console.log(`Updated: ${r.filePath}`);
      return;
    }

    if (cmd === "publish") {
      const slug = asString(flags.slug);
      const version = asString(flags.version);
      if (!slug || !version) throw new Error("publish requires --slug and --version");
      const r = publishDocVersion({ slug, version });
      console.log(`Published: ${r.filePath}`);
      return;
    }

    if (cmd === "unpublish" || cmd === "archive") {
      const slug = asString(flags.slug);
      const version = asString(flags.version);
      if (!slug || !version) throw new Error(`${cmd} requires --slug and --version`);
      const r = unpublishDocVersion({ slug, version });
      console.log(`Unpublished: ${r.filePath}`);
      return;
    }

    if (cmd === "finalize") {
      const slug = asString(flags.slug);
      const version = asString(flags.version);
      if (!slug || !version) throw new Error("finalize requires --slug and --version");
      const r = finalizeDocVersion({ slug, version });
      console.log(`Finalized: ${r.filePath}`);
      return;
    }

    if (cmd === "official") {
      const slug = asString(flags.slug);
      const version = asString(flags.version);
      if (!slug || !version) throw new Error("official requires --slug and --version");
      const r = promoteDocVersionToOfficial({
        slug,
        version,
        reviewedAt: asString(flags["reviewed-at"]) ?? undefined,
        approvals: parseApprovals(asString(flags.approvals)),
      });
      console.log(`Promoted to Official: ${r.filePath}`);
      return;
    }

    if (cmd === "delete") {
      const slug = asString(flags.slug);
      const version = asString(flags.version);
      if (!slug || !version) throw new Error("delete requires --slug and --version");
      const r = deleteDocVersion({ slug, version });
      console.log(`Deleted: ${r.deleted}`);
      return;
    }

    if (cmd === "delete-all") {
      const slug = asString(flags.slug);
      if (!slug) throw new Error("delete-all requires --slug");
      const r = deleteAllDocVersions({ slug });
      console.log(`Deleted ${r.deleted.length} files for slug "${slug}"`);
      return;
    }

    throw new Error(`Unknown command: ${cmd}`);
  } catch (err: unknown) {
    console.error(err instanceof Error ? err.message : String(err));
    console.log(usage());
    process.exitCode = 1;
  }
}

const argv1 = process.argv[1];
if (argv1 && import.meta.url === pathToFileURL(argv1).href) {
  main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
}
