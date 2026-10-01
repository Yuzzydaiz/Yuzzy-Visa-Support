import { describe, expect, it } from "vitest";

import { deterministicConcepts } from "@/lib/research/discovery/concepts";
import { discoverAdditionalSources } from "@/lib/research/discovery/discover";
import { handleReferenceDiscover } from "@/lib/research/discovery/http";
import { resetResolveRateLimit } from "@/lib/research/http/rateLimitStub";
import type { CanonicalWork } from "@/lib/research/references/types";

const climate: CanonicalWork = {
  title: "A fake but stable climate meta analysis",
  authors: ["Ada Example"],
  year: 2020,
  doi: "10.1038/nature12373",
  abstract: "Verified abstract text.",
  provider: "openalex",
};

const extra: CanonicalWork = {
  title: "Soil nitrogen reviews",
  authors: ["Bea Second"],
  year: 2019,
  doi: "10.1000/extra",
  abstract: "Extra abstract",
  provider: "openalex",
};

describe("deterministicConcepts", () => {
  it("pulls distinctive tokens from the title", () => {
    const concepts = deterministicConcepts({
      title: "Nitrogen cycling in tropical soils",
      confirmedTitles: [],
    });
    expect(concepts.length).toBeGreaterThan(0);
    expect(concepts.join(" ")).toMatch(/nitrogen|cycling|tropical|soils/);
  });
});

describe("discoverAdditionalSources", () => {
  it("returns nothing when the flag is off", async () => {
    const results = await discoverAdditionalSources({
      allowAdditionalSources: false,
      concepts: ["climate"],
      userWorks: [climate],
      max: 5,
      openalex: {
        lookupDoi: async () => undefined,
        searchTitle: async () => [extra],
        searchWorks: async () => [extra],
      },
      crossref: {
        lookupDoi: async () => extra,
        searchBibliographic: async () => [],
      },
    });
    expect(results).toEqual([]);
  });

  it("caps and dedupes against user DOIs", async () => {
    const results = await discoverAdditionalSources({
      allowAdditionalSources: true,
      concepts: ["climate", "nitrogen"],
      userWorks: [climate],
      max: 1,
      openalex: {
        lookupDoi: async () => undefined,
        searchTitle: async () => [climate, extra],
        searchWorks: async () => [climate, extra],
      },
      crossref: {
        lookupDoi: async (doi) => (doi.includes("extra") ? extra : climate),
        searchBibliographic: async () => [],
      },
    });
    expect(results).toHaveLength(1);
    expect(results[0]?.matched.doi).toBe("10.1000/extra");
    expect(results[0]?.isSystemAdded).toBe(true);
  });
});

describe("handleReferenceDiscover", () => {
  it("returns an empty list when extra sources are not allowed", async () => {
    resetResolveRateLimit();
    const result = await handleReferenceDiscover({
      ip: "203.0.113.9",
      env: {
        CROSSREF_CONTACT_EMAIL: "ops@example.com",
        OPENAI_API_KEY: "sk-test",
      },
      body: {
        allowAdditionalSources: false,
        title: "Nitrogen cycling in tropical soils",
        references: [{ originalInput: "10.1038/nature12373" }],
      },
    });
    expect(result.status).toBe(200);
    expect((result.body as { results: unknown[] }).results).toEqual([]);
  });
});
