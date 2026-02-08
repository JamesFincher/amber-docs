import crypto from "node:crypto";
import { pathToFileURL } from "node:url";

import { listLatestDocs } from "../src/lib/content/docs.server";
import { buildDocsWebhookPayload, sendDocsWebhook } from "../src/lib/webhooks/docsWebhook";

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export async function main() {
  const url = process.env.DOCS_WEBHOOK_URL;
  const secret = process.env.DOCS_WEBHOOK_SECRET;
  const event = process.env.DOCS_WEBHOOK_EVENT ?? "docs.updated";

  if (!url) throw new Error("Missing DOCS_WEBHOOK_URL");
  if (!secret) throw new Error("Missing DOCS_WEBHOOK_SECRET");

  const docs = listLatestDocs();
  const buildId = sha256(docs.map((d) => `${d.slug}@${d.version}:${d.contentHash}`).join("\n"));

  const payload = buildDocsWebhookPayload({
    event,
    generatedAt: new Date().toISOString(),
    docs,
  });
  // Back-compat: retain existing buildId computation in the emitted payload.
  payload.buildId = buildId;

  const r = await sendDocsWebhook({ url, secret, payload });
  console.log(`Webhook sent: ${url} (${r.status})`);
}

const argv1 = process.argv[1];
if (argv1 && import.meta.url === pathToFileURL(argv1).href) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
