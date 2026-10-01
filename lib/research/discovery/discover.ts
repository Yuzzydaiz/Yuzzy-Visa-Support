import "server-only";

import type { CrossrefClient } from "@/lib/research/references/crossref";
import type { OpenAlexClient } from "@/lib/research/references/openalex";
import { dedupeWorks } from "@/lib/research/references/score";
import type { CanonicalWork } from "@/lib/research/references/types";
import { normalizeDoi } from "@/lib/research/references/doi";

export type DiscoveredSource = {
  originalInput: string;
  verificationStatus: "verified";
  contentStatus: "abstract" | "metadata_only";
  matched: CanonicalWork;
  isSystemAdded: true;
  isUserKeyReference: false;
  selectedByUser: true;
};

function identity(work: CanonicalWork): string {
  const doi = work.doi ? normalizeDoi(work.doi) : undefined;
  if (doi) {
    return `doi:${doi}`;
  }
  const title = work.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const author = work.authors[0]?.toLowerCase().split(/\s+/).at(-1) ?? "";
  return `tya:${title}|${work.year ?? ""}|${author}`;
}

export async function discoverAdditionalSources(input: {
  allowAdditionalSources: boolean;
  concepts: string[];
  userWorks: CanonicalWork[];
  max: number;
  openalex: OpenAlexClient;
  crossref: CrossrefClient;
}): Promise<DiscoveredSource[]> {
  if (!input.allowAdditionalSources || input.max < 1) {
    return [];
  }

  const blocked = new Set(input.userWorks.map(identity));
  const found: CanonicalWork[] = [];

  for (const concept of input.concepts) {
    if (found.length >= input.max) {
      break;
    }
    const hits = await input.openalex.searchWorks(concept);
    for (const hit of hits) {
      if (found.length >= input.max) {
        break;
      }
      if (!hit.doi) {
        continue;
      }
      const verified = (await input.crossref.lookupDoi(hit.doi)) ?? hit;
      if (!verified.doi) {
        continue;
      }
      const key = identity(verified);
      if (blocked.has(key)) {
        continue;
      }
      blocked.add(key);
      found.push(verified);
    }
  }

  return dedupeWorks(found).slice(0, input.max).map((matched) => ({
    originalInput: matched.doi
      ? `https://doi.org/${matched.doi}`
      : matched.title,
    verificationStatus: "verified" as const,
    contentStatus: matched.abstract?.trim() ? "abstract" : "metadata_only",
    matched,
    isSystemAdded: true as const,
    isUserKeyReference: false as const,
    selectedByUser: true as const,
  }));
}
