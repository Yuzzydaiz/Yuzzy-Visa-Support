import "server-only";

import { parseCheckoutConfig, parseReferenceLookupConfig } from "@/lib/config/research";
import {
  calculateOrderPricing,
  parseResearchProductConfig,
} from "@/lib/config/research-product";
import { createAccessToken, hashAccessToken } from "@/lib/research/auth/accessToken";
import {
  ResearchApiError,
  createRequestId,
  researchErrorBody,
} from "@/lib/research/http/errors";
import { consumeResearchRateLimit } from "@/lib/research/http/rateLimit";
import { researchLog } from "@/lib/research/http/log";
import { createBachsClient, type BachsClient } from "@/lib/research/payments/bachs";
import { createMongoOrderStore, type OrderStore } from "@/lib/research/orders/store";
import { createCrossrefClient } from "@/lib/research/references/crossref";
import { createOpenAlexClient } from "@/lib/research/references/openalex";
import {
  resolveReferences,
  type ResolveInput,
  type ResolvedReference,
} from "@/lib/research/references/resolve";
import { detectReferenceInputType } from "@/lib/validation/research";
import { createOrderRequestSchema } from "@/lib/validation/research";

function publicId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

function includedReference(reference: {
  isSystemAdded?: boolean;
  selectedByUser?: boolean;
}) {
  return !(reference.isSystemAdded && reference.selectedByUser === false);
}

export async function handleCreateOrder(input: {
  ip: string;
  body: unknown;
  env?: Record<string, string | undefined>;
  store?: OrderStore;
  bachs?: BachsClient;
  resolve?: (inputs: ResolveInput[]) => Promise<ResolvedReference[]>;
}): Promise<{ status: number; body: unknown }> {
  const requestId = createRequestId();
  const env = input.env ?? process.env;
  const started = Date.now();
  let persistedBeforeBachs = false;
  let rawToken: string | undefined;
  let paperPublicId: string | undefined;
  let orderPublicId: string | undefined;
  try {
    if (!(await consumeResearchRateLimit({ bucket: "orders", ip: input.ip }))) {
      throw new ResearchApiError({
        code: "RATE_LIMITED",
        message: "Too many checkout requests. Try again in a few minutes.",
        requestId,
      });
    }

    const product = parseResearchProductConfig(env);
    const parsed = createOrderRequestSchema(product).safeParse(input.body);
    if (!parsed.success) {
      throw new ResearchApiError({
        code: "VALIDATION_FAILED",
        message: "Add a complete paper, verified sources, and an email to pay.",
        requestId,
      });
    }

    const selected = parsed.data.references.filter(includedReference);
    if (!selected.length) {
      throw new ResearchApiError({
        code: "REFERENCE_UNRESOLVED",
        message: "Keep at least one verified source selected.",
        requestId,
      });
    }
    const lookup = input.resolve ? undefined : parseReferenceLookupConfig(env);
    const resolveInputs: ResolveInput[] = selected.map((reference) => ({
      id: reference.id,
      originalInput: reference.originalInput,
      userProvidedNotes: reference.userProvidedNotes,
    }));
    const resolved = input.resolve
      ? await input.resolve(resolveInputs)
      : await resolveReferences(resolveInputs, {
          crossref: createCrossrefClient({ email: lookup!.crossrefContactEmail }),
          openalex: createOpenAlexClient({
            email: lookup!.crossrefContactEmail,
            apiKey: lookup!.openalexApiKey,
          }),
        });
    const resolvedByInput = new Map(
      resolved.map((item) => [item.originalInput.trim(), item]),
    );
    const serverVerified = selected.map((reference) => {
      const server = resolvedByInput.get(reference.originalInput.trim());
      if (!server || server.verificationStatus !== "verified" || !server.matched) {
        throw new ResearchApiError({
          code: "REFERENCE_UNRESOLVED",
          message: "Every selected source must be verified before payment.",
          requestId,
        });
      }
      return { reference, server };
    });

    const checkout = parseCheckoutConfig(env);
    const store = input.store ?? createMongoOrderStore();
    const existing = await store.findByIdempotencyKey(parsed.data.idempotencyKey);
    const bachs = input.bachs ?? createBachsClient({
      apiKey: checkout.bachsApiKey,
      apiBaseUrl: checkout.bachsApiBaseUrl,
    });
    if (existing) {
      if (!existing.checkoutUrl) {
        const session = await bachs.createCheckout({
          amountMinorUnits: existing.chargedAmountCents,
          currency: existing.currency,
          customerEmail: existing.customerEmail,
          customerName: parsed.data.paper.authors[0]?.name,
          successUrl: `${checkout.appBaseUrl}/research/payment/success?paper=${existing.paperPublicId}&order=${existing.orderPublicId}`,
          cancelUrl: `${checkout.appBaseUrl}/research/payment/cancelled?paper=${existing.paperPublicId}&order=${existing.orderPublicId}`,
          orderPublicId: existing.orderPublicId,
        });
        await store.saveCheckout({
          orderPublicId: existing.orderPublicId,
          checkoutSessionId: session.checkoutId,
          checkoutUrl: session.checkoutUrl,
        });
        return {
          status: 200,
          body: {
            requestId,
            orderPublicId: existing.orderPublicId,
            paperPublicId: existing.paperPublicId,
            checkoutUrl: session.checkoutUrl,
            chargedAmountCents: existing.chargedAmountCents,
            currency: existing.currency,
          },
        };
      }
      return {
        status: 200,
        body: {
          requestId,
          orderPublicId: existing.orderPublicId,
          paperPublicId: existing.paperPublicId,
          checkoutUrl: existing.checkoutUrl,
          chargedAmountCents: existing.chargedAmountCents,
          currency: existing.currency,
        },
      };
    }

    const pricing = calculateOrderPricing(parsed.data.paper.requestedPages, product);
    rawToken = createAccessToken();
    paperPublicId = publicId("pap");
    orderPublicId = publicId("ord");
    const firstAuthor = parsed.data.paper.authors[0]?.name;

    await store.createPaperAndOrder({
      paper: {
        publicId: paperPublicId,
        customerEmail: parsed.data.paper.customerEmail,
        accessTokenHash: hashAccessToken(rawToken, checkout.recoveryTokenPepper),
        title: parsed.data.paper.title,
        focus: parsed.data.paper.focus?.trim() || parsed.data.paper.title,
        paperType: parsed.data.paper.paperType,
        authors: parsed.data.paper.authors,
        citationStyle: parsed.data.paper.citationStyle,
        requestedPages: parsed.data.paper.requestedPages,
        targetWords: pricing.targetWords,
        allowAdditionalSources: parsed.data.paper.allowAdditionalSources,
        researchNotes: parsed.data.paper.researchNotes,
        actualMethodology: parsed.data.paper.actualMethodology,
        actualFindings: parsed.data.paper.actualFindings,
        status: "awaiting_payment",
        regeneration: { used: 0, limit: product.regenerationLimit },
        references: serverVerified.map(({ reference, server }, index) => ({
          refId: reference.id ?? server.id ?? `ref_${String(index + 1).padStart(2, "0")}`,
          originalInput: reference.originalInput,
          inputType: detectReferenceInputType(reference.originalInput),
          title: server.matched!.title,
          authors: server.matched!.authors ?? [],
          year: server.matched!.year,
          journal: server.matched!.journal,
          doi: server.matched!.doi,
          canonicalUrl: server.matched!.url,
          abstract: server.matched!.abstract,
          userProvidedNotes: reference.userProvidedNotes,
          verificationStatus: "verified" as const,
          contentStatus: server.contentStatus,
          isSystemAdded: Boolean(reference.isSystemAdded),
          isUserKeyReference: reference.isSystemAdded ? false : true,
          selectedByUser: reference.selectedByUser !== false,
        })),
      },
      order: {
        publicId: orderPublicId,
        customerEmail: parsed.data.paper.customerEmail,
        requestedPages: pricing.requestedPages,
        wordsPerPage: pricing.wordsPerPage,
        targetWords: pricing.targetWords,
        unitPriceCents: pricing.unitPriceCents,
        subtotalCents: pricing.subtotalCents,
        minimumChargeCents: pricing.minimumChargeCents,
        chargedAmountCents: pricing.chargedAmountCents,
        currency: product.currency,
        provider: "bachs",
        status: "created",
        idempotencyKey: parsed.data.idempotencyKey,
      },
    });
    persistedBeforeBachs = true;

    const session = await bachs.createCheckout({
      amountMinorUnits: pricing.chargedAmountCents,
      currency: product.currency,
      customerEmail: parsed.data.paper.customerEmail,
      customerName: firstAuthor,
      successUrl: `${checkout.appBaseUrl}/research/payment/success?paper=${paperPublicId}&order=${orderPublicId}`,
      cancelUrl: `${checkout.appBaseUrl}/research/payment/cancelled?paper=${paperPublicId}&order=${orderPublicId}`,
      orderPublicId,
    });
    await store.saveCheckout({
      orderPublicId,
      checkoutSessionId: session.checkoutId,
      checkoutUrl: session.checkoutUrl,
    });

    researchLog({
      requestId,
      operation: "orders-checkout",
      publicPaperId: paperPublicId,
      publicOrderId: orderPublicId,
      status: 201,
      durationMs: Date.now() - started,
    });

    return {
      status: 201,
      body: {
        requestId,
        orderPublicId,
        paperPublicId,
        checkoutUrl: session.checkoutUrl,
        accessToken: rawToken,
        chargedAmountCents: pricing.chargedAmountCents,
        currency: product.currency,
      },
    };
  } catch (error) {
    if (error instanceof Error && /Missing required server configuration/.test(error.message)) {
      const missing = new ResearchApiError({
        code: "VALIDATION_FAILED",
        message: error.message.replace("Missing required server configuration: ", "Server is missing "),
        requestId,
      });
      return { status: missing.status, body: researchErrorBody(missing) };
    }
    if (error instanceof ResearchApiError) {
      return { status: error.status, body: researchErrorBody(error) };
    }
    const failed = new ResearchApiError({
      code: "GENERATION_RETRYABLE",
      message: "Checkout is temporarily unavailable. Try again.",
      requestId,
    });
    return {
      status: failed.status,
      body: {
        ...researchErrorBody(failed),
        ...(persistedBeforeBachs && rawToken && paperPublicId && orderPublicId
          ? {
              accessToken: rawToken,
              paperPublicId,
              orderPublicId,
            }
          : {}),
      },
    };
  }
}
