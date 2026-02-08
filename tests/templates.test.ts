import { describe, expect, test } from "vitest";
import type { DocTemplate } from "@/lib/templates";
import { buildMarkdownSkeleton, buildPrompt, buildSectionPromptPack, resolveSections } from "@/lib/templates";

describe("templates", () => {
  test("resolveSections includes required and only enabled optional sections", () => {
    const t: DocTemplate = {
      id: "t",
      name: "T",
      description: "D",
      tags: [],
      requiredFields: [{ key: "owner", label: "Owner", placeholder: "alice" }],
      sections: [
        { title: "A" },
        { title: "B", optional: true },
        { title: "C", optional: true },
      ],
    };

    expect(resolveSections(t, new Set())).toEqual(["A"]);
    expect(resolveSections(t, new Set(["B"]))).toEqual(["A", "B"]);
    expect(resolveSections(t, new Set(["C", "B"]))).toEqual(["A", "B", "C"]);
  });

  test("buildPrompt includes required fields and exact section list", () => {
    const t: DocTemplate = {
      id: "t",
      name: "Runbook",
      description: "D",
      tags: [],
      requiredFields: [{ key: "owner", label: "Owner", placeholder: "alice" }],
      sections: [{ title: "Overview" }, { title: "Risks", optional: true }],
    };

    const prompt = buildPrompt({
      template: t,
      inputValues: { owner: "ops" },
      topic: "Database migration",
      enabledOptional: new Set(["Risks"]),
    });
    expect(prompt).toContain("Owner: ops");
    expect(prompt).toContain("1. Overview");
    expect(prompt).toContain("2. Risks");
  });

  test("buildSectionPromptPack produces one prompt per resolved section", () => {
    const t: DocTemplate = {
      id: "t",
      name: "Spec",
      description: "D",
      tags: [],
      requiredFields: [{ key: "owner", label: "Owner", placeholder: "alice" }],
      sections: [{ title: "A" }, { title: "B", optional: true }],
    };

    const pack = buildSectionPromptPack({
      template: t,
      inputValues: {},
      topic: "",
      enabledOptional: new Set(["B"]),
    });
    expect(pack.map((p) => p.section)).toEqual(["A", "B"]);
    expect(pack[0].prompt).toContain("## A");
    expect(pack[1].prompt).toContain("## B");
    expect(pack[0].prompt).toContain("Owner: <fill this>");
  });

  test("buildMarkdownSkeleton includes metadata and TODO sections", () => {
    const t: DocTemplate = {
      id: "t",
      name: "Checklist",
      description: "D",
      tags: [],
      requiredFields: [{ key: "owner", label: "Owner", placeholder: "alice" }],
      sections: [{ title: "Steps" }],
    };

    const md = buildMarkdownSkeleton({
      template: t,
      inputValues: {},
      topic: "",
      enabledOptional: new Set(),
    });
    expect(md).toContain("# Untitled (Checklist)");
    expect(md).toContain("## Metadata");
    expect(md).toContain("**Owner:** TBD");
    expect(md).toContain("## Steps");
    expect(md).toContain("_TODO: add content._");
  });
});
