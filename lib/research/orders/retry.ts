import "server-only";

import { parseCheckoutConfig } from "@/lib/config/research";
import { accessTokensMatch } from "@/lib/research/auth/accessToken";
import {
  ResearchApiError,
  createRequestId,
  researchErrorBody,
} from "@/lib/research/http/errors";
import { consumeResearchRateLimit } from "@/lib/research/http/rateLimit";
import { createBachsClient, type BachsClient } from "@/lib/research/payments/bachs";
import { createMongoOrderStore, type OrderStore } from "@/lib/research/orders/store";
import { orderOwnsPaper } from "@/lib/research/state/orderTransitions";

export async function handleRetryCheckout(input: {
  body: unknown;
  env?: Record<string, string | undefined>;
  store?: OrderStore;
  bachs?: BachsClient;
  token?: string;
  ip?: string;
}): Promise<{ status: number; body: unknown }> {
  const requestId = createRequestId();
  const env = input.env ?? process.env;
  try {
    if (!(await consumeResearchRateLimit({ bucket: "orders-retry", ip: input.ip ?? "unknown" }))) {
      throw new ResearchApiError({
        code: "RATE_LIMITED",
        message: "Too many checkout requests. Try again in a few minutes.",
        requestId,
      });
    }
    const parsed = input.body as {
      paperPublicId?: string;
      orderPublicId?: string;
    };
    if (!parsed?.paperPublicId || !parsed.orderPublicId) {
      throw new ResearchApiError({
        code: "VALIDATION_FAILED",
        message: "Paper and order ids are required.",
        requestId,
      });
    }
    const checkout = parseCheckoutConfig(env);
    const store = input.store ?? createMongoOrderStore();
    const paper = await store.findPaperByPublicId(parsed.paperPublicId);
    const order = await store.findOrderByPublicId(parsed.orderPublicId);
    if (
      !paper ||
      !order ||
      !accessTokensMatch(input.token, paper.accessTokenHash, checkout.recoveryTokenPepper)
    ) {
      throw new ResearchApiError({
        code: "ACCESS_DENIED",
        message: "This paper link is not valid.",
        requestId,
      });
    }
    if (!orderOwnsPaper(order.paperId, paper._id)) {
      throw new ResearchApiError({
        code: "ACCESS_DENIED",
        message: "This paper link is not valid.",
        requestId,
      });
    }
    if (order.status === "paid" || paper.status === "ready") {
      throw new ResearchApiError({
        code: "VALIDATION_FAILED",
        message: "This order is already paid.",
        requestId,
      });
    }

    const bachs = input.bachs ?? createBachsClient({
      apiKey: checkout.bachsApiKey,
      apiBaseUrl: checkout.bachsApiBaseUrl,
    });
    const session = await bachs.createCheckout({
      amountMinorUnits: order.chargedAmountCents,
      currency: order.currency,
      customerEmail: order.customerEmail,
      successUrl: `${checkout.appBaseUrl}/research/payment/success?paper=${paper.publicId}&order=${order.publicId}`,
      cancelUrl: `${checkout.appBaseUrl}/research/payment/cancelled?paper=${paper.publicId}&order=${order.publicId}`,
      orderPublicId: order.publicId,
    });
    await store.saveCheckout({
      orderPublicId: order.publicId,
      checkoutSessionId: session.checkoutId,
      checkoutUrl: session.checkoutUrl,
    });
    return {
      status: 200,
      body: { requestId, checkoutUrl: session.checkoutUrl },
    };
  } catch (error) {
    if (error instanceof ResearchApiError) {
      return { status: error.status, body: researchErrorBody(error) };
    }
    const failed = new ResearchApiError({
      code: "GENERATION_RETRYABLE",
      message: "Checkout retry is temporarily unavailable.",
      requestId,
    });
    return { status: failed.status, body: researchErrorBody(failed) };
  }
}
