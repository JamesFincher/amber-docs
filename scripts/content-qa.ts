import { pathToFileURL } from "node:url";
import { runContentQa } from "../src/lib/qa/contentQa";

export async function main() {
  const result = await runContentQa({ projectRoot: process.cwd() });
  if (!result.ok) {
    console.error(`Content QA failed (${result.failures.length}):`);
    for (const f of result.failures) console.error(`- [${f.code}] ${f.message}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Content QA passed (${result.docsCount} doc versions).`);
}

const argv1 = process.argv[1];
if (argv1 && import.meta.url === pathToFileURL(argv1).href) {
  main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
}
