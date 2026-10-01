import { describe, expect, it } from "vitest";

import { classifyCandidates, scoreCandidate } from "@/lib/research/references/score";
import { resolveReferences } from "@/lib/research/references/resolve";
import type { CanonicalWork } from "@/lib/research/references/types";
import type { CrossrefClient } from "@/lib/research/references/crossref";
import type { OpenAlexClient } from "@/lib/research/references/openalex";

const climate: CanonicalWork = {
  title: "A fake but stable climate meta analysis",
  authors: ["Ada Example"],
  year: 2020,
  doi: "10.1038/nature12373",
  abstract: "Verified abstract text.",
  provider: "crossref",
};

const otherYear: CanonicalWork = {
  title: "A fake but stable climate meta analysis",
  authors: ["Ada Example"],
  year: 1999,
  doi: "10.1000/other",
  provider: "openalex",
};

function clients(overrides: {
  doiWork?: CanonicalWork;
  search?: CanonicalWork[];
}): { crossref: CrossrefClient; openalex: OpenAlexClient } {
  const search = overrides.search ?? [];
  return {
    crossref: {
      lookupDoi: async (doi) =>
        overrides.doiWork?.doi === doi || doi === "10.1038/nature12373"
          ? overrides.doiWork ?? climate
          : undefined,
      searchBibliographic: async () => search,
    },
    openalex: {
      lookupDoi: async () => undefined,
      searchTitle: async () => search,
      searchWorks: async () => search,
    },
  };
}

describe("scoring", () => {
  it("treats DOI equality as an exact match", () => {
    expect(
      scoreCandidate({ doi: "10.1038/nature12373" }, climate),
    ).toBe(1);
  });

  it("does not verify a high title score when the year conflicts", () => {
    const classified = classifyCandidates(
      { titleHint: climate.title, yearHint: 2020, authorHint: "Ada Example" },
      [otherYear],
    );
    expect(classified.status).not.toBe("verified");
  });

  it("marks close competing titles as ambiguous", () => {
    const classified = classifyCandidates(
      { titleHint: "Studies of nitrogen in soil" },
      [
        {
          title: "Studies of nitrogen in soil",
          authors: ["Ann Smith"],
          year: 2018,
          doi: "10.1000/a",
          provider: "crossref",
        },
        {
          title: "Studies of nitrogen in soil",
          authors: ["Bob Jones"],
          year: 2019,
          doi: "10.1000/b",
          provider: "openalex",
        },
      ],
    );
    expect(classified.status).toBe("ambiguous");
  });
});

describe("resolveReferences", () => {
  it("verifies an exact DOI fixture", async () => {
    const [result] = await resolveReferences(
      [{ originalInput: "10.1038/nature12373" }],
      clients({ doiWork: climate }),
    );
    expect(result.verificationStatus).toBe("verified");
    expect(result.matched?.doi).toBe("10.1038/nature12373");
    expect(result.contentStatus).toBe("abstract");
  });

  it("leaves garbage citations unverified", async () => {
    const [result] = await resolveReferences(
      [{ originalInput: "asdf qwer not a paper 12" }],
      clients({ search: [] }),
    );
    expect(result.verificationStatus).toBe("unverified");
    expect(result.matched).toBeUndefined();
  });

  it("returns candidates when two titles compete", async () => {
    const twinA: CanonicalWork = {
      title: "Studies of nitrogen in soil",
      authors: ["Ann Smith"],
      year: 2018,
      doi: "10.1000/a",
      provider: "crossref",
    };
    const twinB: CanonicalWork = {
      title: "Studies of nitrogen in soil",
      authors: ["Bob Jones"],
      year: 2019,
      doi: "10.1000/b",
      provider: "openalex",
    };
    const [result] = await resolveReferences(
      [{ originalInput: "Studies of nitrogen in soil" }],
      clients({ search: [twinA, twinB] }),
    );
    expect(result.verificationStatus).toBe("ambiguous");
    expect(result.candidates.length).toBeGreaterThan(1);
  });
});
