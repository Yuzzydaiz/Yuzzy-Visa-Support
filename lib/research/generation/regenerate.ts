import "server-only";

import { randomUUID } from "node:crypto";

import {
  generationLeaseMs,
  parseCheckoutConfig,
  parseLlmTimeouts,
  parseWritingLlmConfig,
} from "@/lib/config/research";
import { parseResearchProductConfig } from "@/lib/config/research-product";
import { createLlmClientFromConfig, type LlmClient } from "@/lib/research/ai/client";
import { ACCESS_COOKIE, accessCookieOptions, accessTokensMatch } from "@/lib/research/auth/accessToken";
import { collectCitedIds } from "@/lib/research/citations/tokens";
import {
  allowedIds,
  applyPaperBibliography,
  applyRenderedPaper,
  ensureGenerationState,
  paperManifest,
} from "@/lib/research/generation/apply";
import { generateSectionJson } from "@/lib/research/generation/next";
import { joinedSectionText } from "@/lib/research/generation/validate";
import {
  replaceSectionInTiptapDoc,
  sectionsToTiptapDoc,
  type TiptapDoc,
} from "@/lib/research/editor/document";
import type { SectionJson } from "@/lib/research/ai/schemas";
import { consumeResearchRateLimit } from "@/lib/research/http/rateLimit";
import { recordTokenUsage, researchLog } from "@/lib/research/http/log";
import {
  ResearchApiError,
  createRequestId,
  researchErrorBody,
} from "@/lib/research/http/errors";
import { createMongoOrderStore, type OrderStore } from "@/lib/research/orders/store";
import { publicPaperProjection } from "@/lib/research/papers/public";
import { getResearchValidationSchemas } from "@/lib/validation/research";

function buildEditorDocument(
  paper: {
    editorDocument?: unknown;
    sections: Array<{
      sectionId: string;
      title: string;
      contentJson?: unknown;
      plainText?: string;
    }>;
  },
  sectionJson: SectionJson,
): TiptapDoc {
  const current = paper.editorDocument as TiptapDoc | undefined;
  if (current && current.type === "doc") {
    return replaceSectionInTiptapDoc(
      current,
      sectionJson.sectionId,
      sectionJson.paragraphs.map((paragraph) => paragraph.text),
    );
  }
  return sectionsToTiptapDoc(
    paper.sections.map((section) => ({
      sectionId: section.sectionId,
      title: section.title,
      paragraphs: (section.contentJson as SectionJson | undefined)?.paragraphs,
      plainText: section.plainText,
    })),
  );
}

export async function handleRegenerateSection(input: {
  paperPublicId: string;
  token?: string;
  cookieToken?: string;
  body: unknown;
  ip?: string;
  env?: Record<string, string | undefined>;
  store?: OrderStore;
  llm?: LlmClient;
  secureCookie?: boolean;
}): Promise<{
  status: number;
  body: unknown;
  cookie?: { name: string; value: string; options: ReturnType<typeof accessCookieOptions> };
}> {
  const requestId = createRequestId();
  const env = input.env ?? process.env;
  const started = Date.now();
  try {
    if (!(await consumeResearchRateLimit({ bucket: "regenerate", ip: input.ip ?? "unknown" }))) {
      throw new ResearchApiError({
        code: "RATE_LIMITED",
        message: "Too many requests. Try again shortly.",
        requestId,
      });
    }
    const parsed = getResearchValidationSchemas(
      parseResearchProductConfig(env),
    ).regenerate.safeParse(input.body);
    if (!parsed.success) {
      throw new ResearchApiError({
        code: "VALIDATION_FAILED",
        message: "Invalid regenerate request.",
        requestId,
      });
    }
    const checkout = parseCheckoutConfig(env);
    const store = input.store ?? createMongoOrderStore();
    let paper = await store.findPaperByPublicId(input.paperPublicId);
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
        bucket: "regenerate",
        paperId: paper.publicId,
      }))
    ) {
      throw new ResearchApiError({
        code: "RATE_LIMITED",
        message: "Too many requests. Try again shortly.",
        requestId,
      });
    }
    if (paper.status === "awaiting_payment" || paper.status === "draft") {
      throw new ResearchApiError({
        code: "PAYMENT_REQUIRED",
        message: "Payment is required before a section can be regenerated.",
        requestId,
      });
    }
    const used = paper.regeneration?.used ?? 0;
    const limit = paper.regeneration?.limit ?? 3;
    if (used >= limit) {
      throw new ResearchApiError({
        code: "REGENERATION_QUOTA_EXCEEDED",
        message: "No regenerations remain for this paper.",
        requestId,
      });
    }
    const sectionIndex = paper.sections.findIndex(
      (section) => section.sectionId === parsed.data.sectionId,
    );
    const outlineItem = paper.outline.find(
      (item) => item.sectionId === parsed.data.sectionId,
    );
    if (sectionIndex < 0 || !outlineItem) {
      throw new ResearchApiError({
        code: "VALIDATION_FAILED",
        message: "Unknown section.",
        requestId,
      });
    }
    const previous = paper.sections[sectionIndex];
    const manifest = paperManifest(paper);
    const allowed = allowedIds(manifest);
    const previousIds = new Set([
      ...(previous.citedRefIds ?? []),
      ...(outlineItem.plannedRefIds ?? []),
    ]);
    const citeAllow = new Set(
      [...allowed].filter((id) => previousIds.has(id) || previousIds.size === 0),
    );
    if (citeAllow.size === 0) {
      for (const id of allowed) {
        citeAllow.add(id);
      }
    }

    const cookie = presented
      ? {
          name: ACCESS_COOKIE,
          value: presented,
          options: accessCookieOptions(input.secureCookie ?? false),
        }
      : undefined;

    const writing = parseWritingLlmConfig(env);
    const timeouts = parseLlmTimeouts(env);
    const client = input.llm ?? createLlmClientFromConfig(writing.llm);
    const argumentsForPrompt = [
      ...(outlineItem.arguments ?? []),
      parsed.data.instruction ? `User instruction: ${parsed.data.instruction}` : "",
    ].filter(Boolean);

    let claimOwner: string | undefined;
    try {
      const owner = randomUUID();
      claimOwner = owner;
      const now = new Date();
      const leaseMs = generationLeaseMs(timeouts);
      if (store.claimRegeneration) {
        const claimed = await store.claimRegeneration({
          paperPublicId: paper.publicId,
          sectionId: parsed.data.sectionId,
          owner,
          lockUntil: new Date(now.getTime() + leaseMs),
          now,
        });
        if (!claimed) {
          throw new ResearchApiError({
            code: "VERSION_CONFLICT",
            message: "Another save or regeneration is already in progress.",
            requestId,
          });
        }
        const claimedPaper = await store.findPaperByPublicId(paper.publicId);
        if (claimedPaper) {
          paper = claimedPaper;
        }
      }
      const generation = ensureGenerationState(paper);
      generation.lockOwner = owner;
      generation.lockUntil = new Date(now.getTime() + leaseMs);
      generation.currentStep = `regenerate:${parsed.data.sectionId}`;
      const usageBefore = {
        inputTokens: generation.totalInputTokens ?? 0,
        outputTokens: generation.totalOutputTokens ?? 0,
      };

      const { section: sectionJson, softIssues } = await generateSectionJson({
        paper,
        outlineItem: {
          sectionId: outlineItem.sectionId,
          type: outlineItem.type,
          title: outlineItem.title,
          order: outlineItem.order,
          arguments: argumentsForPrompt,
          wordBudget: outlineItem.wordBudget,
          plannedRefIds: [...citeAllow],
        },
        manifest,
        client,
        writingModel: writing.writingModel,
        utilityModel: writing.utilityModel,
        writingTimeoutMs: timeouts.writingMs,
        utilityTimeoutMs: timeouts.utilityMs,
        citeAllow,
      });
      const tokenText = joinedSectionText(sectionJson);
      const cited = collectCitedIds(tokenText);
      if (cited.some((id) => !citeAllow.has(id))) {
        throw new ResearchApiError({
          code: "GENERATION_INVALID_OUTPUT",
          message: "Regeneration introduced new citation ids.",
          requestId,
        });
      }
      paper.sections[sectionIndex].contentJson = sectionJson;
      paper.sections[sectionIndex].validationWarnings = softIssues;
      applyRenderedPaper(paper, manifest);
      applyPaperBibliography(paper, manifest);
      paper.editorDocument = buildEditorDocument(paper, sectionJson);
      paper.regeneration = {
        used: used + 1,
        limit,
      };
      paper.editorVersion = (paper.editorVersion ?? 0) + 1;
      generation.lockOwner = undefined;
      generation.lockUntil = undefined;
      const saved = store.savePaperIfRegenerationOwner
        ? await store.savePaperIfRegenerationOwner(paper, owner)
        : (await store.savePaper(paper), paper);
      if (!saved) {
        throw new ResearchApiError({
          code: "VERSION_CONFLICT",
          message: "Regeneration ownership expired before saving.",
          requestId,
        });
      }
      paper = saved;
      const savedGeneration = ensureGenerationState(paper);
      recordTokenUsage({
        inputTokens: (savedGeneration.totalInputTokens ?? 0) - usageBefore.inputTokens,
        outputTokens: (savedGeneration.totalOutputTokens ?? 0) - usageBefore.outputTokens,
      });
      researchLog({
        requestId,
        operation: "regenerate",
        publicPaperId: paper.publicId,
        status: 200,
        durationMs: Date.now() - started,
        extra: { stepId: parsed.data.sectionId },
      });
      return {
        status: 200,
        body: publicPaperProjection(paper, requestId),
        cookie,
      };
    } catch (error) {
      if (claimOwner && store.releaseGeneration) {
        await store.releaseGeneration({
          paperPublicId: paper.publicId,
          owner: claimOwner,
          lastError: error instanceof Error ? error.message : "Regeneration failed",
        });
      }
      if (error instanceof ResearchApiError) {
        return { status: error.status, body: researchErrorBody(error), cookie };
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof ResearchApiError) {
      researchLog({
        requestId,
        operation: "regenerate",
        publicPaperId: input.paperPublicId,
        status: error.status,
        durationMs: Date.now() - started,
        extra: { code: error.code },
      });
      return { status: error.status, body: researchErrorBody(error) };
    }
    const failed = new ResearchApiError({
      code: "GENERATION_INVALID_OUTPUT",
      message: error instanceof Error ? error.message : "Regeneration failed",
      requestId,
    });
    return { status: failed.status, body: researchErrorBody(failed) };
  }
}
