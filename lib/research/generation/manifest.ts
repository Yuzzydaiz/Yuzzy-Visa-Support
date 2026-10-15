import type { ContentStatus } from "@/lib/research/references/types";

export type SourceManifestEntry = {
  refId: string;
  title: string;
  authors: string[];
  year?: number;
  journal?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  doi?: string;
  evidence: string;
  contentStatus: ContentStatus | "full_text" | "unavailable";
};

export type PaperReferenceLike = {
  refId: string;
  title?: string | null;
  authors?: string[] | null;
  year?: number | null;
  journal?: string | null;
  volume?: string | null;
  issue?: string | null;
  pages?: string | null;
  doi?: string | null;
  abstract?: string | null;
  userProvidedNotes?: string | null;
  verificationStatus?: string;
  selectedByUser?: boolean;
  contentStatus?: string;
};

export function allowedReferences(references: PaperReferenceLike[]): PaperReferenceLike[] {
  return references.filter(
    (reference) =>
      reference.verificationStatus === "verified" &&
      reference.selectedByUser !== false,
  );
}

export function buildSourceManifest(
  references: PaperReferenceLike[],
): SourceManifestEntry[] {
  return allowedReferences(references).map((reference) => ({
    refId: reference.refId,
    title: reference.title || reference.refId,
    authors: reference.authors ?? [],
    year: reference.year ?? undefined,
    journal: reference.journal ?? undefined,
    volume: reference.volume ?? undefined,
    issue: reference.issue ?? undefined,
    pages: reference.pages ?? undefined,
    doi: reference.doi ?? undefined,
    evidence: (reference.abstract || reference.userProvidedNotes || "").trim(),
    contentStatus: (reference.contentStatus as SourceManifestEntry["contentStatus"]) || "unavailable",
  }));
}
