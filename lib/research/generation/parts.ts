import type { SectionJson } from "@/lib/research/ai/schemas";

// Each model call writes at most about this many words. A long section (for
// example the 35% literature review of a 40 page paper, ~4,200 words) is
// written as several parts across separate generate-next requests, so every
// call stays inside the per-request LLM timeout and the generation lease.
export const SECTION_PART_WORDS = 1000;

const CONTINUATION_CHARS = 1500;

export function partsFor(wordBudget: number): number {
  if (!Number.isFinite(wordBudget) || wordBudget <= SECTION_PART_WORDS) {
    return 1;
  }
  return Math.ceil(wordBudget / SECTION_PART_WORDS);
}

// Splits the section budget across parts so the parts sum to the budget.
export function partBudget(
  wordBudget: number,
  partIndex: number,
  total: number,
): number {
  const base = Math.floor(wordBudget / total);
  const remainder = wordBudget - base * total;
  return Math.max(1, base + (partIndex < remainder ? 1 : 0));
}

// Single-part sections keep their plain section id as the step id, so papers
// generated before parts existed replay and resume exactly as before.
export function partStepId(
  sectionId: string,
  partIndex: number,
  total: number,
): string {
  return total > 1 ? `${sectionId}#${partIndex + 1}` : sectionId;
}

export type SectionPart = {
  index: number;
  total: number;
  previousText?: string;
};

// The tail of what has been written so far, so the next part continues the
// argument instead of restarting the section.
export function continuationText(paragraphs: Array<{ text: string }>): string {
  const tail = paragraphs.slice(-2).map((paragraph) => paragraph.text).join("\n");
  return tail.length > CONTINUATION_CHARS
    ? tail.slice(tail.length - CONTINUATION_CHARS)
    : tail;
}

export function mergeSectionPart(
  existing: SectionJson | undefined,
  part: SectionJson,
): SectionJson {
  if (!existing) {
    return part;
  }
  return {
    sectionId: existing.sectionId,
    title: existing.title,
    paragraphs: [...existing.paragraphs, ...part.paragraphs],
    usedReferenceIds: [
      ...new Set([...existing.usedReferenceIds, ...part.usedReferenceIds]),
    ],
    limitations: [...(existing.limitations ?? []), ...(part.limitations ?? [])],
    wordCountEstimate: existing.wordCountEstimate + part.wordCountEstimate,
  };
}
