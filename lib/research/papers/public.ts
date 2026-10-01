import type { PaperDocument } from "@/lib/models/Paper";
import type { SectionJson } from "@/lib/research/ai/schemas";
import { allowedReferences } from "@/lib/research/generation/manifest";
import type { TiptapDoc } from "@/lib/research/editor/document";

export type PublicPaperSection = {
  sectionId: string;
  type: string;
  title: string;
  order: number;
  contentJson: unknown;
  plainText: string;
  citationHtml: string;
  targetWords: number;
  actualWords: number;
  citedRefIds: string[];
  generationStatus: string;
};

export type PublicPaperReference = {
  refId: string;
  title: string;
  authors: string[];
  year?: number;
  journal?: string;
  doi?: string;
  contentStatus: string;
  verificationStatus: string;
  selectedByUser: boolean;
};

export function publicPaperProjection(
  paper: PaperDocument,
  requestId: string,
) {
  return {
    requestId,
    publicId: paper.publicId,
    status: paper.status,
    title: paper.title,
    focus: paper.focus,
    paperType: paper.paperType,
    citationStyle: paper.citationStyle,
    requestedPages: paper.requestedPages,
    targetWords: paper.targetWords,
    editorVersion: paper.editorVersion ?? 0,
    editorDocument: paper.editorDocument ?? null,
    authors: (paper.authors ?? []).map((author) => ({
      name: author.name,
      affiliation: author.affiliation,
      department: author.department,
    })),
    references: allowedReferences(paper.references ?? []).map((reference) => ({
      refId: reference.refId,
      title: reference.title || reference.refId,
      authors: reference.authors ?? [],
      year: reference.year ?? undefined,
      journal: reference.journal ?? undefined,
      doi: reference.doi ?? undefined,
      contentStatus: reference.contentStatus ?? "unavailable",
      verificationStatus: reference.verificationStatus ?? "pending",
      selectedByUser: reference.selectedByUser !== false,
    })),
    outline: (paper.outline ?? []).map((item) => ({
      sectionId: item.sectionId,
      type: item.type,
      title: item.title,
      order: item.order,
      arguments: item.arguments ?? [],
      wordBudget: item.wordBudget,
      plannedRefIds: item.plannedRefIds ?? [],
    })),
    sections: (paper.sections ?? []).map((section) => ({
      sectionId: section.sectionId,
      type: section.type,
      title: section.title,
      order: section.order,
      contentJson: section.contentJson ?? null,
      plainText: section.plainText ?? "",
      citationHtml: section.citationHtml ?? "",
      targetWords: section.targetWords,
      actualWords: section.actualWords ?? 0,
      citedRefIds: section.citedRefIds ?? [],
      generationStatus: section.generationStatus ?? "pending",
      validationWarnings: section.validationWarnings ?? [],
    })),
    bibliography: paper.generation?.bibliography ?? [],
    regeneration: {
      used: paper.regeneration?.used ?? 0,
      limit: paper.regeneration?.limit ?? 3,
    },
    generation: {
      currentStep: paper.generation?.currentStep,
      completedSteps: paper.generation?.completedSteps ?? [],
      attempts: paper.generation?.attempts ?? 0,
      lastError: paper.generation?.lastError,
      totalInputTokens: paper.generation?.totalInputTokens ?? 0,
      totalOutputTokens: paper.generation?.totalOutputTokens ?? 0,
      version: paper.generation?.version ?? 0,
    },
  };
}

export type PublicPaper = ReturnType<typeof publicPaperProjection>;

export function sectionJsonFromPaper(section: PaperDocument["sections"][number]): SectionJson {
  const stored = section.contentJson as SectionJson | undefined;
  if (stored?.paragraphs?.length) {
    return stored;
  }
  return {
    sectionId: section.sectionId,
    title: section.title,
    paragraphs: [{ text: section.plainText || section.title }],
    usedReferenceIds: section.citedRefIds ?? [],
    wordCountEstimate: section.actualWords ?? 0,
  };
}

export function isTiptapDoc(value: unknown): value is TiptapDoc {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as TiptapDoc).type === "doc" &&
      Array.isArray((value as TiptapDoc).content),
  );
}
