import crypto from "node:crypto";
import { describe, expect, test } from "vitest";
import {
  buildDocsWebhookPayload,
  computeBuildId,
  sendDocsWebhook,
  signBodyHmacSha256,
} from "../src/lib/webhooks/docsWebhook";
import type { WebhookDoc } from "../src/lib/webhooks/docsWebhook";

function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

describe("docs webhook helpers", () => {
  test("computeBuildId is sha256 over slug@version:contentHash lines", () => {
    const docs: WebhookDoc[] = [
      { slug: "a", version: "1", updatedAt: "2026-01-01", contentHash: "h1" },
      { slug: "b", version: "2", updatedAt: "2026-01-02", contentHash: "h2" },
    ];
    const expected = sha256Hex("a@1:h1\nb@2:h2");
    expect(computeBuildId(docs)).toBe(expected);
  });

  test("buildDocsWebhookPayload encodes URL and includes buildId", () => {
    const payload = buildDocsWebhookPayload({
      event: "docs.updated",
      generatedAt: "2026-02-08T00:00:00.000Z",
      docs: [{ slug: "a b", version: "1", updatedAt: "2026-01-01", contentHash: "h1" }],
    });
    expect(payload.event).toBe("docs.updated");
    expect(payload.docs[0].url).toBe("/docs/a%20b");
    expect(payload.buildId).toBe(computeBuildId(payload.docs));
  });

  test("signBodyHmacSha256 prefixes sha256=", () => {
    const sig = signBodyHmacSha256("secret", "{\"a\":1}");
    expect(sig).toMatch(/^sha256=[0-9a-f]{64}$/);
  });

  test("sendDocsWebhook posts JSON with signature headers", async () => {
    const payload = buildDocsWebhookPayload({
      event: "docs.updated",
      generatedAt: "2026-02-08T00:00:00.000Z",
      docs: [{ slug: "a", version: "1", updatedAt: "2026-01-01", contentHash: "h1" }],
    });

    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl: typeof fetch = async (url, init) => {
      calls.push({ url: String(url), init: init ?? {} });
      return new Response("ok", { status: 200 });
    };

    await expect(
      sendDocsWebhook({ url: "https://example.test/webhook", secret: "s", payload, fetchImpl }),
    ).resolves.toEqual({ status: 200 });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://example.test/webhook");
    expect(calls[0].init.method).toBe("POST");
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers["x-amber-event"]).toBe("docs.updated");
    expect(String(headers["x-amber-signature"])).toMatch(/^sha256=/);
    expect(String(calls[0].init.body)).toContain("\"event\":\"docs.updated\"");
  });
});
