import crypto from "node:crypto";

import { listLatestDocs } from "../src/lib/content/docs.server";

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function hmacSha256(secret: string, body: string): string {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

async function main() {
  const url = process.env.DOCS_WEBHOOK_URL;
  const secret = process.env.DOCS_WEBHOOK_SECRET;
  const event = process.env.DOCS_WEBHOOK_EVENT ?? "docs.updated";

  if (!url) throw new Error("Missing DOCS_WEBHOOK_URL");
  if (!secret) throw new Error("Missing DOCS_WEBHOOK_SECRET");

  const docs = listLatestDocs();
  const buildId = sha256(docs.map((d) => `${d.slug}@${d.version}:${d.contentHash}`).join("\n"));

  const payload = {
    event,
    generatedAt: new Date().toISOString(),
    buildId,
    docs: docs.map((d) => ({
      slug: d.slug,
      version: d.version,
      updatedAt: d.updatedAt,
      contentHash: d.contentHash,
      url: `/docs/${encodeURIComponent(d.slug)}`,
    })),
  };

  const body = JSON.stringify(payload);
  const sig = hmacSha256(secret, body);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-amber-event": event,
      "x-amber-signature": `sha256=${sig}`,
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Webhook failed: ${res.status} ${res.statusText} ${text}`);
  }

  console.log(`Webhook sent: ${url} (${res.status})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

