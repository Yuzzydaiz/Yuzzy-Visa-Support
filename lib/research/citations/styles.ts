import type { CitationStyleId } from "@/lib/config/research-product";
import type { ContentStatus } from "@/lib/research/references/types";

export type CiteSource = {
  refId: string;
  authors: string[];
  year?: number;
  title: string;
  journal?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  doi?: string;
  contentStatus: ContentStatus | "full_text" | "unavailable";
};

function familyName(author: string): string {
  const parts = author.trim().split(/\s+/);
  return parts.at(-1) || author;
}

function authorList(authors: string[], style: "apa" | "amp"): string {
  if (!authors.length) {
    return "Unknown";
  }
  const names = authors.map(familyName);
  if (names.length === 1) {
    return names[0];
  }
  if (names.length === 2) {
    return `${names[0]}${style === "apa" ? " & " : " and "}${names[1]}`;
  }
  return `${names[0]} et al.`;
}

function yearOf(source: CiteSource): string {
  return source.year ? String(source.year) : "n.d.";
}

export function inTextCitation(
  style: CitationStyleId,
  sources: CiteSource[],
  options?: { narrative?: boolean },
): string {
  if (!sources.length) {
    return "";
  }
  if (style === "ieee" || style === "vancouver") {
    return "";
  }
  const narrative = options?.narrative ?? false;
  const bits = sources.map((source) => {
    const who = authorList(source.authors, style === "mla" ? "amp" : "apa");
    const year = yearOf(source);
    if (style === "mla") {
      return narrative ? `${who}` : `${who} ${year}`;
    }
    if (narrative) {
      return `${who} (${year})`;
    }
    return `${who}, ${year}`;
  });
  if (narrative && style !== "mla") {
    return bits.join("; ");
  }
  return `(${bits.join("; ")})`;
}

export function numberedLabel(
  style: CitationStyleId,
  numbers: number[],
): string {
  if (style === "ieee") {
    return `[${numbers.join(",")}]`;
  }
  if (style === "vancouver") {
    return `(${numbers.join(",")})`;
  }
  return "";
}

export const HARVARD_VARIANT =
  "Cite Them Right author-date (Author, Year)";
