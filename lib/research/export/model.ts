import type { CitationStyleId } from "@/lib/config/research-product";
import type { PaperDocument } from "@/lib/models/Paper";
import type { SectionJson } from "@/lib/research/ai/schemas";
import { buildCitationContext, renderCitations } from "@/lib/research/citations/render";
import {
  allowedIds,
  citeSources,
  paperManifest,
} from "@/lib/research/generation/apply";
import { joinedSectionText } from "@/lib/research/generation/validate";

export type NormalizedAuthor = {
  name: string;
  affiliation?: string;
};

export type NormalizedSection = {
  sectionId: string;
  title: string;
  paragraphs: string[];
};

export type NormalizedExport = {
  title: string;
  authors: NormalizedAuthor[];
  keywords: string[];
  abstract: string;
  sections: NormalizedSection[];
  bibliography: string[];
  filename: string;
};

export function sanitizeExportFilename(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return base || "research-paper";
}

export function buildNormalizedExport(paper: PaperDocument): NormalizedExport {
  const manifest = paperManifest(paper);
  const style = paper.citationStyle as CitationStyleId;
  const tokenParts: string[] = [];
  const sections: NormalizedSection[] = [];
  let abstract = "";
  for (const section of paper.sections ?? []) {
    const json = section.contentJson as SectionJson | undefined;
    const tokenText = json ? joinedSectionText(json) : section.plainText || "";
    tokenParts.push(tokenText);
    let paragraphs: string[];
    try {
      const rendered = tokenText.includes("[CITE:")
        ? renderCitations({
            text: tokenText,
            style,
            sources: citeSources(manifest),
            allowedIds: allowedIds(manifest),
            context: buildCitationContext(
              (paper.sections ?? []).map((item) => {
                const itemJson = item.contentJson as SectionJson | undefined;
                return itemJson ? joinedSectionText(itemJson) : item.plainText || "";
              }),
            ),
          }).text
        : tokenText;
      paragraphs = rendered
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean);
    } catch {
      paragraphs = tokenText.split(/\n+/).map((line) => line.trim()).filter(Boolean);
    }
    if (section.type === "abstract" || section.sectionId === "abstract") {
      abstract = paragraphs.join(" ");
    }
    sections.push({
      sectionId: section.sectionId,
      title: section.title,
      paragraphs,
    });
  }
  const bibliography = paper.generation?.bibliography?.length
    ? [...paper.generation.bibliography]
    : [];
  if (!bibliography.length && tokenParts.join("").includes("[CITE:")) {
    try {
      bibliography.push(
        ...renderCitations({
          text: tokenParts.join("\n"),
          style,
          sources: citeSources(manifest),
          allowedIds: allowedIds(manifest),
          context: buildCitationContext(tokenParts),
        }).bibliography,
      );
    } catch {
      /* keep empty */
    }
  }
  return {
    title: paper.title,
    authors: (paper.authors ?? []).map((author) => ({
      name: author.name,
      affiliation: author.affiliation ?? undefined,
    })),
    keywords: [],
    abstract,
    sections,
    bibliography,
    filename: sanitizeExportFilename(paper.title),
  };
}
