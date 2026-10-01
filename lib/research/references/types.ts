export type CanonicalWork = {
  title: string;
  authors: string[];
  year?: number;
  journal?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  doi?: string;
  url?: string;
  abstract?: string;
  provider: "crossref" | "openalex";
  providerId?: string;
};

export type ContentStatus =
  | "abstract"
  | "user_notes"
  | "metadata_only"
  | "unavailable";

export type VerificationStatus = "verified" | "ambiguous" | "unverified";
