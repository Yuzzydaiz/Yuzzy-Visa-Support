import "server-only";

import type { CanonicalWork } from "@/lib/research/references/types";
import { normalizeDoi } from "@/lib/research/references/doi";

export type OpenAlexClient = {
  lookupDoi: (doi: string) => Promise<CanonicalWork | undefined>;
  searchTitle: (query: string) => Promise<CanonicalWork[]>;
  searchWorks: (query: string) => Promise<CanonicalWork[]>;
};

const REQUEST_TIMEOUT_MS = 8000;

type OpenAlexWork = {
  id?: string;
  display_name?: string;
  publication_year?: number;
  doi?: string;
  authorships?: Array<{ author?: { display_name?: string } }>;
  primary_location?: { source?: { display_name?: string }; landing_page_url?: string };
  biblio?: { volume?: string; issue?: string; first_page?: string; last_page?: string };
  abstract_inverted_index?: Record<string, number[]>;
};

function politeHeaders(email: string, apiKey?: string): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": `YuzzyVisaSupport/1.0 (mailto:${email})`,
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  return headers;
}

function rebuildAbstract(index: Record<string, number[]> | undefined): string | undefined {
  if (!index) {
    return undefined;
  }
  const slots: Array<{ word: string; position: number }> = [];
  for (const [word, positions] of Object.entries(index)) {
    for (const position of positions) {
      slots.push({ word, position });
    }
  }
  if (!slots.length) {
    return undefined;
  }
  return slots
    .sort((a, b) => a.position - b.position)
    .map((slot) => slot.word)
    .join(" ");
}

function mapWork(work: OpenAlexWork): CanonicalWork | undefined {
  const title = work.display_name?.trim();
  if (!title) {
    return undefined;
  }
  const pages =
    work.biblio?.first_page && work.biblio?.last_page
      ? `${work.biblio.first_page}-${work.biblio.last_page}`
      : work.biblio?.first_page;
  return {
    title,
    authors: (work.authorships ?? [])
      .map((item) => item.author?.display_name?.trim())
      .filter((name): name is string => Boolean(name)),
    year: work.publication_year,
    journal: work.primary_location?.source?.display_name,
    volume: work.biblio?.volume,
    issue: work.biblio?.issue,
    pages,
    doi: work.doi ? normalizeDoi(work.doi) : undefined,
    url: work.primary_location?.landing_page_url,
    abstract: rebuildAbstract(work.abstract_inverted_index),
    provider: "openalex",
    providerId: work.id,
  };
}

export function createOpenAlexClient(input: {
  email: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}): OpenAlexClient {
  const fetchImpl = input.fetchImpl ?? fetch;
  const baseUrl = input.baseUrl ?? "https://api.openalex.org";

  async function getJson(path: string): Promise<unknown> {
    const url = new URL(`${baseUrl}${path}`);
    if (input.apiKey && !url.searchParams.has("api_key")) {
      url.searchParams.set("api_key", input.apiKey);
    }
    const response = await fetchImpl(url.toString(), {
      headers: politeHeaders(input.email, input.apiKey),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (response.status === 404) {
      return undefined;
    }
    if (!response.ok) {
      throw new Error(`OpenAlex request failed (${response.status})`);
    }
    return response.json();
  }

  async function search(query: string, minLength: number) {
    // OpenAlex reads ? and * as wildcards and rejects the whole search (400)
    // when they appear in a stemmed query, so a citation such as "Can
    // language models be too big?" would fail. They carry no meaning here.
    const trimmed = query.replace(/[?*]/g, " ").replace(/\s+/g, " ").trim();
    if (trimmed.length < minLength) {
      return [];
    }
    const json = (await getJson(
      `/works?search=${encodeURIComponent(trimmed)}&per-page=5`,
    )) as { results?: OpenAlexWork[] } | undefined;
    return (json?.results ?? [])
      .map((item) => mapWork(item))
      .filter((item): item is CanonicalWork => Boolean(item));
  }

  return {
    async lookupDoi(doi) {
      const normalized = normalizeDoi(doi);
      if (!normalized) {
        return undefined;
      }
      const json = (await getJson(
        `/works/https://doi.org/${encodeURIComponent(normalized)}`,
      )) as OpenAlexWork | undefined;
      return json ? mapWork(json) : undefined;
    },
    searchTitle: (query) => search(query, 8),
    searchWorks: (query) => search(query, 3),
  };
}
