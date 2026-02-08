// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { createRoot } from "react-dom/client";

const pushMock = vi.fn<(href: string) => void>();

vi.mock("next/navigation", () => {
  return {
    useRouter: () => ({ push: pushMock }),
  };
});

// React expects this flag for act() to behave without warnings.
// @ts-expect-error - global is not typed here.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("VersionSelector (DOM events)", () => {
  afterEach(() => {
    pushMock.mockReset();
  });

  test("navigates to latest and pinned versions on select change", async () => {
    const { VersionSelector } = await import("../src/app/docs/_components/version-selector");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        React.createElement(VersionSelector, {
          slug: "a",
          version: "1",
          isLatest: false,
	          versions: [
	            {
	              slug: "a",
	              version: "2",
	              title: "A",
	              stage: "final",
	              archived: false,
	              visibility: "public",
	              summary: "s",
	              updatedAt: "2026-02-01",
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
	              contentHash: "h2",
	              sourcePath: "/tmp/a2.md",
	            },
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
	              contentHash: "h1",
	              sourcePath: "/tmp/a1.md",
	            },
	          ],
	        }),
	      );
	    });

    const select = container.querySelector("select");
    if (!select) throw new Error("missing select");

    // Jump to latest.
    (select as HTMLSelectElement).value = "__latest__";
    await act(async () => {
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(pushMock).toHaveBeenCalledWith("/docs/a");

    // Jump to pinned.
    pushMock.mockReset();
    (select as HTMLSelectElement).value = "1";
    await act(async () => {
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(pushMock).toHaveBeenCalledWith("/docs/a/v/1");

    await act(async () => root.unmount());
    container.remove();
  });

  test("renders even when versions list is empty (fallbacks to props.version)", async () => {
    const { VersionSelector } = await import("../src/app/docs/_components/version-selector");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        React.createElement(VersionSelector, {
          slug: "a",
          version: "1",
          isLatest: false,
          versions: [],
        }),
      );
    });

    // Smoke: should render a select and not throw.
    expect(container.querySelector("select")).not.toBeNull();

    await act(async () => root.unmount());
    container.remove();
  });
});
