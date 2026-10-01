import { describe, expect, it } from "vitest";

import { renderCitations } from "@/lib/research/citations/render";
import { CitationTokenError, collectCitedIds } from "@/lib/research/citations/tokens";
import { HARVARD_VARIANT, type CiteSource } from "@/lib/research/citations/styles";

const ref01: CiteSource = {
  refId: "ref_01",
  authors: ["Ada Example"],
  year: 2020,
  title: "Climate synthesis",
  journal: "Nature",
  doi: "10.1000/climate",
  contentStatus: "abstract",
};

const ref04: CiteSource = {
  refId: "ref_04",
  authors: ["Bea Second"],
  year: 2019,
  title: "Soil nitrogen",
  journal: "Soils",
  contentStatus: "metadata_only",
};

describe("citation tokens", () => {
  it("parses single and grouped tokens", () => {
    expect(
      collectCitedIds("Hello [CITE:ref_01] and [CITE:ref_01;ref_04]."),
    ).toEqual(["ref_01", "ref_04"]);
  });

  it("rejects unknown ids", () => {
    expect(() =>
      renderCitations({
        text: "Bad [CITE:ref_99]",
        style: "apa",
        sources: [ref01],
        allowedIds: new Set(["ref_01"]),
      }),
    ).toThrow(CitationTokenError);
  });

  it("renders APA and IEEE without duplicating bibliography entries", () => {
    const text = "One [CITE:ref_01] two [CITE:ref_01;ref_04] again [CITE:ref_01].";
    const apa = renderCitations({
      text,
      style: "apa",
      sources: [ref01, ref04],
      allowedIds: new Set(["ref_01", "ref_04"]),
    });
    expect(apa.text).toContain("(Example, 2020)");
    expect(apa.bibliography).toHaveLength(2);
    const ieee = renderCitations({
      text,
      style: "ieee",
      sources: [ref01, ref04],
      allowedIds: new Set(["ref_01", "ref_04"]),
    });
    expect(ieee.text).toContain("[1]");
    expect(ieee.text).toContain("[1,2]");
    expect(ieee.bibliography[0]).toMatch(/^\[1\]/);
  });

  it("renders Harvard Cite Them Right author-date without duplicating bibliography", () => {
    expect(HARVARD_VARIANT).toContain("Cite Them Right");
    const text = "One [CITE:ref_01] two [CITE:ref_01;ref_04].";
    const harvard = renderCitations({
      text,
      style: "harvard",
      sources: [ref01, ref04],
      allowedIds: new Set(["ref_01", "ref_04"]),
    });
    expect(harvard.text).toContain("(Example, 2020)");
    expect(harvard.bibliography).toHaveLength(2);
    const apa = renderCitations({
      text,
      style: "apa",
      sources: [ref01, ref04],
      allowedIds: new Set(["ref_01", "ref_04"]),
    });
    expect(collectCitedIds(text)).toEqual(["ref_01", "ref_04"]);
    expect(apa.bibliography).toHaveLength(harvard.bibliography.length);
  });
});
