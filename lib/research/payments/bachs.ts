import "server-only";

import { minorUnitsToDecimalString } from "@/lib/research/money";

export type BachsCheckoutSession = {
  checkoutId: string;
  checkoutUrl: string;
};

export type CreateBachsCheckoutInput = {
  apiKey: string;
  apiBaseUrl: string;
  amountMinorUnits: number;
  currency: string;
  customerEmail: string;
  customerName?: string;
  successUrl: string;
  cancelUrl: string;
  orderPublicId: string;
  fetchImpl?: typeof fetch;
};

export function createBachsClient(input: {
  apiKey: string;
  apiBaseUrl: string;
  fetchImpl?: typeof fetch;
}) {
  const fetchImpl = input.fetchImpl ?? fetch;
  const base = input.apiBaseUrl.replace(/\/$/, "");
  const timeoutMs = 15_000;

  return {
    async createCheckout(
      payload: Omit<CreateBachsCheckoutInput, "apiKey" | "apiBaseUrl" | "fetchImpl">,
    ): Promise<BachsCheckoutSession> {
      const response = await fetchImpl(`${base}/v1/checkout-sessions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${input.apiKey}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(timeoutMs),
        body: JSON.stringify({
          customer: {
            email: payload.customerEmail,
            name: payload.customerName,
          },
          billing_currency: payload.currency,
          pricing: {
            currency: payload.currency,
            amount: minorUnitsToDecimalString(payload.amountMinorUnits),
            price_type: "fixed",
          },
          success_url: payload.successUrl,
          cancel_url: payload.cancelUrl,
          reference: payload.orderPublicId,
          metadata: { orderPublicId: payload.orderPublicId },
          payment_method_types: ["NGN_CARD", "NGN_BANK_TRANSFER"],
        }),
      });
      if (!response.ok) {
        throw new Error(`Bachs checkout failed (${response.status})`);
      }
      const json = (await response.json()) as {
        checkout_id?: string;
        checkout_url?: string;
      };
      if (!json.checkout_id || !json.checkout_url) {
        throw new Error("Bachs checkout response missing url");
      }
      return { checkoutId: json.checkout_id, checkoutUrl: json.checkout_url };
    },

    async getTransaction(transactionId: string): Promise<unknown> {
      const response = await fetchImpl(
        `${base}/v1/charges/${encodeURIComponent(transactionId)}`,
        {
          headers: { Authorization: `Bearer ${input.apiKey}` },
          signal: AbortSignal.timeout(timeoutMs),
        },
      );
      if (!response.ok) {
        throw new Error(`Bachs transaction fetch failed (${response.status})`);
      }
      return response.json();
    },
  };
}

export type BachsClient = ReturnType<typeof createBachsClient>;
