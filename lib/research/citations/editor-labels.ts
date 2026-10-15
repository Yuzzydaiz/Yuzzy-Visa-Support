import type { CitationStyleId } from "@/lib/config/research-product";
import { uniqueCiteOrder } from "@/lib/research/citations/render";
import {
  inTextCitation,
  numberedLabel,
  type CiteSource,
} from "@/lib/research/citations/styles";
import type { TiptapDoc, TiptapNode } from "@/lib/research/editor/document";

export type LabelSource = {
  refId: string;
  title: string;
  authors: string[];
  year?: number;
};

export function citedIdsInDoc(doc: TiptapDoc): string[] {
  const ids: string[] = [];
  const walk = (nodes: TiptapNode[] | undefined) => {
    for (const node of nodes ?? []) {
      if (node.type === "citation") {
        ids.push(...((node.attrs?.refIds as string[] | undefined) ?? []));
      }
      walk(node.content);
    }
  };
  walk(doc.content);
  return uniqueCiteOrder(ids);
}

// Reader-facing label for a citation chip in the editor: "(Smith, 2020)" for
// author-date styles, "[3]" or "(3)" for numbered ones. Reference ids are
// internal and never shown as-is.
export function citationFormatter(
  style: CitationStyleId,
  sources: LabelSource[],
  doc: TiptapDoc,
): (refIds: string[]) => string {
  const byId = new Map<string, CiteSource>(
    sources.map((source) => [
      source.refId,
      {
        refId: source.refId,
        authors: source.authors,
        year: source.year,
        title: source.title,
        contentStatus: "metadata_only",
      },
    ]),
  );
  if (style === "ieee" || style === "vancouver") {
    const numbered = new Map(
      citedIdsInDoc(doc).map((id, index) => [id, index + 1]),
    );
    return (refIds) =>
      numberedLabel(style, refIds.map((id) => numbered.get(id) ?? 0));
  }
  return (refIds) =>
    inTextCitation(
      style,
      refIds
        .map((id) => byId.get(id))
        .filter((source): source is CiteSource => Boolean(source)),
    ) || "(citation)";
}
