import "server-only";

import {
  parseReferenceLookupConfig,
  parseUtilityLlmConfig,
} from "@/lib/config/research";
import { parseResearchProductConfig } from "@/lib/config/research-product";
import { extractConceptsWithLuna, deterministicConcepts } from "@/lib/research/discovery/concepts";
import {
  discoverAdditionalSources,
  type DiscoveredSource,
} from "@/lib/research/discovery/discover";
import {
  ResearchApiError,
  createRequestId,
  researchErrorBody,
} from "@/lib/research/http/errors";
import { consumeResearchRateLimit } from "@/lib/research/http/rateLimit";
import { createCrossrefClient } from "@/lib/research/references/crossref";
import { createOpenAlexClient } from "@/lib/research/references/openalex";
import type { CanonicalWork } from "@/lib/research/references/types";
import { createDiscoverRequestSchema } from "@/lib/validation/research";

function publicDiscovery(item: DiscoveredSource) {
  return {
    originalInput: item.originalInput,
    verificationStatus: item.verificationStatus,
    contentStatus: item.contentStatus,
    isSystemAdded: true,
    isUserKeyReference: false,
    selectedByUser: true,
    matched: {
      title: item.matched.title,
      authors: item.matched.authors,
      year: item.matched.year,
      journal: item.matched.journal,
      doi: item.matched.doi,
      url: item.matched.url,
      abstract: item.matched.abstract,
    },
  };
}

export async function handleReferenceDiscover(input: {
  ip: string;
  body: unknown;
  env?: Record<string, string | undefined>;
  extractConcepts?: typeof extractConceptsWithLuna;
  discover?: typeof discoverAdditionalSources;
}): Promise<{ status: number; body: unknown }> {
  const requestId = createRequestId();
  const env = input.env ?? process.env;
  try {
    if (!(await consumeResearchRateLimit({ bucket: "discover", ip: input.ip }))) {
      throw new ResearchApiError({
        code: "RATE_LIMITED",
        message: "Too many match requests. Try again in a few minutes.",
        requestId,
      });
    }

    const config = parseResearchProductConfig(env);
    const parsed = createDiscoverRequestSchema(config).safeParse(input.body);
    if (!parsed.success) {
      throw new ResearchApiError({
        code: "VALIDATION_FAILED",
        message: "Paper title and sources are required to find extra sources.",
        requestId,
      });
    }

    if (!parsed.data.allowAdditionalSources) {
      return { status: 200, body: { requestId, results: [] } };
    }

    const lookup = parseReferenceLookupConfig(env);
    const llm = parseUtilityLlmConfig(env);
    const extract = input.extractConcepts ?? extractConceptsWithLuna;
    const discover = input.discover ?? discoverAdditionalSources;
    const conceptInput = {
      title: parsed.data.title,
      focus: parsed.data.focus,
      confirmedTitles: parsed.data.references
        .map((item) => item.title)
        .filter((title): title is string => Boolean(title)),
      max: config.maxAdditionalSources,
    };
    // extractConceptsWithLuna posts to the OpenAI endpoint, so only use an
    // OpenAI key. When OpenAI is not configured, use deterministic concepts
    // rather than sending an OpenRouter key to OpenAI.
    const openaiProvider = llm.llm.providers.find(
      (provider) => provider.name === "openai",
    );
    const concepts =
      openaiProvider || input.extractConcepts
        ? await extract({
            ...conceptInput,
            apiKey: openaiProvider?.apiKey ?? "",
            model: openaiProvider?.utilityModel ?? llm.utilityModel,
          })
        : deterministicConcepts(conceptInput);

    const userWorks: CanonicalWork[] = parsed.data.references.map((item) => ({
      title: item.title || item.originalInput,
      authors: item.authors ?? [],
      year: item.year,
      doi: item.doi,
      provider: "crossref",
    }));

    const results = await discover({
      allowAdditionalSources: true,
      concepts,
      userWorks,
      max: config.maxAdditionalSources,
      openalex: createOpenAlexClient({
        email: lookup.crossrefContactEmail,
        apiKey: lookup.openalexApiKey,
      }),
      crossref: createCrossrefClient({ email: lookup.crossrefContactEmail }),
    });

    return {
      status: 200,
      body: { requestId, results: results.map(publicDiscovery) },
    };
  } catch (error) {
    if (
      error instanceof Error &&
      /OPENAI_API_KEY|OPENROUTER_API_KEY|LLM_API_KEY/.test(error.message)
    ) {
      const missing = new ResearchApiError({
        code: "VALIDATION_FAILED",
        message: "Server is missing an LLM API key.",
        requestId,
      });
      return { status: missing.status, body: researchErrorBody(missing) };
    }
    if (error instanceof Error && /CROSSREF_CONTACT_EMAIL/.test(error.message)) {
      const missing = new ResearchApiError({
        code: "VALIDATION_FAILED",
        message: "Server is missing CROSSREF_CONTACT_EMAIL.",
        requestId,
      });
      return { status: missing.status, body: researchErrorBody(missing) };
    }
    if (error instanceof ResearchApiError) {
      return { status: error.status, body: researchErrorBody(error) };
    }
    const failed = new ResearchApiError({
      code: "GENERATION_RETRYABLE",
      message: "Extra source search is temporarily unavailable. Try again.",
      requestId,
    });
    return { status: failed.status, body: researchErrorBody(failed) };
  }
}
