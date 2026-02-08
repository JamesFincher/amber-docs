import { describe, expect, test } from "vitest";
import { formatAttachmentsForPrompt, type Attachment } from "../../src/lib/ai/attachments";

describe("formatAttachmentsForPrompt", () => {
  test("returns empty string when there are no attachments", () => {
    expect(formatAttachmentsForPrompt([])).toBe("");
  });

  test("includes attachment headers and fenced text blocks", () => {
    const a: Attachment = { name: "a.md", text: "# A\n", truncated: false };
    const out = formatAttachmentsForPrompt([a]);
    expect(out).toContain("ATTACHMENTS");
    expect(out).toContain("Attachment 1: a.md");
    expect(out).toContain("```text");
    expect(out).toContain("# A");
  });

  test("uses a fence longer than any backtick run inside content", () => {
    const a: Attachment = { name: "weird.txt", text: "Here is a code fence:\n```js\nx\n```\n", truncated: false };
    const out = formatAttachmentsForPrompt([a]);
    // Because content contains ``` we should get at least ```` as the wrapper fence.
    expect(out).toContain("````text");
    // Ensure the original triple fence is preserved inside the content.
    expect(out).toContain("```js");
  });

  test("marks truncated attachments", () => {
    const a: Attachment = { name: "big.md", text: "x", truncated: true };
    const out = formatAttachmentsForPrompt([a]);
    expect(out).toContain("(truncated)");
  });
});

