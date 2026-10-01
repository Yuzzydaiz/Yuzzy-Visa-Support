import { describe, expect, it } from "vitest";

import {
  collectDocCiteIds,
  inlineNodesFromTokenText,
  sectionsToTiptapDoc,
  tiptapDocToSections,
  tokenTextFromInline,
} from "@/lib/research/editor/document";

describe("editor document conversion", () => {
  it("round-trips citation tokens through TipTap JSON", () => {
    const doc = sectionsToTiptapDoc([
      {
        sectionId: "abstract",
        title: "Abstract",
        paragraphs: [{ text: "Hello [CITE:ref_01] world." }],
      },
    ]);
    expect(collectDocCiteIds(doc)).toEqual(["ref_01"]);
    const back = tiptapDocToSections(doc, []);
    expect(back[0]?.paragraphs[0]?.text).toContain("[CITE:ref_01]");
    expect(tokenTextFromInline(inlineNodesFromTokenText("x [CITE:ref_01;ref_04] y"))).toBe(
      "x [CITE:ref_01;ref_04] y",
    );
  });
});
