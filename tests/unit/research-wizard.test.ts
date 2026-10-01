import { describe, expect, it } from "vitest";

import {
  calculateOrderPricing,
  formatMoneyFromMinorUnits,
  parseResearchProductConfig,
} from "@/lib/config/research-product";
import { createPaperDetailsSchema } from "@/lib/validation/research";

const config = parseResearchProductConfig({});

describe("wizard estimate copy", () => {
  it("formats the ten page minimum in naira", () => {
    const pricing = calculateOrderPricing(10, config);
    expect(formatMoneyFromMinorUnits(pricing.chargedAmountCents)).toMatch(
      /2,500/,
    );
  });
});

describe("paper details for the wizard", () => {
  const base = {
    title: "Climate evidence in recent meta analyses",
    focus: "How reviews should treat agreement and disagreement",
    paperType: "literature_review" as const,
    authors: [{ name: "Ada Example", affiliation: "Example University" }],
    citationStyle: "apa" as const,
    requestedPages: 10,
    allowAdditionalSources: false,
    customerEmail: "buyer@example.com",
  };

  it("accepts a complete literature review", () => {
    expect(createPaperDetailsSchema(config).safeParse(base).success).toBe(true);
  });

  it("blocks continue without findings on original research", () => {
    expect(
      createPaperDetailsSchema(config).safeParse({
        ...base,
        paperType: "original_research_draft",
      }).success,
    ).toBe(false);
  });

  it("still requires original-research fields when the wizard is not strict", () => {
    const relaxed = parseResearchProductConfig({
      NEXT_PUBLIC_RESEARCH_WIZARD_STRICT: "false",
    });
    expect(
      createPaperDetailsSchema(relaxed).safeParse({
        ...base,
        paperType: "original_research_draft",
      }).success,
    ).toBe(false);
  });
});
