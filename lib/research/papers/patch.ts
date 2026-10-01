import "server-only";

import type { CitationStyleId } from "@/lib/config/research-product";
import { parseCheckoutConfig } from "@/lib/config/research";
import type { SectionJson } from "@/lib/research/ai/schemas";
import {
  ACCESS_COOKIE,
  accessCookieOptions,
  accessTokensMatch,
} from "@/lib/research/auth/accessToken";
import {
  tiptapDocToSections,
  type TiptapDoc,
  validateTiptapDoc,
} from "@/lib/research/editor/document";
import {
  applyPaperBibliography,
  applyRenderedPaper,
  paperManifest,
} from "@/lib/research/generation/apply";
import {
  ResearchApiError,
  createRequestId,
  researchErrorBody,
} from "@/lib/research/http/errors";
import { consumeResearchRateLimit } from "@/lib/research/http/rateLimit";
import { createMongoOrderStore, type OrderStore } from "@/lib/research/orders/store";
import { isTiptapDoc, publicPaperProjection } from "@/lib/research/papers/public";
import { getResearchValidationSchemas } from "@/lib/validation/research";
import { parseResearchProductConfig } from "@/lib/config/research-product";

export async function handlePatchPaper(input: {
  paperPublicId: string;
  token?: string;
  cookieToken?: string;
  body: unknown;
  env?: Record<string, string | undefined>;
  store?: OrderStore;
  secureCookie?: boolean;
}): Promise<{
  status: number;
  body: unknown;
  cookie?: { name: string; value: string; options: ReturnType<typeof accessCookieOptions> };
}> {
  const requestId = createRequestId();
  const env = input.env ?? process.env;
  try {
    const parsed = getResearchValidationSchemas(
      parseResearchProductConfig(env),
    ).paperPatch.safeParse(input.body);
    if (!parsed.success) {
      throw new ResearchApiError({
        code: "VALIDATION_FAILED",
        message: "Invalid editor payload.",
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
        bucket: "patch",
        paperId: paper.publicId,
      }))
    ) {
      throw new ResearchApiError({
        code: "RATE_LIMITED",
        message: "Too many save requests. Try again shortly.",
        requestId,
      });
    }
    if (paper.status === "awaiting_payment" || paper.status === "draft") {
      throw new ResearchApiError({
        code: "PAYMENT_REQUIRED",
        message: "Payment is required before the editor can save.",
        requestId,
      });
    }
    if ((paper.editorVersion ?? 0) !== parsed.data.editorVersion) {
      throw new ResearchApiError({
        code: "VERSION_CONFLICT",
        message: "This draft was saved from another tab. Reload to continue.",
        requestId,
      });
    }

    if (parsed.data.title) {
      paper.title = parsed.data.title;
    }
    if (parsed.data.citationStyle) {
      paper.citationStyle = parsed.data.citationStyle;
    }

    const manifest = paperManifest(paper);
    if (isTiptapDoc(parsed.data.contentJson)) {
      const validation = validateTiptapDoc(
        parsed.data.contentJson as TiptapDoc,
        new Set(manifest.map((source) => source.refId)),
      );
      if (!validation.ok) {
        throw new ResearchApiError({
          code: "VALIDATION_FAILED",
          message: validation.message,
          requestId,
        });
      }
      paper.editorDocument = parsed.data.contentJson;
      const mapped = tiptapDocToSections(
        parsed.data.contentJson as TiptapDoc,
        paper.sections.map((section) => ({
          sectionId: section.sectionId,
          title: section.title,
        })),
      );
      for (const next of mapped) {
        const index = paper.sections.findIndex(
          (section) => section.sectionId === next.sectionId,
        );
        if (index < 0) {
          continue;
        }
        const json: SectionJson = {
          sectionId: next.sectionId,
          title: next.title,
          paragraphs: next.paragraphs,
          usedReferenceIds: [],
          wordCountEstimate: next.paragraphs
            .map((paragraph) => paragraph.text)
            .join(" ")
            .split(/\s+/)
            .filter(Boolean).length,
        };
        const section = paper.sections[index];
        section.contentJson = json;
        section.title = next.title;
        section.lastEditedAt = new Date();
      }
    }

    try {
      applyRenderedPaper(paper, manifest);
    } catch {
      throw new ResearchApiError({
        code: "VALIDATION_FAILED",
        message: "Citations in the editor must use allowed reference ids.",
        requestId,
      });
    }

    applyPaperBibliography(paper, manifest);
    paper.editorVersion = (paper.editorVersion ?? 0) + 1;
    paper.citationStyle = paper.citationStyle as CitationStyleId;
    const saved = store.savePaperIfEditorVersion
      ? await store.savePaperIfEditorVersion(paper, parsed.data.editorVersion)
      : (await store.savePaper(paper), paper);
    if (!saved) {
      throw new ResearchApiError({
        code: "VERSION_CONFLICT",
        message: "This draft was saved from another tab. Reload to continue.",
        requestId,
      });
    }

    const cookie = presented
      ? {
          name: ACCESS_COOKIE,
          value: presented,
          options: accessCookieOptions(input.secureCookie ?? false),
        }
      : undefined;
    return { status: 200, body: publicPaperProjection(saved, requestId), cookie };
  } catch (error) {
    if (error instanceof ResearchApiError) {
      return { status: error.status, body: researchErrorBody(error) };
    }
    const failed = new ResearchApiError({
      code: "VALIDATION_FAILED",
      message: "Could not save this draft.",
      requestId,
    });
    return { status: failed.status, body: researchErrorBody(failed) };
  }
}
