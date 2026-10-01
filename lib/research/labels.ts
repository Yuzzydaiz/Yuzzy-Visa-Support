import type { PaperType } from "@/lib/config/research-product";

export const PAPER_TYPE_CARDS: Array<{
  id: PaperType;
  title: string;
  will: string;
  willNot: string;
}> = [
  {
    id: "literature_review",
    title: "Literature review",
    will: "Synthesize agreement, disagreement, and gaps from readable sources.",
    willNot: "Does not invent experiments or results.",
  },
  {
    id: "research_proposal",
    title: "Research proposal",
    will: "Describe the question, intended method, and expected contribution.",
    willNot: "Does not write completed results.",
  },
  {
    id: "original_research_draft",
    title: "Original research draft",
    will: "Organize the method and findings you supply.",
    willNot: "Does not invent participants, data, or statistics.",
  },
];

export const CITATION_STYLE_LABELS: Record<string, string> = {
  apa: "APA",
  ieee: "IEEE",
  mla: "MLA",
  vancouver: "Vancouver",
  harvard: "Harvard",
  chicago: "Chicago",
};

export const PAPER_TYPE_LABELS: Record<PaperType, string> = {
  literature_review: "Literature review",
  research_proposal: "Research proposal",
  original_research_draft: "Original research draft",
};

export const CONTENT_STATUS_LABELS = {
  abstract: "Abstract available",
  user_notes: "Uses your notes",
  metadata_only: "Metadata only (not full text)",
  unavailable: "No readable evidence",
} as const;

export const VERIFICATION_LABELS = {
  pending: "Pending match",
  verified: "Verified",
  ambiguous: "Pick a match",
  unverified: "Not matched",
} as const;
