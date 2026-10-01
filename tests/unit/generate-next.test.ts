import { describe, expect, it, beforeEach } from "vitest";

import { hashAccessToken } from "@/lib/research/auth/accessToken";
import type { LlmClient } from "@/lib/research/ai/client";
import { handleGenerateNext } from "@/lib/research/generation/next";
import { allocateOutline } from "@/lib/research/generation/outline";
import { handleGetPaper } from "@/lib/research/papers/http";
import { resetResolveRateLimit } from "@/lib/research/http/rateLimitStub";
import type { OrderStore } from "@/lib/research/orders/store";
import type { PaperDocument } from "@/lib/models/Paper";

const env = {
  MONGODB_URI: "mongodb://localhost/test",
  OPENAI_API_KEY: "sk-test",
  BACHS_API_KEY: "k",
  BACHS_WEBHOOK_SECRET: "s",
  BACHS_API_BASE_URL: "https://sandbox-api.bachs.io",
  APP_BASE_URL: "http://localhost:3000",
  RECOVERY_TOKEN_PEPPER: "pepper",
};

const TOKEN = "secret-token";

function words(count: number, cite = "[CITE:ref_01]") {
  return `${Array.from({ length: count }, () => "word").join(" ")} ${cite}`;
}

function basePaper(overrides: Record<string, unknown> = {}) {
  return {
    publicId: "pap_gen",
    title: "Verified sources in visa-related research writing",
    focus: "Citation practice",
    paperType: "literature_review",
    citationStyle: "apa",
    requestedPages: 10,
    targetWords: 3000,
    status: "ready",
    accessTokenHash: hashAccessToken(TOKEN, "pepper"),
    references: [
      {
        refId: "ref_01",
        title: "Climate synthesis",
        authors: ["Ada Example"],
        year: 2020,
        verificationStatus: "verified",
        selectedByUser: true,
        contentStatus: "abstract",
        abstract: "Evidence abstract.",
      },
    ],
    outline: [],
    sections: [],
    generation: {
      completedSteps: [],
      attempts: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      version: 0,
      bibliography: [],
    },
    ...overrides,
  };
}

function memoryStore(paper: Record<string, unknown>): OrderStore {
  const papers = new Map([[String(paper.publicId), paper]]);
  return {
    async findByIdempotencyKey() {
      return null;
    },
    async createPaperAndOrder() {
      return { paperPublicId: "", orderPublicId: "" };
    },
    async saveCheckout() {},
    async findOrderByPublicId() {
      return null;
    },
    async findOrderByCheckoutId() {
      return null;
    },
    async findPaperByPublicId(publicId: string) {
      return (papers.get(publicId) as unknown as PaperDocument) ?? null;
    },
    async savePaper(next) {
      papers.set(next.publicId, { ...next } as unknown as Record<string, unknown>);
    },
    async findPaperForOrder() {
      return null;
    },
    async recordWebhookEvent() {
      return "inserted";
    },
    async markPaid() {
      return { alreadyPaid: false };
    },
  };
}

function outlineClient(): LlmClient & { calls: number } {
  const client = {
    calls: 0,
    async completeJson() {
      client.calls += 1;
      const outline = allocateOutline({
        paperType: "literature_review",
        targetWords: 3000,
        manifest: [
          {
            refId: "ref_01",
            title: "Climate synthesis",
            authors: ["Ada Example"],
            evidence: "",
            contentStatus: "abstract",
          },
        ],
      });
      return {
        text: JSON.stringify({ sections: outline }),
        usage: { inputTokens: 10, outputTokens: 20 },
      };
    },
  };
  return client;
}

function writingClient(sectionText: string): LlmClient & { calls: number } {
  const client = {
    calls: 0,
    async completeJson(input: { system: string }) {
      client.calls += 1;
      if (input.system.includes("matching the required outline")) {
        const outline = allocateOutline({
          paperType: "literature_review",
          targetWords: 3000,
          manifest: [
            {
              refId: "ref_01",
              title: "Climate synthesis",
              authors: ["Ada Example"],
              evidence: "",
              contentStatus: "abstract",
            },
          ],
        });
        return {
          text: JSON.stringify({ sections: outline }),
          usage: { inputTokens: 8, outputTokens: 8 },
        };
      }
      if (input.system.includes("Improve coherence")) {
        return {
          text: JSON.stringify({ sections: [] }),
          usage: { inputTokens: 4, outputTokens: 4 },
        };
      }
      return {
        text: JSON.stringify({
          sectionId: "abstract",
          title: "Abstract",
          paragraphs: [{ text: sectionText }],
          usedReferenceIds: ["ref_01"],
          wordCountEstimate: 120,
        }),
        usage: { inputTokens: 12, outputTokens: 40 },
      };
    },
  };
  return client;
}

describe("handleGenerateNext", () => {
  beforeEach(() => {
    resetResolveRateLimit();
  });

  it("denies unpaid papers", async () => {
    const store = memoryStore(basePaper({ status: "awaiting_payment" }));
    const llm = outlineClient();
    const result = await handleGenerateNext({
      paperPublicId: "pap_gen",
      token: TOKEN,
      env,
      store,
      llm,
    });
    expect(result.status).toBe(422);
    expect((result.body as { code: string }).code).toBe("PAYMENT_REQUIRED");
    expect(llm.calls).toBe(0);
  });

  it("creates the outline then one section per call", async () => {
    const store = memoryStore(basePaper());
    const llm = writingClient(words(120));
    const first = await handleGenerateNext({
      paperPublicId: "pap_gen",
      token: TOKEN,
      env,
      store,
      llm,
    });
    expect(first.status).toBe(200);
    const afterOutline = (await store.findPaperByPublicId("pap_gen"))!;
    expect(afterOutline.outline.length).toBeGreaterThan(1);
    expect(
      afterOutline.sections.filter((section) => section.generationStatus === "complete")
        .length,
    ).toBe(0);

    const second = await handleGenerateNext({
      paperPublicId: "pap_gen",
      token: TOKEN,
      env,
      store,
      llm,
    });
    expect(second.status).toBe(200);
    const afterSection = (await store.findPaperByPublicId("pap_gen"))!;
    expect(
      afterSection.sections.filter((section) => section.generationStatus === "complete")
        .length,
    ).toBe(1);
    expect((second.body as { stepId: string }).stepId).not.toBe("outline");
  });

  it("returns a version conflict while locked", async () => {
    const store = memoryStore(
      basePaper({
        generation: {
          completedSteps: [],
          lockUntil: new Date(Date.now() + 60_000),
          attempts: 1,
          version: 0,
        },
      }),
    );
    const llm = outlineClient();
    const result = await handleGenerateNext({
      paperPublicId: "pap_gen",
      token: TOKEN,
      env,
      store,
      llm,
      now: new Date(),
    });
    expect(result.status).toBe(409);
    expect((result.body as { code: string }).code).toBe("VERSION_CONFLICT");
    expect(llm.calls).toBe(0);
  });

  it("replays a completed step without calling OpenAI", async () => {
    const outline = allocateOutline({
      paperType: "literature_review",
      targetWords: 3000,
      manifest: [
        {
          refId: "ref_01",
          title: "Climate synthesis",
          authors: ["Ada Example"],
          evidence: "",
          contentStatus: "abstract",
        },
      ],
    });
    const store = memoryStore(
      basePaper({
        outline,
        sections: outline.map((item) => ({
          sectionId: item.sectionId,
          type: item.type,
          title: item.title,
          order: item.order,
          plainText: item.sectionId === "abstract" ? "Saved abstract [CITE:ref_01]" : "",
          targetWords: item.wordBudget,
          actualWords: 0,
          citedRefIds: [],
          generationStatus: item.sectionId === "abstract" ? "pending" : "pending",
        })),
        generation: {
          completedSteps: ["outline", "abstract"],
          attempts: 1,
          version: 1,
          bibliography: [],
        },
      }),
    );
    const llm = outlineClient();
    const result = await handleGenerateNext({
      paperPublicId: "pap_gen",
      token: TOKEN,
      env,
      store,
      llm,
    });
    expect(result.status).toBe(200);
    expect((result.body as { replayed: boolean }).replayed).toBe(true);
    expect(llm.calls).toBe(0);
  });

  it("does not persist invalid citations after one repair", async () => {
    const outline = allocateOutline({
      paperType: "literature_review",
      targetWords: 3000,
      manifest: [
        {
          refId: "ref_01",
          title: "Climate synthesis",
          authors: ["Ada Example"],
          evidence: "",
          contentStatus: "abstract",
        },
      ],
    });
    const store = memoryStore(
      basePaper({
        outline,
        sections: outline.map((item) => ({
          sectionId: item.sectionId,
          type: item.type,
          title: item.title,
          order: item.order,
          plainText: "",
          targetWords: item.wordBudget,
          actualWords: 0,
          citedRefIds: [],
          generationStatus: "pending",
        })),
        generation: {
          completedSteps: ["outline"],
          attempts: 1,
          version: 1,
          bibliography: [],
        },
      }),
    );
    const llm: LlmClient & { calls: number } = {
      calls: 0,
      async completeJson() {
        llm.calls += 1;
        return {
          text: JSON.stringify({
            sectionId: "abstract",
            title: "Abstract",
            paragraphs: [{ text: `${words(120, "[CITE:ref_99]")}` }],
            usedReferenceIds: ["ref_99"],
            wordCountEstimate: 120,
          }),
          usage: { inputTokens: 1, outputTokens: 1 },
        };
      },
    };
    const result = await handleGenerateNext({
      paperPublicId: "pap_gen",
      token: TOKEN,
      env,
      store,
      llm,
    });
    expect(result.status).toBe(422);
    expect((result.body as { code: string }).code).toBe("GENERATION_INVALID_OUTPUT");
    const paper = (await store.findPaperByPublicId("pap_gen"))!;
    expect(paper.sections[0]?.plainText).toBe("");
    expect(paper.sections[0]?.generationStatus).toBe("pending");
    expect(llm.calls).toBe(2);
  });

  it("accepts a section whose only issue is an uncited empirical sentence", async () => {
    const outline = allocateOutline({
      paperType: "literature_review",
      targetWords: 3000,
      manifest: [
        {
          refId: "ref_01",
          title: "Climate synthesis",
          authors: ["Ada Example"],
          evidence: "",
          contentStatus: "abstract",
        },
      ],
    });
    const store = memoryStore(
      basePaper({
        outline,
        sections: outline.map((item) => ({
          sectionId: item.sectionId,
          type: item.type,
          title: item.title,
          order: item.order,
          plainText: "",
          targetWords: item.wordBudget,
          actualWords: 0,
          citedRefIds: [],
          generationStatus: "pending",
        })),
        generation: {
          completedSteps: ["outline"],
          attempts: 1,
          version: 1,
          bibliography: [],
        },
      }),
    );
    const llm: LlmClient & { calls: number } = {
      calls: 0,
      async completeJson() {
        llm.calls += 1;
        return {
          text: JSON.stringify({
            sectionId: "abstract",
            title: "Abstract",
            paragraphs: [
              {
                text: `${words(120, "")} The sample size was 500 participants across sites.`,
              },
            ],
            usedReferenceIds: [],
            wordCountEstimate: 120,
          }),
          usage: { inputTokens: 1, outputTokens: 1 },
        };
      },
    };
    const result = await handleGenerateNext({
      paperPublicId: "pap_gen",
      token: TOKEN,
      env,
      store,
      llm,
    });
    expect(result.status).toBe(200);
    const paper = (await store.findPaperByPublicId("pap_gen"))!;
    expect(paper.sections[0]?.generationStatus).toBe("complete");
    expect(paper.sections[0]?.validationWarnings?.length ?? 0).toBeGreaterThan(0);
  });
});

describe("handleGetPaper projection", () => {
  it("returns generation fields without the access token hash", async () => {
    const store = memoryStore(basePaper({ status: "ready" }));
    const result = await handleGetPaper({
      paperPublicId: "pap_gen",
      token: TOKEN,
      env,
      store,
    });
    expect(result.status).toBe(200);
    const serialized = JSON.stringify(result.body);
    expect(serialized).not.toContain("accessTokenHash");
    expect(result.body).toMatchObject({
      publicId: "pap_gen",
      status: "ready",
    });
    expect(result.body).toHaveProperty("outline");
    expect(result.body).toHaveProperty("sections");
    expect(result.body).toHaveProperty("generation");
  });
});
