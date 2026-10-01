import "server-only";

import { parseCheckoutConfig } from "@/lib/config/research";
import { parseResearchProductConfig } from "@/lib/config/research-product";
import {
  ACCESS_COOKIE,
  accessCookieOptions,
  accessTokensMatch,
} from "@/lib/research/auth/accessToken";
import { buildDocx } from "@/lib/research/export/docx";
import { buildNormalizedExport } from "@/lib/research/export/model";
import { buildPdf } from "@/lib/research/export/pdf";
import {
  ResearchApiError,
  createRequestId,
  researchErrorBody,
} from "@/lib/research/http/errors";
import { consumeResearchRateLimit } from "@/lib/research/http/rateLimit";
import { researchLog } from "@/lib/research/http/log";
import { createMongoOrderStore, type OrderStore } from "@/lib/research/orders/store";
import { getResearchValidationSchemas } from "@/lib/validation/research";

export async function handleExportPaper(input: {
  paperPublicId: string;
  format: string;
  token?: string;
  cookieToken?: string;
  env?: Record<string, string | undefined>;
  store?: OrderStore;
  secureCookie?: boolean;
}): Promise<{
  status: number;
  body?: unknown;
  bytes?: Buffer;
  contentType?: string;
  filename?: string;
  cookie?: { name: string; value: string; options: ReturnType<typeof accessCookieOptions> };
}> {
  const requestId = createRequestId();
  const env = input.env ?? process.env;
  const started = Date.now();
  try {
    const parsed = getResearchValidationSchemas(
      parseResearchProductConfig(env),
    ).exportQuery.safeParse({ format: input.format });
    if (!parsed.success) {
      throw new ResearchApiError({
        code: "VALIDATION_FAILED",
        message: "Export format must be docx or pdf.",
        requestId,
      });
    }
    const checkout = parseCheckoutConfig(env);
    const store = input.store ?? createMongoOrderStore();
    const paper = await store.findPaperByPublicId(input.paperPublicId);
    const presented = input.token || input.cookieToken;
    if (
      !paper ||
      !accessTokensMatch(presented, paper.accessTokenHash, checkout.recoveryTokenPepper)
    ) {
      throw new ResearchApiError({
        code: "ACCESS_DENIED",
        message: "This paper link is not valid.",
        requestId,
      });
    }
    if (
      !(await consumeResearchRateLimit({
        bucket: "export",
        paperId: paper.publicId,
      }))
    ) {
      throw new ResearchApiError({
        code: "RATE_LIMITED",
        message: "Too many export requests. Try again shortly.",
        requestId,
      });
    }
    if (paper.status !== "completed") {
      throw new ResearchApiError({
        code: "VALIDATION_FAILED",
        message: "Export is available after the draft is complete.",
        requestId,
      });
    }
    const model = buildNormalizedExport(paper);
    const bytes =
      parsed.data.format === "pdf" ? await buildPdf(model) : await buildDocx(model);
    const contentType =
      parsed.data.format === "pdf"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    const cookie = presented
      ? {
          name: ACCESS_COOKIE,
          value: presented,
          options: accessCookieOptions(input.secureCookie ?? false),
        }
      : undefined;
    return {
      status: 200,
      bytes,
      contentType,
      filename: `${model.filename}.${parsed.data.format}`,
      cookie,
    };
  } catch (error) {
    if (error instanceof ResearchApiError) {
      researchLog({
        requestId,
        operation: "export",
        publicPaperId: input.paperPublicId,
        status: error.status,
        durationMs: Date.now() - started,
        extra: { code: error.code, format: input.format },
      });
      return { status: error.status, body: researchErrorBody(error) };
    }
    const failed = new ResearchApiError({
      code: "VALIDATION_FAILED",
      message: "Export failed.",
      requestId,
    });
    researchLog({
      requestId,
      operation: "export",
      publicPaperId: input.paperPublicId,
      status: failed.status,
      durationMs: Date.now() - started,
      extra: { format: input.format },
    });
    return { status: failed.status, body: researchErrorBody(failed) };
  }
}
