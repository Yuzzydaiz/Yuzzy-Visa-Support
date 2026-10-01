import "server-only";

import type { CanonicalWork } from "@/lib/research/references/types";
import { normalizeDoi } from "@/lib/research/references/doi";

export type CrossrefClient = {
  lookupDoi: (doi: string) => Promise<CanonicalWork | undefined>;
  searchBibliographic: (query: string) => Promise<CanonicalWork[]>;
};

const REQUEST_TIMEOUT_MS = 8000;

type CrossrefMessage = {
  DOI?: string;
  URL?: string;
  title?: string[];
  author?: Array<{ family?: string; given?: string }>;
  issued?: { "date-parts"?: number[][] };
  "container-title"?: string[];
  volume?: string;
  issue?: string;
  page?: string;
  abstract?: string;
};

function politeHeaders(email: string): HeadersInit {
  return {
    Accept: "application/json",
    "User-Agent": `YuzzyVisaSupport/1.0 (mailto:${email})`,
  };
}

function mapWork(message: CrossrefMessage): CanonicalWork | undefined {
  const title = message.title?.[0]?.trim();
  if (!title) {
    return undefined;
  }
  const year = message.issued?.["date-parts"]?.[0]?.[0];
  return {
    title,
    authors: (message.author ?? [])
      .map((author) => [author.given, author.family].filter(Boolean).join(" ").trim())
      .filter(Boolean),
    year: typeof year === "number" ? year : undefined,
    journal: message["container-title"]?.[0],
    volume: message.volume,
    issue: message.issue,
    pages: message.page,
    doi: message.DOI ? normalizeDoi(message.DOI) : undefined,
    url: message.URL,
    abstract: message.abstract?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    provider: "crossref",
    providerId: message.DOI,
  };
}

export function createCrossrefClient(input: {
  email: string;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}): CrossrefClient {
  const fetchImpl = input.fetchImpl ?? fetch;
  const baseUrl = input.baseUrl ?? "https://api.crossref.org";

  async function getJson(path: string): Promise<unknown> {
    const response = await fetchImpl(`${baseUrl}${path}`, {
      headers: politeHeaders(input.email),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (response.status === 404) {
      return undefined;
    }
    if (!response.ok) {
      throw new Error(`Crossref request failed (${response.status})`);
    }
    return response.json();
  }

  return {
    async lookupDoi(doi) {
      const normalized = normalizeDoi(doi);
      if (!normalized) {
        return undefined;
      }
      const json = (await getJson(`/works/${encodeURIComponent(normalized)}`)) as
        | { message?: CrossrefMessage }
        | undefined;
      return json?.message ? mapWork(json.message) : undefined;
    },
    async searchBibliographic(query) {
      const trimmed = query.trim();
      if (trimmed.length < 8) {
        return [];
      }
      const json = (await getJson(
        `/works?query.bibliographic=${encodeURIComponent(trimmed)}&rows=5`,
      )) as { message?: { items?: CrossrefMessage[] } } | undefined;
      return (json?.message?.items ?? [])
        .map((item) => mapWork(item))
        .filter((item): item is CanonicalWork => Boolean(item));
    },
  };
}
