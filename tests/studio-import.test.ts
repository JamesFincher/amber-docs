// @vitest-environment jsdom

import { describe, expect, test } from "vitest";
import { clearStudioImport, readStudioImport, saveStudioImport, STUDIO_IMPORT_KEY } from "../src/lib/studioImport";

describe("studioImport helpers", () => {
  test("round-trips a saved import draft", () => {
    clearStudioImport();
    const ok = saveStudioImport({
      v: 1,
      source: "assistant",
      createdAt: "2026-02-08T00:00:00.000Z",
      docText: "---\nslug: a\n---\n\n# A\n",
      suggested: { title: "A", stage: "draft", visibility: "internal", owners: ["o1"], topics: ["t1"] },
    });
    expect(ok).toBe(true);

    const loaded = readStudioImport();
    expect(loaded?.v).toBe(1);
    expect(loaded?.source).toBe("assistant");
    expect(loaded?.docText).toContain("slug: a");
    expect(loaded?.suggested?.title).toBe("A");
    expect(loaded?.suggested?.owners).toEqual(["o1"]);

    clearStudioImport();
    expect(readStudioImport()).toBeNull();
  });

  test("reads suggested fields (stage/visibility/lists/citations/approvals)", () => {
    clearStudioImport();
    localStorage.setItem(
      STUDIO_IMPORT_KEY,
      JSON.stringify({
        v: 1,
        source: "templates",
        createdAt: "2026-02-08T00:00:00.000Z",
        markdown: "# Hello\n",
        suggested: {
          title: "Hello",
          slug: "hello",
          summary: "s",
          stage: "final",
          visibility: "public",
          owners: ["o1", "o2"],
          topics: ["t1"],
          collection: "Path",
          order: 2,
          citations: [{ label: "Source", url: "https://example.test" }, { label: "Internal" }],
          approvals: [{ name: "alice", date: "2026-02-01" }],
        },
      }),
    );

    const loaded = readStudioImport();
    expect(loaded?.source).toBe("templates");
    expect(loaded?.markdown).toContain("# Hello");
    expect(loaded?.suggested?.stage).toBe("final");
    expect(loaded?.suggested?.visibility).toBe("public");
    expect(loaded?.suggested?.owners).toEqual(["o1", "o2"]);
    expect(loaded?.suggested?.citations?.length).toBe(2);
    expect(loaded?.suggested?.approvals?.length).toBe(1);
  });

  test("returns null when there is no usable payload", () => {
    clearStudioImport();
    localStorage.setItem(
      STUDIO_IMPORT_KEY,
      JSON.stringify({ v: 1, source: "assistant", createdAt: "2026-02-08T00:00:00.000Z" }),
    );
    expect(readStudioImport()).toBeNull();
  });

  test("readStudioImport returns null for invalid JSON", () => {
    localStorage.setItem(STUDIO_IMPORT_KEY, "not-json");
    expect(readStudioImport()).toBeNull();
  });

  test("readStudioImport returns null for wrong version/source", () => {
    localStorage.setItem(
      STUDIO_IMPORT_KEY,
      JSON.stringify({ v: 999, source: "nope", createdAt: "2026-02-08T00:00:00.000Z", markdown: "# A\n" }),
    );
    expect(readStudioImport()).toBeNull();
  });
});
