import "server-only";

import { parseReferenceLookupConfig } from "@/lib/config/research";
import { parseResearchProductConfig } from "@/lib/config/research-product";
import { createCrossrefClient } from "@/lib/research/references/crossref";
import { createOpenAlexClient } from "@/lib/research/references/openalex";
import {
  resolveReferences,
  type ResolvedReference,
} from "@/lib/research/references/resolve";
import {
  ResearchApiError,
  createRequestId,
  researchErrorBody,
} from "@/lib/research/http/errors";
import { consumeResearchRateLimit } from "@/lib/research/http/rateLimit";
import { researchLog } from "@/lib/research/http/log";
import { createResolveRequestSchema } from "@/lib/validation/research";
import { SsrfBlockedError } from "@/lib/research/security/safe-fetch";

export type ResolveHandler = (input: {
  ip: string;
  body: unknown;
  env?: Record<string, string | undefined>;
  resolve?: typeof resolveReferences;
}) => Promise<{ status: number; body: unknown }>;

function publicResult(result: ResolvedReference) {
  return {
    id: result.id,
    originalInput: result.originalInput,
    inputType: result.inputType,
    verificationStatus: result.verificationStatus,
    contentStatus: result.contentStatus,
    matched: result.matched
      ? {
          title: result.matched.title,
          authors: result.matched.authors,
          year: result.matched.year,
          journal: result.matched.journal,
          doi: result.matched.doi,
          url: result.matched.url,
        }
      : undefined,
    candidates: result.candidates.map((candidate) => ({
      title: candidate.title,
      authors: candidate.authors,
      year: candidate.year,
      journal: candidate.journal,
      doi: candidate.doi,
    })),
  };
}

export const handleReferenceResolve: ResolveHandler = async ({
  ip,
  body,
  env,
  resolve = resolveReferences,
}) => {
  const requestId = createRequestId();
  const started = Date.now();
  try {
    if (!(await consumeResearchRateLimit({ bucket: "resolve", ip }))) {
      throw new ResearchApiError({
        code: "RATE_LIMITED",
        message: "Too many match requests. Try again in a few minutes.",
        requestId,
      });
    }

    const parsed = createResolveRequestSchema(
      parseResearchProductConfig(env),
    ).safeParse(body);
    if (!parsed.success) {
      throw new ResearchApiError({
        code: "VALIDATION_FAILED",
        message: "Add at least one complete source (DOI, URL, or citation).",
        requestId,
        details: { issues: parsed.error.issues.map((issue) => issue.message) },
      });
    }

    const lookup = parseReferenceLookupConfig(env ?? process.env);
    const results = await resolve(parsed.data.references, {
      crossref: createCrossrefClient({ email: lookup.crossrefContactEmail }),
      openalex: createOpenAlexClient({
        email: lookup.crossrefContactEmail,
        apiKey: lookup.openalexApiKey,
      }),
    });

    researchLog({
      requestId,
      operation: "references-resolve",
      status: 200,
      durationMs: Date.now() - started,
      extra: {
        matchedCount: results.filter((item) => item.verificationStatus === "verified")
          .length,
      },
    });

    return {
      status: 200,
      body: {
        requestId,
        results: results.map(publicResult),
      },
    };
  } catch (error) {
    if (error instanceof Error && /CROSSREF_CONTACT_EMAIL/.test(error.message)) {
      const missing = new ResearchApiError({
        code: "VALIDATION_FAILED",
        message: "Server is missing CROSSREF_CONTACT_EMAIL.",
        requestId,
      });
      return { status: missing.status, body: researchErrorBody(missing) };
    }
    if (error instanceof SsrfBlockedError) {
      const blocked = new ResearchApiError({
        code: "SSRF_BLOCKED",
        message: error.message,
        requestId,
      });
      return { status: blocked.status, body: researchErrorBody(blocked) };
    }
    if (error instanceof ResearchApiError) {
      return { status: error.status, body: researchErrorBody(error) };
    }
    const failed = new ResearchApiError({
      code: "GENERATION_RETRYABLE",
      message: "Matching is temporarily unavailable. Try again.",
      requestId,
    });
    return { status: failed.status, body: researchErrorBody(failed) };
  }
};
