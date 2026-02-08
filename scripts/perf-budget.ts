import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

type Budget = {
  relPath: string;
  maxBytes: number;
  required?: boolean;
};

function humanBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"] as const;
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function statSize(filePath: string): number | null {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return null;
  }
}

function dirTotalBytes(dir: string): number {
  let total = 0;
  const stack = [dir];
  while (stack.length) {
    const next = stack.pop()!;
    const entries = fs.readdirSync(next, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(next, e.name);
      if (e.isDirectory()) stack.push(full);
      else if (e.isFile()) total += fs.statSync(full).size;
    }
  }
  return total;
}

export async function main() {
  const outDir = path.resolve(process.env.OUT_DIR ?? path.join(process.cwd(), "out"));
  if (!fs.existsSync(outDir)) {
    console.error(`perf-budget: missing export output dir: ${outDir}`);
    process.exitCode = 1;
    return;
  }

  const budgets: Budget[] = [
    { relPath: "docs.json", maxBytes: 5 * 1024 * 1024, required: true },
    { relPath: "search-index.json", maxBytes: 5 * 1024 * 1024, required: true },
    { relPath: "chunks.json", maxBytes: 15 * 1024 * 1024, required: true },
    { relPath: "embeddings-manifest.json", maxBytes: 5 * 1024 * 1024, required: true },
    { relPath: "claims.json", maxBytes: 2 * 1024 * 1024, required: true },
    { relPath: "updates.json", maxBytes: 256 * 1024, required: true },
    { relPath: "synonyms.json", maxBytes: 256 * 1024, required: true },
  ];

  const totalBudgetBytes = 250 * 1024 * 1024;
  let ok = true;

  for (const b of budgets) {
    const full = path.join(outDir, b.relPath);
    const size = statSize(full);
    if (size === null) {
      if (b.required) {
        console.error(`perf-budget: missing required file: ${b.relPath}`);
        ok = false;
      }
      continue;
    }
    if (size > b.maxBytes) {
      console.error(
        `perf-budget: ${b.relPath} is too large (${humanBytes(size)} > ${humanBytes(b.maxBytes)})`,
      );
      ok = false;
    } else {
      console.log(`perf-budget: ${b.relPath} ${humanBytes(size)} (<= ${humanBytes(b.maxBytes)})`);
    }
  }

  const total = dirTotalBytes(outDir);
  if (total > totalBudgetBytes) {
    console.error(`perf-budget: out/ is too large (${humanBytes(total)} > ${humanBytes(totalBudgetBytes)})`);
    ok = false;
  } else {
    console.log(`perf-budget: total out/ size ${humanBytes(total)} (<= ${humanBytes(totalBudgetBytes)})`);
  }

  if (!ok) process.exitCode = 1;
}

const argv1 = process.argv[1];
if (argv1 && import.meta.url === pathToFileURL(argv1).href) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}

