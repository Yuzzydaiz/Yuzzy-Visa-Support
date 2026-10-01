import "server-only";

import { parseCheckoutConfig } from "@/lib/config/research";
import { accessTokensMatch } from "@/lib/research/auth/accessToken";
import {
  ResearchApiError,
  createRequestId,
  researchErrorBody,
} from "@/lib/research/http/errors";
import { deletePaperByPublicId } from "@/lib/research/maintenance/purge";
import { createMongoOrderStore, type OrderStore } from "@/lib/research/orders/store";

export async function handleDeletePaper(input: {
  paperPublicId: string;
  token?: string;
  cookieToken?: string;
  env?: Record<string, string | undefined>;
  store?: OrderStore;
}): Promise<{ status: number; body: unknown }> {
  const requestId = createRequestId();
  const env = input.env ?? process.env;
  try {
    const checkout = parseCheckoutConfig(env);
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
    const removed = await deletePaperByPublicId(paper.publicId);
    return {
      status: 200,
      body: {
        requestId,
        deleted: Boolean(removed),
        publicId: paper.publicId,
      },
    };
  } catch (error) {
    if (error instanceof ResearchApiError) {
      return { status: error.status, body: researchErrorBody(error) };
    }
    const failed = new ResearchApiError({
      code: "VALIDATION_FAILED",
      message: "Could not delete this draft.",
      requestId,
    });
    return { status: failed.status, body: researchErrorBody(failed) };
  }
}
