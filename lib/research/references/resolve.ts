import "server-only";

import { detectReferenceInputType } from "@/lib/validation/research";
import { extractDoiFromText, normalizeDoi } from "@/lib/research/references/doi";
import { safeFetch, SsrfBlockedError } from "@/lib/research/security/safe-fetch";
import { classifyCandidates } from "@/lib/research/references/score";
import type { CrossrefClient } from "@/lib/research/references/crossref";
import type { OpenAlexClient } from "@/lib/research/references/openalex";
import type {
  CanonicalWork,
  ContentStatus,
  VerificationStatus,
} from "@/lib/research/references/types";

export type ResolveInput = {
  id?: string;
  originalInput: string;
  userProvidedNotes?: string;
};

export type ResolvedReference = {
  id?: string;
  originalInput: string;
  inputType: "doi" | "url" | "citation";
  verificationStatus: VerificationStatus;
  contentStatus: ContentStatus;
  matched?: CanonicalWork;
  candidates: CanonicalWork[];
};

export type ResolveDeps = {
  crossref: CrossrefClient;
  openalex: OpenAlexClient;
  fetchPage?: typeof safeFetch;
};

function contentStatusFor(
  work: CanonicalWork | undefined,
  notes?: string,
): ContentStatus {
  if (notes?.trim()) {
    return "user_notes";
  }
  if (work?.abstract?.trim()) {
    return "abstract";
  }
  if (work) {
    return "metadata_only";
  }
  return "unavailable";
}

function hintsFromCitation(raw: string): {
  titleHint?: string;
  yearHint?: number;
  authorHint?: string;
} {
  const yearMatch = raw.match(/\b(19|20)\d{2}\b/);
  const authorHint = raw.split(/[,.(]/)[0]?.trim();
  const authorTokens = authorHint?.split(/\s+/).filter(Boolean) ?? [];
  return {
    titleHint: raw,
    yearHint: yearMatch ? Number.parseInt(yearMatch[0], 10) : undefined,
    authorHint:
      authorHint && authorTokens.length > 0 && authorTokens.length <= 3
        ? authorHint
        : undefined,
  };
}

function extractDoiFromHtml(html: string): string | undefined {
  const citation = html.match(
    /<meta[^>]+name=["']citation_doi["'][^>]+content=["']([^"']+)["']/i,
  );
  if (citation?.[1]) {
    return normalizeDoi(citation[1]);
  }
  const dc = html.match(
    /<meta[^>]+name=["']dc.identifier["'][^>]+content=["']([^"']+)["']/i,
  );
  if (dc?.[1]) {
    return extractDoiFromText(dc[1]);
  }
  return extractDoiFromText(html.slice(0, 20_000));
}

async function collectForDoi(
  doi: string,
  deps: ResolveDeps,
): Promise<CanonicalWork[]> {
  const works: CanonicalWork[] = [];
  const crossref = await deps.crossref.lookupDoi(doi);
  if (crossref) {
    works.push(crossref);
  } else {
    const openalex = await deps.openalex.lookupDoi(doi);
    if (openalex) {
      works.push(openalex);
    }
  }
  return works;
}

export async function resolveOne(
  input: ResolveInput,
  deps: ResolveDeps,
): Promise<ResolvedReference> {
  const originalInput = input.originalInput.trim();
  const inputType = detectReferenceInputType(originalInput);
  const notes = input.userProvidedNotes?.trim();
  let candidates: CanonicalWork[] = [];
  let doi = extractDoiFromText(originalInput);
  const citationHints = hintsFromCitation(originalInput);

  try {
    if (inputType === "url" && !doi) {
      const page = await (deps.fetchPage ?? safeFetch)(originalInput);
      doi = extractDoiFromHtml(page.body);
      if (!doi) {
        const titleMatch = page.body.match(/<title>([^<]+)<\/title>/i);
        if (titleMatch?.[1]) {
          candidates = [
            ...(await deps.crossref.searchBibliographic(titleMatch[1])),
            ...(await deps.openalex.searchTitle(titleMatch[1])),
          ];
        }
      }
    }

    if (doi) {
      candidates = [...candidates, ...(await collectForDoi(doi, deps))];
    } else if (inputType === "citation" || inputType === "url") {
      candidates = [
        ...candidates,
        ...(await deps.crossref.searchBibliographic(originalInput)),
        ...(await deps.openalex.searchTitle(originalInput)),
      ];
    }
  } catch (error) {
    if (error instanceof SsrfBlockedError) {
      return {
        id: input.id,
        originalInput,
        inputType,
        verificationStatus: "unverified",
        contentStatus: "unavailable",
        candidates: [],
      };
    }
    throw error;
  }

  const classified = classifyCandidates(
    { ...citationHints, doi },
    candidates,
  );
  const matched =
    classified.status === "verified" ? classified.ranked[0] : undefined;

  return {
    id: input.id,
    originalInput,
    inputType,
    verificationStatus: classified.status,
    contentStatus: contentStatusFor(matched ?? classified.ranked[0], notes),
    matched,
    candidates:
      classified.status === "ambiguous"
        ? classified.ranked.slice(0, 5)
        : classified.status === "verified"
          ? classified.ranked.slice(0, 1)
          : [],
  };
}

export async function resolveReferences(
  inputs: ResolveInput[],
  deps: ResolveDeps,
): Promise<ResolvedReference[]> {
  const results: ResolvedReference[] = [];
  for (const item of inputs) {
    results.push(await resolveOne(item, deps));
  }
  return results;
}
