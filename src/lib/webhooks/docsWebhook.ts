import crypto from "node:crypto";
import type { DocRecord } from "../docs";

export type WebhookDoc = Pick<DocRecord, "slug" | "version" | "updatedAt" | "contentHash">;

export type DocsWebhookPayload = {
  event: string;
  generatedAt: string;
  buildId: string;
  docs: Array<{
    slug: string;
    version: string;
    updatedAt: string;
    contentHash: string;
    url: string;
  }>;
};

function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function computeBuildId(docs: WebhookDoc[]): string {
  return sha256Hex(docs.map((d) => `${d.slug}@${d.version}:${d.contentHash}`).join("\n"));
}

export function buildDocsWebhookPayload(args: {
  event: string;
  generatedAt: string;
  docs: WebhookDoc[];
}): DocsWebhookPayload {
  const buildId = computeBuildId(args.docs);
  return {
    event: args.event,
    generatedAt: args.generatedAt,
    buildId,
    docs: args.docs.map((d) => ({
      slug: d.slug,
      version: d.version,
      updatedAt: d.updatedAt,
      contentHash: d.contentHash,
      url: `/docs/${encodeURIComponent(d.slug)}`,
    })),
  };
}

export function signBodyHmacSha256(secret: string, body: string): string {
  const sig = crypto.createHmac("sha256", secret).update(body).digest("hex");
  return `sha256=${sig}`;
}

export async function sendDocsWebhook(args: {
  url: string;
  secret: string;
  payload: DocsWebhookPayload;
  fetchImpl?: typeof fetch;
}): Promise<{ status: number }> {
  const fetchImpl = args.fetchImpl ?? fetch;
  const body = JSON.stringify(args.payload);
  const signature = signBodyHmacSha256(args.secret, body);

  const res = await fetchImpl(args.url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-amber-event": args.payload.event,
      "x-amber-signature": signature,
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Webhook failed: ${res.status} ${res.statusText} ${text}`);
  }

  return { status: res.status };
}

