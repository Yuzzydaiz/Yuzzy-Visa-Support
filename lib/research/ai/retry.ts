import type { LlmClient, LlmResult } from "@/lib/research/ai/client";

export async function completeJsonWithBackoff(
  client: LlmClient,
  input: Parameters<LlmClient["completeJson"]>[0],
  // One attempt: the provider fallback chain already retries across providers,
  // and a bounded attempt count keeps a single step inside the generation lease.
  attempts = 1,
): Promise<LlmResult> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await client.completeJson(input);
    } catch (error) {
      lastError = error;
      const retryable = Boolean(
        error &&
          typeof error === "object" &&
          "retryable" in error &&
          (error as { retryable?: boolean }).retryable,
      );
      if (!retryable || i === attempts - 1) {
        throw error;
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("OpenAI request failed");
}
