import type { CitationStyleId, PaperType } from "@/lib/config/research-product";
import type {
  CanonicalWork,
  ContentStatus,
  VerificationStatus,
} from "@/lib/research/references/types";

export const WIZARD_STEPS = [
  "details",
  "sources",
  "review",
  "payment",
  "generation",
  "editor",
] as const;

export type WizardStep = (typeof WIZARD_STEPS)[number];
export type ActiveWizardStep = "details" | "sources" | "review";

export const ACTIVE_STEPS: ActiveWizardStep[] = [
  "details",
  "sources",
  "review",
];

export type DraftAuthor = {
  name: string;
  affiliation: string;
  department: string;
  email: string;
  orcid: string;
};

export type DraftReference = {
  id: string;
  originalInput: string;
  userProvidedNotes: string;
  verificationStatus?: VerificationStatus | "pending";
  contentStatus?: ContentStatus;
  matched?: CanonicalWork;
  candidates?: CanonicalWork[];
  isSystemAdded?: boolean;
  isUserKeyReference?: boolean;
  selectedByUser?: boolean;
};

export type ResearchDraft = {
  step: ActiveWizardStep;
  title: string;
  focus: string;
  paperType: PaperType;
  authors: DraftAuthor[];
  citationStyle: CitationStyleId;
  requestedPages: number;
  allowAdditionalSources: boolean;
  researchNotes: string;
  actualMethodology: string;
  actualFindings: string;
  customerEmail: string;
  references: DraftReference[];
};

export const DRAFT_STORAGE_KEY = "yuzzy-research-draft-v1";

export function emptyAuthor(): DraftAuthor {
  return {
    name: "",
    affiliation: "",
    department: "",
    email: "",
    orcid: "",
  };
}

export function emptyReference(): DraftReference {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `ref_${Date.now()}`,
    originalInput: "",
    userProvidedNotes: "",
    verificationStatus: "pending",
    candidates: [],
    isSystemAdded: false,
    isUserKeyReference: true,
    selectedByUser: true,
  };
}

export function defaultResearchDraft(): ResearchDraft {
  return {
    step: "details",
    title: "",
    focus: "",
    paperType: "literature_review",
    authors: [emptyAuthor()],
    citationStyle: "apa",
    requestedPages: 10,
    allowAdditionalSources: false,
    researchNotes: "",
    actualMethodology: "",
    actualFindings: "",
    customerEmail: "",
    references: [emptyReference()],
  };
}

export function referenceIncludedInOrder(reference: DraftReference): boolean {
  return !(reference.isSystemAdded && reference.selectedByUser === false);
}

export function referenceAllowsReview(reference: DraftReference): boolean {
  if (!referenceIncludedInOrder(reference)) {
    return true;
  }
  return (
    reference.verificationStatus === "verified" && Boolean(reference.matched)
  );
}

export const ACCESS_STORAGE_KEY = "yuzzy-research-access-v1";
export const IDEMPOTENCY_STORAGE_KEY = "yuzzy-research-idempotency-v1";
