import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { parseCheckoutConfig } from "@/lib/config/research";
import {
  ResearchApiError,
  createRequestId,
  researchErrorBody,
} from "@/lib/research/http/errors";
import { researchLog } from "@/lib/research/http/log";
import { amountsMatch, decimalStringToMinorUnits } from "@/lib/research/money";
import { createMongoOrderStore, type OrderStore } from "@/lib/research/orders/store";

const REPLAY_WINDOW_SECONDS = 5 * 60;

export function verifyBachsSignature(input: {
  rawBody: string;
  timestamp: string;
  signature: string;
  secret: string;
  nowSeconds?: number;
}): boolean {
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  const ts = Number.parseInt(input.timestamp, 10);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > REPLAY_WINDOW_SECONDS) {
    return false;
  }
  const expected = createHmac("sha256", input.secret)
    .update(`${input.timestamp}.${input.rawBody}`)
    .digest("hex");
  try {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(input.signature, "hex");
    if (a.length !== b.length) {
      return false;
    }
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

type BachsEnvelope = {
  id?: string;
  type?: string;
  data?: {
    charge_id?: string;
    checkout_id?: string;
    status?: string;
    amount?: string;
    currency?: string;
    metadata?: { orderPublicId?: string };
    reference?: string;
  };
};

export async function handleBachsWebhook(input: {
  rawBody: string;
  timestamp: string | null;
  signature: string | null;
  env?: Record<string, string | undefined>;
  store?: OrderStore;
  nowSeconds?: number;
}): Promise<{ status: number; body: unknown }> {
  const requestId = createRequestId();
  const env = input.env ?? process.env;
  const started = Date.now();
  try {
    const checkout = parseCheckoutConfig(env);
    if (
      !input.timestamp ||
      !input.signature ||
      !verifyBachsSignature({
        rawBody: input.rawBody,
        timestamp: input.timestamp,
        signature: input.signature,
        secret: checkout.bachsWebhookSecret,
        nowSeconds: input.nowSeconds,
      })
    ) {
      throw new ResearchApiError({
        code: "ACCESS_DENIED",
        message: "Invalid webhook signature.",
        requestId,
      });
    }

    let payload: BachsEnvelope;
    try {
      payload = JSON.parse(input.rawBody) as BachsEnvelope;
    } catch {
      throw new ResearchApiError({
        code: "VALIDATION_FAILED",
        message: "Invalid webhook body.",
        requestId,
      });
    }

    const eventId = payload.id;
    if (!eventId) {
      throw new ResearchApiError({
        code: "VALIDATION_FAILED",
        message: "Webhook event id is required.",
        requestId,
      });
    }

    const store = input.store ?? createMongoOrderStore();
    const orderPublicHint =
      payload.data?.metadata?.orderPublicId ?? payload.data?.reference;

    if (payload.type !== "collection.succeeded") {
      await store.recordWebhookEvent(
        eventId,
        payload.type ?? "unknown",
        orderPublicHint,
      );
      return { status: 200, body: { requestId, ignored: payload.type } };
    }

    const order = orderPublicHint
      ? await store.findOrderByPublicId(orderPublicHint)
      : payload.data?.checkout_id
        ? await store.findOrderByCheckoutId(payload.data.checkout_id)
        : null;
    if (!order) {
      throw new ResearchApiError({
        code: "VALIDATION_FAILED",
        message: "Unknown order.",
        requestId,
      });
    }

    const currency = (payload.data?.currency ?? "").toUpperCase();
    if (currency !== order.currency.toUpperCase()) {
      throw new ResearchApiError({
        code: "VALIDATION_FAILED",
        message: "Paid currency does not match the order.",
        requestId,
      });
    }
    if (!payload.data?.amount || !amountsMatch(order.chargedAmountCents, payload.data.amount)) {
      throw new ResearchApiError({
        code: "VALIDATION_FAILED",
        message: "Paid amount does not match the order.",
        requestId,
      });
    }

    const paper = await store.findPaperForOrder(order);
    if (!paper) {
      throw new ResearchApiError({
        code: "VALIDATION_FAILED",
        message: "Unknown paper.",
        requestId,
      });
    }

    const chargeId = payload.data.charge_id ?? eventId;
    const result = await store.markPaid({
      orderPublicId: order.publicId,
      paperPublicId: paper.publicId,
      transactionId: chargeId,
      paidAmountCents: decimalStringToMinorUnits(payload.data.amount),
      paidCurrency: currency,
      eventId,
    });
    const recorded = await store.recordWebhookEvent(
      eventId,
      "collection.succeeded",
      order.publicId,
    );

    researchLog({
      requestId,
      operation: "payments-webhook",
      publicPaperId: paper.publicId,
      publicOrderId: order.publicId,
      status: 200,
      durationMs: Date.now() - started,
      extra: { alreadyPaid: result.alreadyPaid },
    });

    return {
      status: 200,
      body: {
        requestId,
        alreadyPaid: result.alreadyPaid,
        duplicate: recorded === "duplicate",
      },
    };
  } catch (error) {
    if (error instanceof ResearchApiError) {
      return { status: error.status, body: researchErrorBody(error) };
    }
    const failed = new ResearchApiError({
      code: "GENERATION_RETRYABLE",
      message: "Webhook processing failed.",
      requestId,
    });
    return { status: failed.status, body: researchErrorBody(failed) };
  }
}
