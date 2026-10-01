import { describe, expect, it } from "vitest";

import { allocateOutline, OutlineValidationError } from "@/lib/research/generation/outline";
import { validateSectionOutput } from "@/lib/research/generation/validate";
import type { SourceManifestEntry } from "@/lib/research/generation/manifest";

const manifest: SourceManifestEntry[] = [
  {
    refId: "ref_01",
    title: "Climate synthesis",
    authors: ["Ada Example"],
    year: 2020,
    evidence: "Abstract text",
    contentStatus: "abstract",
  },
];

describe("outline allocation", () => {
  it("sums literature-review budgets to the body target", () => {
    const outline = allocateOutline({
      paperType: "literature_review",
      targetWords: 3000,
      manifest,
    });
    expect(outline.reduce((sum, item) => sum + item.wordBudget, 0)).toBe(3000);
    expect(outline.map((item) => item.type)).toContain("results_discussion");
  });

  it("omits completed results from proposals", () => {
    const outline = allocateOutline({
      paperType: "research_proposal",
      targetWords: 3000,
      manifest,
    });
    expect(outline.some((item) => item.type === "results_discussion")).toBe(false);
    expect(outline.reduce((sum, item) => sum + item.wordBudget, 0)).toBe(3000);
  });

  it("fails original research without methodology and findings", () => {
    expect(() =>
      allocateOutline({
        paperType: "original_research_draft",
        targetWords: 3000,
        manifest,
        hasMethodology: false,
        hasFindings: false,
      }),
    ).toThrow(OutlineValidationError);
  });
});

describe("section validation", () => {
  it("rejects unknown citation ids", () => {
    const issues = validateSectionOutput({
      section: {
        sectionId: "introduction",
        title: "Introduction",
        paragraphs: [{ text: "A claim [CITE:ref_99]." }],
        usedReferenceIds: ["ref_99"],
        wordCountEstimate: 3,
      },
      allowedIds: new Set(["ref_01"]),
      wordBudget: 3,
      manifest,
    });
    expect(issues.some((issue) => issue.code === "unknown_cite")).toBe(true);
  });
});
