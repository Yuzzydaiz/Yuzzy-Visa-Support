import { collectCitedIds } from "@/lib/research/citations/tokens";
import type { SectionJson } from "@/lib/research/ai/schemas";
import type { SourceManifestEntry } from "@/lib/research/generation/manifest";

export type SectionValidationIssue = {
  code: "unknown_cite" | "word_count" | "uncited_claim" | "metadata_only_claim";
  message: string;
};

const EMPIRICAL =
  /\b(\d+(\.\d+)?%|p\s*[<>=]\s*0\.\d+|n\s*=\s*\d+|participants?|sample size|statistically significant)\b/i;

export function joinedSectionText(section: SectionJson): string {
  return section.paragraphs.map((paragraph) => paragraph.text).join("\n");
}

export function validateSectionOutput(input: {
  section: SectionJson;
  allowedIds: Set<string>;
  wordBudget: number;
  manifest: SourceManifestEntry[];
  allowUncitedEmpiricalClaims?: boolean;
}): SectionValidationIssue[] {
  const issues: SectionValidationIssue[] = [];
  const text = joinedSectionText(input.section);
  const cited = collectCitedIds(text);
  for (const id of cited) {
    if (!input.allowedIds.has(id)) {
      issues.push({
        code: "unknown_cite",
        message: `Unknown citation id ${id}`,
      });
    }
  }
  const words = text.split(/\s+/).filter(Boolean).length;
  const min = Math.floor(input.wordBudget * 0.55);
  const max = Math.ceil(input.wordBudget * 1.45);
  if (words < min || words > max) {
    issues.push({
      code: "word_count",
      message: `Word count ${words} is outside ${min}-${max}`,
    });
  }
  const sentences = text.split(/(?<=[.!?])\s+/);
  for (const sentence of sentences) {
    if (
      EMPIRICAL.test(sentence) &&
      !/\[CITE:/.test(sentence) &&
      !input.allowUncitedEmpiricalClaims
    ) {
      issues.push({
        code: "uncited_claim",
        message: "Empirical claim without a citation token",
      });
      break;
    }
  }
  const byId = new Map(input.manifest.map((entry) => [entry.refId, entry]));
  for (const sentence of sentences) {
    if (!EMPIRICAL.test(sentence)) {
      continue;
    }
    const ids = collectCitedIds(sentence);
    for (const id of ids) {
      if (byId.get(id)?.contentStatus === "metadata_only") {
        issues.push({
          code: "metadata_only_claim",
          message: `Metadata-only source ${id} cannot support an empirical claim`,
        });
      }
    }
  }
  return issues;
}

export function usedIdsAreSubset(
  used: string[],
  allowed: Set<string>,
): boolean {
  return used.every((id) => allowed.has(id));
}
