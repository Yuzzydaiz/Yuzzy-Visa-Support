import { describe, expect, it, beforeEach } from "vitest";

import { hashAccessToken } from "@/lib/research/auth/accessToken";
import { handleCreateOrder } from "@/lib/research/orders/http";
import { handleGetPaper } from "@/lib/research/papers/http";
import { handleBachsWebhook, verifyBachsSignature } from "@/lib/research/payments/webhook";
import { resetResolveRateLimit } from "@/lib/research/http/rateLimitStub";
import type { OrderStore } from "@/lib/research/orders/store";
import type { OrderDocument } from "@/lib/models/Order";
import type { PaperDocument } from "@/lib/models/Paper";
import { createHmac } from "node:crypto";

const env = {
  MONGODB_URI: "mongodb://localhost/test",
  BACHS_API_KEY: "sk_sandbox_test",
  BACHS_WEBHOOK_SECRET: "whsec",
  BACHS_API_BASE_URL: "https://sandbox-api.bachs.io",
  APP_BASE_URL: "http://localhost:3000",
  RECOVERY_TOKEN_PEPPER: "pepper",
};

const paperFields = {
  title: "Verified sources in visa-related research writing",
  paperType: "literature_review" as const,
  authors: [{ name: "Ada Example", affiliation: "Example University" }],
  citationStyle: "apa" as const,
  requestedPages: 10,
  allowAdditionalSources: false,
  customerEmail: "buyer@example.com",
};

const verifiedRef = {
  originalInput: "10.1038/nature12373",
  verificationStatus: "verified" as const,
  contentStatus: "abstract" as const,
  matched: {
    title: "A fake but stable climate meta analysis",
    authors: ["Ada Example"],
    year: 2020,
    doi: "10.1038/nature12373",
  },
};

function memoryStore(): OrderStore & {
  orders: Map<string, Record<string, unknown>>;
  papers: Map<string, Record<string, unknown>>;
  events: Set<string>;
  paidCalls: number;
} {
  const orders = new Map<string, Record<string, unknown>>();
  const papers = new Map<string, Record<string, unknown>>();
  const events = new Set<string>();
  const store = {
    orders,
    papers,
    events,
    paidCalls: 0,
    async findByIdempotencyKey(key: string) {
      for (const order of orders.values()) {
        if (order.idempotencyKey === key) {
          const paper = papers.get(String(order.paperPublicId));
          return {
            orderPublicId: String(order.publicId),
            paperPublicId: String(paper?.publicId),
            checkoutSessionId: order.checkoutSessionId as string | undefined,
            checkoutUrl: order.checkoutUrl as string | undefined,
            status: order.status as never,
            chargedAmountCents: Number(order.chargedAmountCents),
            currency: String(order.currency),
            customerEmail: String(order.customerEmail ?? ""),
            paperStatus: String(paper?.status),
            accessTokenHash: String(paper?.accessTokenHash),
          };
        }
      }
      return null;
    },
    async createPaperAndOrder(input: {
      paper: Record<string, unknown>;
      order: Record<string, unknown>;
    }) {
      papers.set(String(input.paper.publicId), { ...input.paper });
      orders.set(String(input.order.publicId), {
        ...input.order,
        paperPublicId: input.paper.publicId,
        paperId: input.paper.publicId,
      });
      return {
        paperPublicId: String(input.paper.publicId),
        orderPublicId: String(input.order.publicId),
      };
    },
    async saveCheckout(input: {
      orderPublicId: string;
      checkoutSessionId: string;
      checkoutUrl?: string;
    }) {
      const order = orders.get(input.orderPublicId);
      if (order) {
        order.checkoutSessionId = input.checkoutSessionId;
        order.checkoutUrl = input.checkoutUrl;
        order.status = "checkout_created";
      }
    },
    async findOrderByPublicId(publicId: string) {
      return (orders.get(publicId) as unknown as OrderDocument) ?? null;
    },
    async findOrderByCheckoutId(checkoutId: string) {
      for (const order of orders.values()) {
        if (order.checkoutSessionId === checkoutId) {
          return order as unknown as OrderDocument;
        }
      }
      return null;
    },
    async findPaperByPublicId(publicId: string) {
      return (papers.get(publicId) as unknown as PaperDocument) ?? null;
    },
    async savePaper(paper: PaperDocument) {
      papers.set(paper.publicId, { ...paper } as unknown as Record<string, unknown>);
    },
    async findPaperForOrder(order: OrderDocument) {
      const paperId = (order as unknown as { paperPublicId?: string }).paperPublicId;
      return paperId ? ((papers.get(paperId) as unknown as PaperDocument) ?? null) : null;
    },
    async recordWebhookEvent(eventId: string) {
      if (events.has(eventId)) {
        return "duplicate" as const;
      }
      events.add(eventId);
      return "inserted" as const;
    },
    async markPaid(input: { orderPublicId: string; paperPublicId: string; transactionId: string }) {
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

describe("handleCreateOrder", () => {
  beforeEach(() => {
    resetResolveRateLimit();
  });

  it("uses the server price and ignores a tampered client amount", async () => {
    const store = memoryStore();
    const result = await handleCreateOrder({
      ip: "203.0.113.10",
      env,
      store,
      resolve: async (inputs) =>
        inputs.map((item) => ({
          originalInput: item.originalInput,
          inputType: "doi" as const,
          verificationStatus: "verified" as const,
          contentStatus: "abstract" as const,
          matched: {
            title: "A fake but stable climate meta analysis",
            authors: ["Ada Example"],
            year: 2020,
            doi: "10.1038/nature12373",
            provider: "crossref" as const,
          },
          candidates: [],
        })),
      bachs: {
        createCheckout: async (input) => {
          expect(input.amountMinorUnits).toBe(250000);
          return {
            checkoutId: "chk_1",
            checkoutUrl: "https://checkout.bachs.io/c/test",
          };
        },
        getTransaction: async () => ({}),
      },
      body: {
        idempotencyKey: "idem-order-1",
        chargedAmountCents: 1,
        paper: paperFields,
        references: [verifiedRef],
      },
    });
    expect(result.status).toBe(201);
    const body = result.body as { chargedAmountCents: number; accessToken: string };
    expect(body.chargedAmountCents).toBe(250000);
    expect(body.accessToken.length).toBeGreaterThan(20);
  });

  it("rejects unverified references", async () => {
    const result = await handleCreateOrder({
      ip: "203.0.113.11",
      env,
      store: memoryStore(),
      resolve: async (inputs) =>
        inputs.map((item) => ({
          originalInput: item.originalInput,
          inputType: "citation" as const,
          verificationStatus: "unverified" as const,
          contentStatus: "unavailable" as const,
          candidates: [],
        })),
      body: {
        idempotencyKey: "idem-order-2",
        paper: paperFields,
        references: [
          {
            originalInput: "garbage citation text here",
            verificationStatus: "unverified",
          },
        ],
      },
    });
    expect(result.status).toBe(422);
  });
});

describe("handleGetPaper", () => {
  it("denies missing tokens", async () => {
    const store = memoryStore();
    store.papers.set("pap_1", {
      publicId: "pap_1",
      accessTokenHash: hashAccessToken("secret-token", "pepper"),
      status: "awaiting_payment",
      title: "Test",
      requestedPages: 10,
      targetWords: 3000,
    });
    const result = await handleGetPaper({
      paperPublicId: "pap_1",
      env,
      store,
    });
    expect(result.status).toBe(401);
  });
});

describe("Bachs webhook", () => {
  const rawBody = JSON.stringify({
    id: "evt_1",
    type: "collection.succeeded",
    data: {
      charge_id: "ch_1",
      checkout_id: "chk_1",
      amount: "2500.00",
      currency: "NGN",
      metadata: { orderPublicId: "ord_1" },
    },
  });

  function sign(body: string, ts = String(Math.floor(Date.now() / 1000))) {
    const signature = createHmac("sha256", env.BACHS_WEBHOOK_SECRET)
      .update(`${ts}.${body}`)
      .digest("hex");
    return { ts, signature };
  }

  it("verifies a valid signature", () => {
    const { ts, signature } = sign("abc");
    expect(
      verifyBachsSignature({
        rawBody: "abc",
        timestamp: ts,
        signature,
        secret: env.BACHS_WEBHOOK_SECRET,
      }),
    ).toBe(true);
  });

  it("marks checkout_created orders paid", async () => {
    const store = memoryStore();
    store.orders.set("ord_1", {
      publicId: "ord_1",
      paperPublicId: "pap_1",
      status: "checkout_created",
      chargedAmountCents: 250000,
      currency: "NGN",
    });
    store.papers.set("pap_1", {
      publicId: "pap_1",
      status: "awaiting_payment",
    });
    const { ts, signature } = sign(rawBody);
    const result = await handleBachsWebhook({
      rawBody,
      timestamp: ts,
      signature,
      env,
      store,
    });
    expect(result.status).toBe(200);
    expect(store.orders.get("ord_1")?.status).toBe("paid");
    expect(store.papers.get("pap_1")?.status).toBe("ready");
  });

  it("does not pay twice for a duplicate event", async () => {
    const store = memoryStore();
    store.orders.set("ord_1", {
      publicId: "ord_1",
      paperPublicId: "pap_1",
      status: "checkout_created",
      chargedAmountCents: 250000,
      currency: "NGN",
    });
    store.papers.set("pap_1", {
      publicId: "pap_1",
      status: "awaiting_payment",
    });
    const { ts, signature } = sign(rawBody);
    await handleBachsWebhook({ rawBody, timestamp: ts, signature, env, store });
    await handleBachsWebhook({ rawBody, timestamp: ts, signature, env, store });
    expect(store.paidCalls).toBe(2);
    expect(store.orders.get("ord_1")?.status).toBe("paid");
  });

  it("rejects the wrong amount", async () => {
    const store = memoryStore();
    store.orders.set("ord_1", {
      publicId: "ord_1",
      paperPublicId: "pap_1",
      status: "checkout_created",
      chargedAmountCents: 250000,
      currency: "NGN",
    });
    const body = JSON.stringify({
      id: "evt_bad_amt",
      type: "collection.succeeded",
      data: {
        amount: "1.00",
        currency: "NGN",
        metadata: { orderPublicId: "ord_1" },
      },
    });
    const { ts, signature } = sign(body);
    const result = await handleBachsWebhook({
      rawBody: body,
      timestamp: ts,
      signature,
      env,
      store,
    });
    expect(result.status).toBe(422);
    expect(store.orders.get("ord_1")?.status).toBe("checkout_created");
  });

  it("rejects a stale timestamp outside the replay window", async () => {
    const store = memoryStore();
    store.orders.set("ord_1", {
      publicId: "ord_1",
      paperPublicId: "pap_1",
      status: "checkout_created",
      chargedAmountCents: 250000,
      currency: "NGN",
    });
    store.papers.set("pap_1", {
      publicId: "pap_1",
      status: "awaiting_payment",
    });
    const now = Math.floor(Date.now() / 1000);
    const ts = String(now - 10 * 60);
    const signature = createHmac("sha256", env.BACHS_WEBHOOK_SECRET)
      .update(`${ts}.${rawBody}`)
      .digest("hex");
    const result = await handleBachsWebhook({
      rawBody,
      timestamp: ts,
      signature,
      env,
      store,
      nowSeconds: now,
    });
    expect(result.status).toBe(401);
    expect(store.orders.get("ord_1")?.status).toBe("checkout_created");
    expect(store.papers.get("pap_1")?.status).toBe("awaiting_payment");
  });
});
