import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { hashAccessToken } from "@/lib/research/auth/accessToken";
import { handleExportPaper } from "@/lib/research/export/http";
import { handleGenerateNext } from "@/lib/research/generation/next";
import { handleRegenerateSection } from "@/lib/research/generation/regenerate";
import { resetResolveRateLimit } from "@/lib/research/http/rateLimitStub";
import type { OrderStore } from "@/lib/research/orders/store";
import type { OrderDocument } from "@/lib/models/Order";
import type { PaperDocument } from "@/lib/models/Paper";
import { handleBachsWebhook } from "@/lib/research/payments/webhook";
import { handleReferenceResolve } from "@/lib/research/references/http";
import { createCrossrefClient } from "@/lib/research/references/crossref";
import type { LlmClient } from "@/lib/research/ai/client";
import { allocateOutline } from "@/lib/research/generation/outline";

const env = {
  MONGODB_URI: "mongodb://localhost/test",
  OPENAI_API_KEY: "sk-test",
  BACHS_API_KEY: "k",
  BACHS_WEBHOOK_SECRET: "whsec",
  BACHS_API_BASE_URL: "https://sandbox-api.bachs.io",
  APP_BASE_URL: "http://localhost:3000",
  RECOVERY_TOKEN_PEPPER: "pepper",
  CROSSREF_CONTACT_EMAIL: "ops@example.com",
};

const TOKEN = "secret-token";

const crossrefFixture = JSON.parse(
  readFileSync(
    path.join(import.meta.dirname, "../unit/fixtures/crossref-work.json"),
    "utf8",
  ),
) as unknown;

function words(count: number, cite = "[CITE:ref_01]") {
  return `${Array.from({ length: count }, () => "word").join(" ")} ${cite}`;
}

function paperStore(paper: Record<string, unknown>): OrderStore & {
  paidCalls: number;
  orders: Map<string, Record<string, unknown>>;
} {
  const papers = new Map([[String(paper.publicId), paper]]);
  const orders = new Map<string, Record<string, unknown>>();
  const events = new Set<string>();
  const store = {
    orders,
    papers,
    paidCalls: 0,
    async findByIdempotencyKey() {
      return null;
    },
    async createPaperAndOrder() {
      return { paperPublicId: "", orderPublicId: "" };
    },
    async saveCheckout() {},
    async findOrderByPublicId(publicId: string) {
      const order = orders.get(publicId);
      return order
        ? ({
            ...order,
            publicId,
            currency: String(order.currency),
            chargedAmountCents: Number(order.chargedAmountCents),
            paperPublicId: String(order.paperPublicId),
            status: order.status,
          } as never)
        : null;
    },
    async findOrderByCheckoutId() {
      return null;
    },
    async findPaperByPublicId(publicId: string) {
      return (papers.get(publicId) as unknown as PaperDocument) ?? null;
    },
    async savePaper(next: PaperDocument) {
      papers.set(next.publicId, { ...next } as unknown as Record<string, unknown>);
    },
    async findPaperForOrder(order: OrderDocument) {
      const paperId = (order as unknown as { paperPublicId?: string }).paperPublicId;
      return paperId ? ((papers.get(paperId) as unknown as PaperDocument) ?? null) : null;
    },
    async recordWebhookEvent(id: string) {
      if (events.has(id)) {
        return "duplicate" as const;
      }
      events.add(id);
      return "inserted" as const;
    },
    async markPaid(input: {
      orderPublicId: string;
      paperPublicId: string;
      transactionId: string;
    }) {
      store.paidCalls += 1;
      const order = orders.get(input.orderPublicId);
      const paper = papers.get(input.paperPublicId);
      if (order?.status === "paid") {
        return { alreadyPaid: true };
      }
      if (order) {
        order.status = "paid";
        order.transactionId = input.transactionId;
      }
      if (paper) {
        paper.status = "ready";
      }
      return { alreadyPaid: false };
    },
  };
  return store;
}

describe("mocked research integration", () => {
  beforeEach(() => {
    resetResolveRateLimit();
  });

  it("resolves a DOI through the handler using a recorded Crossref fixture", async () => {
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify(crossrefFixture)),
    );
    const client = createCrossrefClient({
      email: "ops@example.com",
      fetchImpl,
    });
    const result = await handleReferenceResolve({
      ip: "203.0.113.20",
      env,
      body: { references: [{ originalInput: "10.1038/nature12373" }] },
      resolve: async (inputs) => {
        const work = await client.lookupDoi(inputs[0]!.originalInput);
        return [
          {
            originalInput: inputs[0]!.originalInput,
            inputType: "doi",
            verificationStatus: "verified",
            contentStatus: "abstract",
            matched: work!,
            candidates: [],
          },
        ];
      },
    });
    expect(result.status).toBe(200);
    const body = result.body as { results: Array<{ verificationStatus: string; matched?: { doi?: string } }> };
    expect(body.results[0]?.verificationStatus).toBe("verified");
    expect(body.results[0]?.matched?.doi).toBe("10.1038/nature12373");
  });

  it("denies generate-next before payment", async () => {
    const store = paperStore({
      publicId: "pap_int",
      status: "awaiting_payment",
      accessTokenHash: hashAccessToken(TOKEN, "pepper"),
      references: [],
      outline: [],
      sections: [],
      generation: { completedSteps: [], attempts: 0, version: 0, bibliography: [] },
    });
    const llm: LlmClient & { calls: number } = {
      calls: 0,
      async completeJson() {
        llm.calls += 1;
        return { text: "{}", usage: { inputTokens: 0, outputTokens: 0 } };
      },
    };
    const result = await handleGenerateNext({
      paperPublicId: "pap_int",
      token: TOKEN,
      env,
      store,
      llm,
    });
    expect(result.status).toBe(422);
    expect((result.body as { code: string }).code).toBe("PAYMENT_REQUIRED");
    expect(llm.calls).toBe(0);
  });

  it("pays once for a duplicate signed webhook", async () => {
    const store = paperStore({
      publicId: "pap_1",
      status: "awaiting_payment",
    });
    store.orders.set("ord_1", {
      publicId: "ord_1",
      paperPublicId: "pap_1",
      status: "checkout_created",
      chargedAmountCents: 250000,
      currency: "NGN",
    });
    const rawBody = JSON.stringify({
      id: "evt_dup",
      type: "collection.succeeded",
      data: {
        amount: "2500.00",
        currency: "NGN",
        metadata: { orderPublicId: "ord_1" },
      },
    });
    const ts = String(Math.floor(Date.now() / 1000));
    const signature = createHmac("sha256", env.BACHS_WEBHOOK_SECRET)
      .update(`${ts}.${rawBody}`)
      .digest("hex");
    await handleBachsWebhook({ rawBody, timestamp: ts, signature, env, store });
    await handleBachsWebhook({ rawBody, timestamp: ts, signature, env, store });
    expect(store.paidCalls).toBe(2);
    expect(store.orders.get("ord_1")?.status).toBe("paid");
  });

  it("exports a completed paper buffer and enforces regenerate quota", async () => {
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
    const completed = {
      publicId: "pap_int",
      title: "Verified sources in visa-related research writing",
      paperType: "literature_review",
      citationStyle: "apa",
      requestedPages: 10,
      targetWords: 3000,
      status: "completed",
      editorVersion: 0,
      accessTokenHash: hashAccessToken(TOKEN, "pepper"),
      regeneration: { used: 0, limit: 3 },
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
      outline,
      sections: outline.map((item) => ({
        sectionId: item.sectionId,
        type: item.type,
        title: item.title,
        order: item.order,
        contentJson: {
          sectionId: item.sectionId,
          title: item.title,
          paragraphs: [{ text: words(120) }],
          usedReferenceIds: ["ref_01"],
          wordCountEstimate: 120,
        },
        plainText: "Hello (Example, 2020).",
        targetWords: item.wordBudget,
        actualWords: 120,
        citedRefIds: ["ref_01"],
        generationStatus: "complete",
      })),
      generation: {
        completedSteps: ["outline", ...outline.map((item) => item.sectionId)],
        bibliography: ["Example (2020). Climate synthesis."],
        version: 1,
      },
    };
    const store = paperStore(completed);
    const exported = await handleExportPaper({
      paperPublicId: "pap_int",
      format: "docx",
      token: TOKEN,
      env,
      store,
    });
    expect(exported.status).toBe(200);
    expect(exported.bytes?.byteLength).toBeGreaterThan(100);

    const llm: LlmClient & { calls: number } = {
      calls: 0,
      async completeJson() {
        llm.calls += 1;
        return {
          text: JSON.stringify({
            sectionId: "abstract",
            title: "Abstract",
            paragraphs: [{ text: words(90) }],
            usedReferenceIds: ["ref_01"],
            wordCountEstimate: 90,
          }),
          usage: { inputTokens: 1, outputTokens: 1 },
        };
      },
    };
    for (let i = 0; i < 3; i += 1) {
      expect(
        (
          await handleRegenerateSection({
            paperPublicId: "pap_int",
            token: TOKEN,
            env,
            store,
            llm,
            body: { sectionId: "abstract" },
          })
        ).status,
      ).toBe(200);
    }
    const blocked = await handleRegenerateSection({
      paperPublicId: "pap_int",
      token: TOKEN,
      env,
      store,
      llm,
      body: { sectionId: "abstract" },
    });
    expect(blocked.status).toBe(422);
    expect((blocked.body as { code: string }).code).toBe("REGENERATION_QUOTA_EXCEEDED");
  });
});
