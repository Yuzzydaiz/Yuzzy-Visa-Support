import "server-only";

import { parseCheckoutConfig } from "@/lib/config/research";
import {
  ACCESS_COOKIE,
  accessCookieOptions,
  accessTokensMatch,
} from "@/lib/research/auth/accessToken";
import {
  ResearchApiError,
  createRequestId,
  researchErrorBody,
} from "@/lib/research/http/errors";
import { createMongoOrderStore, type OrderStore } from "@/lib/research/orders/store";
import { publicPaperProjection } from "@/lib/research/papers/public";

export async function handleGetPaper(input: {
  paperPublicId: string;
  token?: string;
  cookieToken?: string;
  env?: Record<string, string | undefined>;
  store?: OrderStore;
  secureCookie?: boolean;
}): Promise<{
  status: number;
  body: unknown;
  cookie?: { name: string; value: string; options: ReturnType<typeof accessCookieOptions> };
}> {
  const requestId = createRequestId();
  try {
    const checkout = parseCheckoutConfig(input.env ?? process.env);
    const store = input.store ?? createMongoOrderStore();
    const paper = await store.findPaperByPublicId(input.paperPublicId);
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

    const body = publicPaperProjection(paper, requestId);
    const cookie = presented
      ? {
          name: ACCESS_COOKIE,
          value: presented,
          options: accessCookieOptions(input.secureCookie ?? false),
        }
      : undefined;
    return { status: 200, body, cookie };
  } catch (error) {
    if (error instanceof ResearchApiError) {
      return { status: error.status, body: researchErrorBody(error) };
    }
    const failed = new ResearchApiError({
      code: "ACCESS_DENIED",
      message: "This paper link is not valid.",
      requestId,
    });
    return { status: failed.status, body: researchErrorBody(failed) };
  }
}
