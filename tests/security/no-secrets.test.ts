import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

function listFilesRec(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const base = path.basename(full);
      if (base === "node_modules" || base === ".next" || base === "out" || base === "coverage" || base === ".git") continue;
      listFilesRec(full, out);
    } else {
      out.push(full);
    }
  }
  return out;
}

function readTextSafe(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

type Pattern = { name: string; re: RegExp };

const PATTERNS: Pattern[] = [
  { name: "Google API key", re: /AIza[0-9A-Za-z\-_]{20,}/g },
  { name: "OpenAI key", re: /sk-[A-Za-z0-9]{20,}/g },
  { name: "Anthropic key", re: /sk-ant-[A-Za-z0-9\-_]{20,}/g },
  { name: "GitHub PAT", re: /ghp_[A-Za-z0-9]{30,}/g },
  { name: "Slack token", re: /xox[baprs]-[0-9A-Za-z-]{10,}/g },
];

describe("security: no secrets in repo text", () => {
  test("does not contain common API key patterns in src/tests/scripts/docs", () => {
    const root = process.cwd();
    const roots = ["src", "tests", "scripts", "content"].map((p) => path.join(root, p));
    const files = roots.flatMap((p) => listFilesRec(p)).filter((f) => /\.(ts|tsx|js|mjs|md|json|toml|yml|yaml|css)$/.test(f));
    files.push(path.join(root, ".env.example"));
    files.push(path.join(root, "README.md"));

    const hits: Array<{ file: string; pattern: string; match: string }> = [];
    for (const file of files) {
      const text = readTextSafe(file);
      if (!text) continue;
      for (const p of PATTERNS) {
        const m = text.match(p.re);
        if (!m) continue;
        for (const match of m.slice(0, 3)) hits.push({ file: path.relative(root, file), pattern: p.name, match });
      }
    }

    expect(hits, `Found potential secrets:\n${hits.map((h) => `${h.pattern} in ${h.file}: ${h.match}`).join("\n")}`).toEqual([]);
  });
});

