import type { PaperType } from "@/lib/config/research-product";
import type { SourceManifestEntry } from "@/lib/research/generation/manifest";

export type OutlinePlanItem = {
  sectionId: string;
  type: string;
  title: string;
  order: number;
  arguments: string[];
  wordBudget: number;
  plannedRefIds: string[];
};

const LITERATURE_SHARES: Array<{ type: string; title: string; share: number }> = [
  { type: "abstract", title: "Abstract", share: 0.05 },
  { type: "introduction", title: "Introduction", share: 0.15 },
  { type: "literature_review", title: "Literature review", share: 0.35 },
  { type: "methodology", title: "Methodology", share: 0.12 },
  { type: "results_discussion", title: "Results and discussion", share: 0.25 },
  { type: "conclusion", title: "Conclusion", share: 0.08 },
];

export class OutlineValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OutlineValidationError";
  }
}

function templateFor(input: {
  paperType: PaperType;
  hasMethodology: boolean;
  hasFindings: boolean;
}): Array<{ type: string; title: string; share: number }> {
  if (input.paperType === "research_proposal") {
    return [
      { type: "abstract", title: "Abstract", share: 0.08 },
      { type: "introduction", title: "Introduction", share: 0.2 },
      { type: "literature_review", title: "Literature review", share: 0.32 },
      { type: "methodology", title: "Proposed methods", share: 0.25 },
      { type: "conclusion", title: "Contribution and next steps", share: 0.15 },
    ];
  }
  if (input.paperType === "original_research_draft") {
    if (!input.hasMethodology || !input.hasFindings) {
      throw new OutlineValidationError(
        "Original research requires actual methodology and findings before outlining.",
      );
    }
    return LITERATURE_SHARES;
  }
  return LITERATURE_SHARES;
}

export function allocateOutline(input: {
  paperType: PaperType;
  targetWords: number;
  manifest: SourceManifestEntry[];
  hasMethodology?: boolean;
  hasFindings?: boolean;
}): OutlinePlanItem[] {
  const rows = templateFor({
    paperType: input.paperType,
    hasMethodology: Boolean(input.hasMethodology),
    hasFindings: Boolean(input.hasFindings),
  });
  const refIds = input.manifest.map((entry) => entry.refId);
  const planned = refIds.slice(0, 8);
  let remaining = input.targetWords;
  return rows.map((row, index) => {
    const isLast = index === rows.length - 1;
    const wordBudget = isLast
      ? Math.max(1, remaining)
      : Math.max(1, Math.round(input.targetWords * row.share));
    if (!isLast) {
      remaining -= wordBudget;
    }
    return {
      sectionId: row.type,
      type: row.type,
      title: row.title,
      order: index,
      arguments: [],
      wordBudget,
      plannedRefIds: planned,
    };
  });
}

export function assertOutlineCitations(
  outline: OutlinePlanItem[],
  manifest: SourceManifestEntry[],
) {
  const allowed = new Set(manifest.map((entry) => entry.refId));
  for (const item of outline) {
    for (const id of item.plannedRefIds) {
      if (!allowed.has(id)) {
        throw new OutlineValidationError(`Outline cites unknown source ${id}`);
      }
    }
  }
}
