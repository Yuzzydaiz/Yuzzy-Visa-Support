import type { CitationStyleId } from "@/lib/config/research-product";
import {
  HARVARD_VARIANT,
  inTextCitation,
  numberedLabel,
  type CiteSource,
} from "@/lib/research/citations/styles";
import {
  CitationTokenError,
  assertAllowedCiteIds,
  collectCitedIds,
  replaceCiteTokens,
} from "@/lib/research/citations/tokens";

export { HARVARD_VARIANT };

export type CitationRenderContext = {
  orderedIds: string[];
  numbered: Map<string, number>;
};

function familyName(author: string): string {
  const parts = author.trim().split(/\s+/);
  return parts.at(-1) || author;
}

function sortKey(source: CiteSource): string {
  const lead = source.authors[0] ? familyName(source.authors[0]) : source.title;
  return lead.toLocaleLowerCase();
}

function compareAuthorDate(a: CiteSource, b: CiteSource): number {
  return (
    sortKey(a).localeCompare(sortKey(b)) ||
    (a.year ?? Number.MAX_SAFE_INTEGER) - (b.year ?? Number.MAX_SAFE_INTEGER) ||
    a.title.localeCompare(b.title)
  );
}

function bibliographyLine(style: CitationStyleId, source: CiteSource, index: number): string {
  const authors = source.authors.length
    ? source.authors.map((name) => familyName(name)).join(", ")
    : "Unknown";
  const year = source.year ? `(${source.year})` : "(n.d.)";
  const journal = source.journal ? ` ${source.journal}` : "";
  const loc = [source.volume, source.issue ? `(${source.issue})` : "", source.pages]
    .filter(Boolean)
    .join(" ");
  const doi = source.doi ? ` https://doi.org/${source.doi}` : "";
  const core = `${authors} ${year}. ${source.title}.${journal}${loc ? `. ${loc}` : ""}.${doi}`;
  if (style === "ieee" || style === "vancouver") {
    return `[${index}] ${core}`;
  }
  return core;
}

export function renderCitations(input: {
  text: string;
  style: CitationStyleId;
  sources: CiteSource[];
  allowedIds: Set<string>;
  context?: CitationRenderContext;
}): { text: string; citedIds: string[]; bibliography: string[] } {
  assertAllowedCiteIds(input.text, input.allowedIds);
  const byId = new Map(input.sources.map((source) => [source.refId, source]));
  const citedIds = collectCitedIds(input.text);
  const localOrder = uniqueCiteOrder(citedIds);
  const order = input.context?.orderedIds ?? localOrder;
  const numbered = input.context?.numbered ?? new Map(order.map((id, index) => [id, index + 1]));
  const text = replaceCiteTokens(input.text, (ids) => {
    const sources = ids.map((id) => {
      const source = byId.get(id);
      if (!source) {
        throw new CitationTokenError(`Unknown citation id: ${id}`);
      }
      return source;
    });
    if (input.style === "ieee" || input.style === "vancouver") {
      return numberedLabel(
        input.style,
        ids.map((id) => numbered.get(id) ?? 0),
      );
    }
    return inTextCitation(input.style, sources);
  });
  const cited = order.map((id) => {
    const source = byId.get(id);
    if (!source) {
      throw new CitationTokenError(`Unknown citation id: ${id}`);
    }
    return source;
  });
  // Numbered styles list sources in first-citation order; author-date styles
  // (APA, MLA, Harvard, Chicago) list them alphabetically by author, then year.
  const numberedStyle = input.style === "ieee" || input.style === "vancouver";
  const listed = numberedStyle ? cited : [...cited].sort(compareAuthorDate);
  const bibliography = listed.map((source, index) =>
    bibliographyLine(input.style, source, index + 1),
  );
  return { text, citedIds: order, bibliography };
}

export function uniqueCiteOrder(ids: string[]): string[] {
  const order: string[] = [];
  for (const id of ids) {
    if (!order.includes(id)) {
      order.push(id);
    }
  }
  return order;
}

export function buildCitationContext(texts: string[]): CitationRenderContext {
  const orderedIds = uniqueCiteOrder(texts.flatMap((text) => collectCitedIds(text)));
  return {
    orderedIds,
    numbered: new Map(orderedIds.map((id, index) => [id, index + 1])),
  };
}
