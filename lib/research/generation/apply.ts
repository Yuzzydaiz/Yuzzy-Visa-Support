import type { CitationStyleId } from "@/lib/config/research-product";
import type { PaperDocument } from "@/lib/models/Paper";
import type { SectionJson } from "@/lib/research/ai/schemas";
import { buildCitationContext, renderCitations } from "@/lib/research/citations/render";
import { collectCitedIds } from "@/lib/research/citations/tokens";
import type { CiteSource } from "@/lib/research/citations/styles";
import { joinedSectionText } from "@/lib/research/generation/validate";
import {
  buildSourceManifest,
  type SourceManifestEntry,
} from "@/lib/research/generation/manifest";

export type GenerationState = NonNullable<PaperDocument["generation"]>;

export function ensureGenerationState(paper: PaperDocument): GenerationState {
  const current: Partial<GenerationState> = paper.generation ?? {};
  const generation: GenerationState = {
    currentStep: current.currentStep ?? undefined,
    lockOwner: current.lockOwner ?? undefined,
    lockUntil: current.lockUntil ?? undefined,
    lastError: current.lastError ?? undefined,
    completedSteps: current.completedSteps ?? [],
    attempts: current.attempts ?? 0,
    totalInputTokens: current.totalInputTokens ?? 0,
    totalOutputTokens: current.totalOutputTokens ?? 0,
    version: current.version ?? 0,
    bibliography: current.bibliography ?? [],
  };
  paper.generation = generation;
  // Return the value the document now holds (Mongoose may cast on assignment),
  // so callers mutate the persisted subdocument rather than a detached object.
  return paper.generation as GenerationState;
}

export function citeSources(manifest: SourceManifestEntry[]): CiteSource[] {
  return manifest.map((entry) => ({
    refId: entry.refId,
    authors: entry.authors,
    year: entry.year,
    title: entry.title,
    journal: entry.journal,
    volume: entry.volume,
    issue: entry.issue,
    pages: entry.pages,
    doi: entry.doi,
    contentStatus: entry.contentStatus,
  }));
}

export function allowedIds(manifest: SourceManifestEntry[]): Set<string> {
  return new Set(manifest.map((entry) => entry.refId));
}

export function paperManifest(paper: PaperDocument): SourceManifestEntry[] {
  return buildSourceManifest(paper.references ?? []);
}

export function addTokenUsage(
  paper: PaperDocument,
  usage: { inputTokens: number; outputTokens: number },
) {
  const generation = ensureGenerationState(paper);
  generation.totalInputTokens += usage.inputTokens;
  generation.totalOutputTokens += usage.outputTokens;
}

export function paperTokenTexts(paper: PaperDocument): string[] {
  return paper.sections.map((section) => {
    const json = section.contentJson as SectionJson | undefined;
    return json ? joinedSectionText(json) : section.plainText || "";
  });
}

export function applyRenderedPaper(
  paper: PaperDocument,
  manifest: SourceManifestEntry[],
) {
  const tokenTexts = paperTokenTexts(paper);
  const context = buildCitationContext(tokenTexts);
  const sources = citeSources(manifest);
  const allowed = allowedIds(manifest);
  return paper.sections.map((section, index) => {
    const tokenText = tokenTexts[index] ?? "";
    const rendered = renderCitations({
      text: tokenText,
      style: paper.citationStyle as CitationStyleId,
      sources,
      allowedIds: allowed,
      context,
    });
    section.plainText = rendered.text;
    section.citationHtml = rendered.text;
    section.citedRefIds = collectCitedIds(tokenText);
    section.actualWords = rendered.text.split(/\s+/).filter(Boolean).length;
    const partsTotal = section.partsTotal ?? 1;
    const partsDone = section.partsDone ?? partsTotal;
    if (tokenText.trim() && partsDone >= partsTotal) {
      section.generationStatus = "complete";
    }
    section.lastGeneratedAt = new Date();
    return rendered;
  });
}

export function applyRenderedSection(
  paper: PaperDocument,
  sectionIndex: number,
  manifest: SourceManifestEntry[],
) {
  return applyRenderedPaper(paper, manifest)[sectionIndex];
}

export function applyPaperBibliography(
  paper: PaperDocument,
  manifest: SourceManifestEntry[],
) {
  const generation = ensureGenerationState(paper);
  const tokenTexts = paperTokenTexts(paper).filter((text) => text.trim());
  if (!tokenTexts.length) {
    generation.bibliography = [];
    return;
  }
  try {
    const rendered = renderCitations({
      text: tokenTexts.join("\n"),
      style: paper.citationStyle as CitationStyleId,
      sources: citeSources(manifest),
      allowedIds: allowedIds(manifest),
      context: buildCitationContext(tokenTexts),
    });
    generation.bibliography = rendered.bibliography;
  } catch {
    generation.bibliography = [];
  }
}
