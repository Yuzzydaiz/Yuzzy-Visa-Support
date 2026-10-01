import { afterEach, describe, expect, it, vi } from "vitest";

import { handleReferenceResolve } from "@/lib/research/references/http";
import {
  consumeResearchRateLimit,
  resetResearchRateLimit,
} from "@/lib/research/http/rateLimit";
import {
  recordTokenUsage,
  resetResearchTokenTotals,
  sanitizeResearchLogExtra,
} from "@/lib/research/http/log";
import type { ResolvedReference } from "@/lib/research/references/resolve";

const env = { CROSSREF_CONTACT_EMAIL: "ops@example.com" };

const verified: ResolvedReference = {
  originalInput: "10.1038/nature12373",
  inputType: "doi",
  verificationStatus: "verified",
  contentStatus: "abstract",
  matched: {
    title: "A fake but stable climate meta analysis",
    authors: ["Ada Example"],
    year: 2020,
    doi: "10.1038/nature12373",
    provider: "crossref",
  },
  candidates: [],
};

describe("research rate limits", () => {
  afterEach(() => {
    resetResearchRateLimit();
  });

  it("returns 429 on the 31st resolve from the same IP", async () => {
    const resolve = async () => [verified];
    for (let i = 0; i < 30; i += 1) {
      const result = await handleReferenceResolve({
        ip: "203.0.113.40",
        env,
        body: { references: [{ originalInput: "10.1038/nature12373" }] },
        resolve,
      });
      expect(result.status).toBe(200);
    }
    const blocked = await handleReferenceResolve({
      ip: "203.0.113.40",
      env,
      body: { references: [{ originalInput: "10.1038/nature12373" }] },
      resolve,
    });
    expect(blocked.status).toBe(429);
    expect((blocked.body as { code: string }).code).toBe("RATE_LIMITED");
  });

  it("tracks generate-next paper buckets separately from IP", async () => {
    expect(
      await consumeResearchRateLimit({
        bucket: "generate-next",
        paperId: "pap_a",
      }),
    ).toBe(true);
  });
});

describe("researchLog sanitization", () => {
  afterEach(() => {
    resetResearchTokenTotals();
    vi.restoreAllMocks();
  });

  it("strips tokens and hashes from extra fields", () => {
    expect(
      sanitizeResearchLogExtra({
        token: "secret",
        accessTokenHash: "hash",
        stepId: "outline",
        abstract: "should not appear",
      }),
    ).toEqual({ stepId: "outline" });
  });

  it("emits a daily token warn once", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    recordTokenUsage(
      { inputTokens: 6, outputTokens: 6 },
      { RESEARCH_DAILY_TOKEN_WARN: "10" },
    );
    expect(info).toHaveBeenCalledTimes(1);
    recordTokenUsage(
      { inputTokens: 1, outputTokens: 1 },
      { RESEARCH_DAILY_TOKEN_WARN: "10" },
    );
    expect(info).toHaveBeenCalledTimes(1);
  });
});
