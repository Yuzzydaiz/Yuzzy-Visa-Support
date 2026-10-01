import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseResearchProductConfig } from "@/lib/config/research";
import { hashAccessToken } from "@/lib/research/auth/accessToken";
import { handleCreateOrder } from "@/lib/research/orders/http";
import type { OrderStore } from "@/lib/research/orders/store";
import { handleRetryCheckout } from "@/lib/research/orders/retry";
import { resetResolveRateLimit } from "@/lib/research/http/rateLimitStub";
import type { ResolveInput, ResolvedReference } from "@/lib/research/references/resolve";
import type { OrderDocument } from "@/lib/models/Order";
import type { PaperDocument } from "@/lib/models/Paper";
import {
  applyStatusAndExtra,
  orderOwnsPaper,
  planPaymentSuccess,
} from "@/lib/research/state/orderTransitions";
import { getResearchValidationSchemas } from "@/lib/validation/research";

const env = {
  MONGODB_URI: "mongodb://localhost/test",
  BACHS_API_KEY: "k",
  BACHS_WEBHOOK_SECRET: "s",
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

const fakeVerified = {
  originalInput: "not a real doi at all",
  verificationStatus: "verified" as const,
  contentStatus: "abstract" as const,
  matched: {
    title: "Invented paper",
    authors: ["Nobody"],
    year: 2020,
    doi: "10.0000/fake",
  },
};

async function verifiedResolve(inputs: ResolveInput[]): Promise<ResolvedReference[]> {
  return inputs.map((item) => ({
    originalInput: item.originalInput,
    inputType: "citation",
    verificationStatus: "verified",
    contentStatus: "abstract",
    matched: {
      title: "Climate synthesis",
      authors: ["Ada Example"],
      year: 2020,
      doi: "10.1038/nature12373",
      provider: "crossref",
    },
    candidates: [],
  }));
}

async function unverifiedResolve(inputs: ResolveInput[]): Promise<ResolvedReference[]> {
  return inputs.map((item) => ({
    originalInput: item.originalInput,
    inputType: "citation",
    verificationStatus: "unverified",
    contentStatus: "unavailable",
    candidates: [],
  }));
}

function mongoLikeStore(): {
  papers: Map<string, Record<string, unknown>>;
  orders: Map<string, Record<string, unknown>>;
} & OrderStore {
  const papers = new Map<string, Record<string, unknown>>();
  const orders = new Map<string, Record<string, unknown>>();
  const store = {
    papers,
    orders,
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
    async findOrderByCheckoutId() {
      return null;
    },
    async findPaperByPublicId(publicId: string) {
      return (papers.get(publicId) as unknown as PaperDocument) ?? null;
    },
    async savePaper() {},
    async findPaperForOrder() {
      return null;
    },
    async recordWebhookEvent() {
      return "inserted" as const;
    },
    async markPaid() {
      return { alreadyPaid: false };
    },
  };
  return store;
}

describe("review finding repro", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("A: reference schema arity vs extra config argument", () => {
    const schemas = getResearchValidationSchemas(parseResearchProductConfig({}));
    expect(schemas.referenceInput).toBeTruthy();
  });

  it("B: paid order plus awaiting paper is apply not already_done", () => {
    const plan = planPaymentSuccess("paid", "awaiting_payment");
    expect(plan.kind).toBe("apply");
  });

  it("D: extra.status cannot overwrite the intended transition", () => {
    const doc = { status: "created" };
    applyStatusAndExtra(doc, "checkout_created", { status: "paid" });
    expect(doc.status).toBe("checkout_created");
  });

  it("E: mismatched paper ids do not bind", () => {
    expect(orderOwnsPaper({ toString: () => "aaa" }, { toString: () => "bbb" })).toBe(
      false,
    );
    expect(orderOwnsPaper({ toString: () => "aaa" }, { toString: () => "aaa" })).toBe(
      true,
    );
  });

  it("C: failed connect leaves promise cached", async () => {
    vi.resetModules();
    vi.doMock("mongoose", () => ({
      default: {
        connect: vi.fn().mockRejectedValue(new Error("transient")),
      },
    }));
    vi.doMock("@/lib/config/research", async () => {
      const actual = await vi.importActual<typeof import("@/lib/config/research")>(
        "@/lib/config/research",
      );
      return {
        ...actual,
        parseMongoConfig: () => ({
          mongodbUri: "mongodb://127.0.0.1:27017/debug",
        }),
        parseResearchRuntimeSecrets: () => ({
          mongodbUri: "mongodb://127.0.0.1:27017/debug",
        }),
      };
    });

    const mongo = await import("@/lib/db/mongodb");
    mongo.resetMongoCache();
    await expect(mongo.connectMongo()).rejects.toThrow("transient");
    const first = mongo.getMongoCacheSnapshot();
    await expect(mongo.connectMongo()).rejects.toThrow("transient");
    const second = mongo.getMongoCacheSnapshot();
    expect(first.hasPromise).toBe(false);
    expect(second.hasPromise).toBe(false);
  });
});

describe("review checkout findings", () => {
  beforeEach(() => {
    resetResolveRateLimit();
  });

  it("A/B: stored checkout url is returned on idempotent retry", async () => {
    const store = mongoLikeStore();
    const body = {
      idempotencyKey: "idem-lost-url",
      paper: paperFields,
      references: [fakeVerified],
    };
    const first = await handleCreateOrder({
      ip: "203.0.113.40",
      env,
      store,
      resolve: verifiedResolve,
      bachs: {
        createCheckout: async () => ({
          checkoutId: "chk_keep",
          checkoutUrl: "https://checkout.bachs.io/c/keep",
        }),
        getTransaction: async () => ({}),
      },
      body,
    });
    expect(first.status).toBe(201);
    expect((first.body as { checkoutUrl?: string }).checkoutUrl).toBe(
      "https://checkout.bachs.io/c/keep",
    );
    let bachsCalls = 0;
    const second = await handleCreateOrder({
      ip: "203.0.113.41",
      env,
      store,
      resolve: verifiedResolve,
      bachs: {
        createCheckout: async () => {
          bachsCalls += 1;
          return {
            checkoutId: "chk_retry",
            checkoutUrl: "https://checkout.bachs.io/c/retry",
          };
        },
        getTransaction: async () => ({}),
      },
      body,
    });
    expect(second.status).toBe(200);
    expect((second.body as { checkoutUrl?: string }).checkoutUrl).toBe(
      "https://checkout.bachs.io/c/keep",
    );
    expect(bachsCalls).toBe(0);
    expect((second.body as { accessToken?: string }).accessToken).toBeUndefined();
  });

  it("C: Bachs failure after persist returns a recovery token and resume creates checkout", async () => {
    const store = mongoLikeStore();
    const first = await handleCreateOrder({
      ip: "203.0.113.42",
      env,
      store,
      resolve: verifiedResolve,
      bachs: {
        createCheckout: async () => {
          throw new Error("bachs down");
        },
        getTransaction: async () => ({}),
      },
      body: {
        idempotencyKey: "idem-orphan",
        paper: paperFields,
        references: [fakeVerified],
      },
    });
    expect(first.status).toBe(503);
    expect((first.body as { accessToken?: string }).accessToken).toBeTruthy();
    expect(store.papers.size).toBe(1);
    const retry = await handleCreateOrder({
      ip: "203.0.113.43",
      env,
      store,
      resolve: verifiedResolve,
      bachs: {
        createCheckout: async () => ({
          checkoutId: "chk_new",
          checkoutUrl: "https://checkout.bachs.io/c/new",
        }),
        getTransaction: async () => ({}),
      },
      body: {
        idempotencyKey: "idem-orphan",
        paper: paperFields,
        references: [fakeVerified],
      },
    });
    expect(retry.status).toBe(200);
    expect((retry.body as { checkoutUrl?: string }).checkoutUrl).toBe(
      "https://checkout.bachs.io/c/new",
    );
  });

  it("D: retry rejects when the order does not own the paper", async () => {
    const store = mongoLikeStore();
    const tokenA = "token-a";
    store.papers.set("pap_a", {
      publicId: "pap_a",
      _id: "id_a",
      status: "awaiting_payment",
      accessTokenHash: hashAccessToken(tokenA, "pepper"),
    });
    store.papers.set("pap_b", {
      publicId: "pap_b",
      _id: "id_b",
      status: "awaiting_payment",
      accessTokenHash: hashAccessToken("token-b", "pepper"),
    });
    store.orders.set("ord_b", {
      publicId: "ord_b",
      paperId: "id_b",
      paperPublicId: "pap_b",
      status: "checkout_created",
      chargedAmountCents: 250000,
      currency: "NGN",
      customerEmail: "victim@example.com",
    });
    const result = await handleRetryCheckout({
      env,
      store,
      token: tokenA,
      ip: "203.0.113.44",
      bachs: {
        createCheckout: async () => ({
          checkoutId: "chk_hijack",
          checkoutUrl: "https://checkout.bachs.io/c/hijack",
        }),
        getTransaction: async () => ({}),
      },
      body: { paperPublicId: "pap_a", orderPublicId: "ord_b" },
    });
    expect(result.status).toBe(401);
    expect(store.orders.get("ord_b")?.checkoutSessionId).toBeUndefined();
  });

  it("E: checkout rejects client verified metadata when server resolve fails", async () => {
    const store = mongoLikeStore();
    const result = await handleCreateOrder({
      ip: "203.0.113.45",
      env,
      store,
      resolve: unverifiedResolve,
      bachs: {
        createCheckout: async () => ({
          checkoutId: "chk_fake",
          checkoutUrl: "https://checkout.bachs.io/c/fake",
        }),
        getTransaction: async () => ({}),
      },
      body: {
        idempotencyKey: "idem-fake-ref",
        paper: paperFields,
        references: [fakeVerified],
      },
    });
    expect(result.status).toBe(422);
    expect(store.papers.size).toBe(0);
  });
});
