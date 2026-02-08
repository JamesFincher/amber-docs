import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("next/link", () => {
  type LinkLikeProps = {
    href: string;
    children?: React.ReactNode;
  } & Record<string, unknown>;
  return {
    default: ({ href, children, ...rest }: LinkLikeProps) =>
      React.createElement("a", { href, ...rest }, children),
  };
});

vi.mock("next/navigation", () => {
  return {
    useRouter: () => ({ push: vi.fn() }),
  };
});

// Keep these leaf components as stubs to make DocDetail renderable in Node.
vi.mock("@/components/Markdown", () => ({
  Markdown: ({ value }: { value: string }) => React.createElement("pre", null, value),
}));
vi.mock("@/components/Toc", () => ({
  Toc: ({ items }: { items: unknown[] }) => React.createElement("div", null, `toc:${items?.length ?? 0}`),
}));
vi.mock("@/components/CopyButton", () => ({ CopyButton: () => React.createElement("button", null, "copy") }));
vi.mock("@/components/AiPromptPack", () => ({ AiPromptPack: () => React.createElement("div", null, "ai") }));
vi.mock("@/components/BookmarkButton", () => ({ BookmarkButton: () => React.createElement("button", null, "bookmark") }));
vi.mock("@/components/FeedbackWidget", () => ({ FeedbackWidget: () => React.createElement("div", null, "feedback") }));
vi.mock("@/components/NotesPanel", () => ({ NotesPanel: () => React.createElement("div", null, "notes") }));

describe("UI components (render smoke)", () => {
  test("SiteHeader includes plain-language navigation and search label", async () => {
    const { SiteHeader } = await import("../src/components/SiteHeader");
    const html = renderToStaticMarkup(React.createElement(SiteHeader));
    expect(html).toContain("Search documents");
    expect(html).toContain("Documents");
    expect(html).toContain("Reading lists");
    expect(html).toContain("Write + publish");
    expect(html).toContain("Ask AI");
    expect(html).toContain("Templates");
    expect(html).toContain("Reusable text");
    expect(html).toContain("Help");
  });

  test("VersionSelector renders options including Latest label", async () => {
    const { VersionSelector } = await import("../src/app/docs/_components/version-selector");
    const html = renderToStaticMarkup(
      React.createElement(VersionSelector, {
        slug: "a",
        version: "1",
        isLatest: true,
        versions: [
          {
            slug: "a",
            version: "1",
            title: "A",
            stage: "draft",
            archived: false,
            visibility: "public",
            summary: "s",
            updatedAt: "2026-01-01",
            owners: [],
            topics: [],
            markdown: "# A\n\n## H2\nx\n",
            aiChecks: [],
            relatedContext: [],
            relatedSlugs: [],
            canonicalFor: [],
            facts: {},
            citations: [],
            approvals: [],
            audit: [],
            toc: [],
            headings: [],
            searchText: "",
            contentHash: "h",
            sourcePath: "/tmp/a.md",
          },
        ],
      }),
    );
    expect(html).toContain("Latest (v1)");
  });

  test("DocDetail renders metadata and governance chips", async () => {
    const { DocDetail } = await import("../src/app/docs/_components/doc-detail");
    const html = renderToStaticMarkup(
      React.createElement(DocDetail, {
        doc: {
          slug: "a",
          version: "1",
          title: "A",
          stage: "official",
          archived: false,
          visibility: "public",
          summary: "s",
          updatedAt: "2026-01-01",
          lastReviewedAt: "2025-01-01",
          owners: [],
          topics: ["t1", "t2"],
          collection: "Path",
          markdown: "# A\n\n## H2\nx\n",
          aiChecks: ["c1"],
          relatedContext: ["r1"],
          relatedSlugs: [],
          canonicalFor: [],
          facts: {},
          citations: [{ label: "Source", url: "https://example.test" }],
          approvals: [{ name: "alice", date: "2026-01-02" }],
          audit: [{ at: "2026-01-02T00:00:00.000Z", action: "publish", actor: "Jane Doe" }],
          toc: [],
          headings: [],
          searchText: "",
          contentHash: "h",
          sourcePath: "/tmp/a.md",
        },
        versions: [
          {
            slug: "a",
            version: "1",
            title: "A",
            stage: "official",
            archived: false,
            visibility: "public",
            summary: "s",
            updatedAt: "2026-01-01",
            owners: [],
            topics: [],
            markdown: "",
            aiChecks: [],
            relatedContext: [],
            relatedSlugs: [],
            canonicalFor: [],
            facts: {},
            citations: [],
            approvals: [],
            audit: [],
            toc: [],
            headings: [],
            searchText: "",
            contentHash: "h",
            sourcePath: "/tmp/a.md",
          },
        ],
        relatedDocs: [],
        prev: null,
        next: null,
        isLatest: true,
      }),
    );
    expect(html).toContain("Metadata");
    expect(html).toContain("Needs review");
    expect(html).toContain("Citations present");
    expect(html).toContain("Unowned");
    expect(html).toContain("Visibility");
    expect(html).toContain("Public");
    expect(html).toContain("Audit log (advanced)");
    expect(html).toContain("publish");
  });

  test("DocDetail renders related docs section when provided", async () => {
    const { DocDetail } = await import("../src/app/docs/_components/doc-detail");
    const html = renderToStaticMarkup(
      React.createElement(DocDetail, {
        doc: {
          slug: "a",
          version: "1",
          title: "A",
          stage: "final",
          archived: false,
          visibility: "public",
          summary: "s",
          updatedAt: "2026-01-01",
          owners: [],
          topics: [],
          markdown: "# A\n\n## H2\nx\n",
          aiChecks: [],
          relatedContext: [],
          relatedSlugs: [],
          canonicalFor: [],
          facts: {},
          citations: [],
          approvals: [],
          audit: [],
          toc: [],
          headings: [],
          searchText: "",
          contentHash: "h",
          sourcePath: "/tmp/a.md",
        },
        versions: [
          {
            slug: "a",
            version: "1",
            title: "A",
            stage: "final",
            archived: false,
            visibility: "public",
            summary: "s",
            updatedAt: "2026-01-01",
            owners: [],
            topics: [],
            markdown: "",
            aiChecks: [],
            relatedContext: [],
            relatedSlugs: [],
            canonicalFor: [],
            facts: {},
            citations: [],
            approvals: [],
            audit: [],
            toc: [],
            headings: [],
            searchText: "",
            contentHash: "h",
            sourcePath: "/tmp/a.md",
          },
        ],
        relatedDocs: [
          {
            slug: "b",
            version: "1",
            title: "B",
            stage: "official",
            archived: false,
            visibility: "public",
            summary: "sb",
            updatedAt: "2026-01-02",
            owners: [],
            topics: [],
            markdown: "# B\n\n## H2\nx\n",
            aiChecks: [],
            relatedContext: [],
            relatedSlugs: [],
            canonicalFor: [],
            facts: {},
            citations: [],
            approvals: [],
            audit: [],
            toc: [],
            headings: [],
            searchText: "",
            contentHash: "h2",
            sourcePath: "/tmp/b.md",
          },
        ],
        prev: null,
        next: null,
        isLatest: true,
      }),
    );
    expect(html).toContain("Related docs");
    expect(html).toContain("B");
  });
});
