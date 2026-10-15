import "server-only";

import type {
  LlmConfig,
  LlmProviderConfig,
} from "@/lib/research/ai/client";
import {
  parseResearchProductConfig,
} from "@/lib/config/research-product";

export {
  CITATION_STYLE_IDS,
  DEFAULT_UTILITY_MODEL,
  DEFAULT_WRITING_MODEL,
  PAPER_TYPES,
  calculateOrderPricing,
  getResearchProductConfig,
  parseResearchProductConfig,
  resetResearchProductConfigCache,
  type CitationStyleId,
  type OrderPricing,
  type PaperType,
  type ResearchProductConfig,
} from "@/lib/config/research-product";

const REQUIRED_SECRET_KEYS = [
  "MONGODB_URI",
  "BACHS_API_KEY",
  "BACHS_WEBHOOK_SECRET",
  "BACHS_API_BASE_URL",
  "APP_BASE_URL",
  "RECOVERY_TOKEN_PEPPER",
  "CROSSREF_CONTACT_EMAIL",
] as const;

const LLM_KEY_NAMES = ["OPENAI_API_KEY", "OPENROUTER_API_KEY", "LLM_API_KEY"] as const;

export function resolveLlmApiKey(
  env: Record<string, string | undefined>,
): string | undefined {
  for (const key of LLM_KEY_NAMES) {
    const value = env[key]?.trim();
    if (value) {
      return value;
    }
  }
  return undefined;
}

export type ResearchRuntimeSecrets = {
  mongodbUri: string;
  openaiApiKey: string;
  bachsApiKey: string;
  bachsWebhookSecret: string;
  bachsApiBaseUrl: string;
  bachsProductId?: string;
  appBaseUrl: string;
  recoveryTokenPepper: string;
  crossrefContactEmail: string;
  openalexApiKey?: string;
  emailApiKey?: string;
  emailFrom?: string;
};

function optionalSecret(
  env: Record<string, string | undefined>,
  key: string,
): string | undefined {
  const value = env[key]?.trim();
  return value ? value : undefined;
}

export function parseResearchRuntimeSecrets(
  env: Record<string, string | undefined> = process.env,
): ResearchRuntimeSecrets {
  for (const key of REQUIRED_SECRET_KEYS) {
    if (!env[key]?.trim()) {
      throw new Error(`Missing required server configuration: ${key}`);
    }
  }
  const llmApiKey = resolveLlmApiKey(env);
  if (!llmApiKey) {
    throw new Error(
      "Missing required server configuration: OPENAI_API_KEY or OPENROUTER_API_KEY",
    );
  }

  return {
    mongodbUri: env.MONGODB_URI!.trim(),
    openaiApiKey: llmApiKey,
    bachsApiKey: env.BACHS_API_KEY!.trim(),
    bachsWebhookSecret: env.BACHS_WEBHOOK_SECRET!.trim(),
    bachsApiBaseUrl: env.BACHS_API_BASE_URL!.trim(),
    bachsProductId: optionalSecret(env, "BACHS_PRODUCT_ID"),
    appBaseUrl: env.APP_BASE_URL!.trim(),
    recoveryTokenPepper: env.RECOVERY_TOKEN_PEPPER!.trim(),
    crossrefContactEmail: env.CROSSREF_CONTACT_EMAIL!.trim(),
    openalexApiKey: optionalSecret(env, "OPENALEX_API_KEY"),
    emailApiKey: optionalSecret(env, "EMAIL_API_KEY"),
    emailFrom: optionalSecret(env, "EMAIL_FROM"),
  };
}

export type ReferenceLookupConfig = {
  crossrefContactEmail: string;
  openalexApiKey?: string;
};

export function parseReferenceLookupConfig(
  env: Record<string, string | undefined> = process.env,
): ReferenceLookupConfig {
  const crossrefContactEmail = env.CROSSREF_CONTACT_EMAIL?.trim();
  if (!crossrefContactEmail) {
    throw new Error("Missing required server configuration: CROSSREF_CONTACT_EMAIL");
  }
  return {
    crossrefContactEmail,
    openalexApiKey: optionalSecret(env, "OPENALEX_API_KEY"),
  };
}

export function getReferenceLookupConfig(): ReferenceLookupConfig {
  return parseReferenceLookupConfig();
}

export type UtilityLlmConfig = {
  openaiApiKey: string;
  utilityModel: string;
  llm: LlmConfig;
};

function toOpenRouterModel(model: string): string {
  return model.includes("/") ? model : `openai/${model}`;
}

export function parseLlmConfig(
  env: Record<string, string | undefined> = process.env,
): LlmConfig {
  const product = parseResearchProductConfig(env);
  const openaiWriting = product.writingModel;
  const openaiUtility = product.utilityModel;
  const openaiKey = env.OPENAI_API_KEY?.trim();
  const openrouterKey =
    env.OPENROUTER_API_KEY?.trim() || env.LLM_API_KEY?.trim();

  const openai: LlmProviderConfig | undefined = openaiKey
    ? {
        name: "openai",
        apiKey: openaiKey,
        baseUrl: (env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(
          /\/+$/,
          "",
        ),
        apiStyle: "responses",
        writingModel: openaiWriting,
        utilityModel: openaiUtility,
      }
    : undefined;

  const openrouter: LlmProviderConfig | undefined = openrouterKey
    ? {
        name: "openrouter",
        apiKey: openrouterKey,
        baseUrl: (
          env.OPENROUTER_BASE_URL?.trim() || "https://openrouter.ai/api/v1"
        ).replace(/\/+$/, ""),
        apiStyle: "chat_completions",
        writingModel:
          env.OPENROUTER_WRITING_MODEL?.trim() ||
          toOpenRouterModel(openaiWriting),
        utilityModel:
          env.OPENROUTER_UTILITY_MODEL?.trim() ||
          toOpenRouterModel(openaiUtility),
      }
    : undefined;

  const preferOpenRouter =
    env.LLM_PRIMARY?.trim().toLowerCase() === "openrouter";
  const ordered = preferOpenRouter
    ? [openrouter, openai]
    : [openai, openrouter];
  const providers = ordered.filter(
    (provider): provider is LlmProviderConfig => Boolean(provider),
  );
  if (!providers.length) {
    throw new Error(
      "Missing required server configuration: OPENAI_API_KEY or OPENROUTER_API_KEY",
    );
  }
  return {
    providers,
    writingModel: providers[0].writingModel,
    utilityModel: providers[0].utilityModel,
  };
}

export function parseUtilityLlmConfig(
  env: Record<string, string | undefined> = process.env,
): UtilityLlmConfig {
  const llm = parseLlmConfig(env);
  return {
    openaiApiKey: llm.providers[0].apiKey,
    utilityModel: llm.utilityModel,
    llm,
  };
}

export function getUtilityLlmConfig(): UtilityLlmConfig {
  return parseUtilityLlmConfig();
}

export type WritingLlmConfig = {
  openaiApiKey: string;
  writingModel: string;
  utilityModel: string;
  llm: LlmConfig;
};

export function parseWritingLlmConfig(
  env: Record<string, string | undefined> = process.env,
): WritingLlmConfig {
  const llm = parseLlmConfig(env);
  return {
    openaiApiKey: llm.providers[0].apiKey,
    writingModel: llm.writingModel,
    utilityModel: llm.utilityModel,
    llm,
  };
}

export function getWritingLlmConfig(): WritingLlmConfig {
  return parseWritingLlmConfig();
}

export const DEFAULT_WRITING_TIMEOUT_MS = 60_000;
export const DEFAULT_UTILITY_TIMEOUT_MS = 30_000;
// The generation routes declare maxDuration = 300s. Keep the worst case for a
// step, and therefore the derived lease, inside that envelope so the platform
// cannot kill the function while the lease is still held.
export const MAX_LLM_TIMEOUT_MS = 42_000;
export const MAX_GENERATION_LEASE_MS = 290_000;

function parseTimeoutMs(raw: string | undefined, fallback: number): number {
  const value = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(value) || value < 1000) {
    return fallback;
  }
  return Math.min(value, MAX_LLM_TIMEOUT_MS);
}

export function parseLlmTimeouts(
  env: Record<string, string | undefined> = process.env,
): { writingMs: number; utilityMs: number } {
  return {
    writingMs: parseTimeoutMs(env.LLM_TIMEOUT_MS, DEFAULT_WRITING_TIMEOUT_MS),
    utilityMs: parseTimeoutMs(
      env.LLM_UTILITY_TIMEOUT_MS,
      DEFAULT_UTILITY_TIMEOUT_MS,
    ),
  };
}

// The generation lease must outlast the worst case for one step: a writing call
// plus its provider fallback, a utility repair plus its fallback, and the
// coherence call plus its fallback. Derived from the configured timeouts so a
// larger LLM_TIMEOUT_MS cannot let the lease expire mid step.
export function generationLeaseMs(timeouts: {
  writingMs: number;
  utilityMs: number;
}): number {
  const budget =
    2 * timeouts.writingMs + 4 * timeouts.utilityMs + 30_000;
  return Math.min(
    Math.max(60_000, budget),
    MAX_GENERATION_LEASE_MS,
  );
}

export type CheckoutConfig = {
  mongodbUri: string;
  bachsApiKey: string;
  bachsWebhookSecret: string;
  bachsApiBaseUrl: string;
  bachsProductId?: string;
  appBaseUrl: string;
  recoveryTokenPepper: string;
};

const CHECKOUT_KEYS = [
  "MONGODB_URI",
  "BACHS_API_KEY",
  "BACHS_WEBHOOK_SECRET",
  "BACHS_API_BASE_URL",
  "APP_BASE_URL",
  "RECOVERY_TOKEN_PEPPER",
] as const;

export function parseCheckoutConfig(
  env: Record<string, string | undefined> = process.env,
): CheckoutConfig {
  for (const key of CHECKOUT_KEYS) {
    if (!env[key]?.trim()) {
      throw new Error(`Missing required server configuration: ${key}`);
    }
  }
  return {
    mongodbUri: env.MONGODB_URI!.trim(),
    bachsApiKey: env.BACHS_API_KEY!.trim(),
    bachsWebhookSecret: env.BACHS_WEBHOOK_SECRET!.trim(),
    bachsApiBaseUrl: env.BACHS_API_BASE_URL!.replace(/\/$/, ""),
    bachsProductId: optionalSecret(env, "BACHS_PRODUCT_ID"),
    appBaseUrl: env.APP_BASE_URL!.trim().replace(/\/$/, ""),
    recoveryTokenPepper: env.RECOVERY_TOKEN_PEPPER!.trim(),
  };
}

// Describes a malformed MONGODB_URI without revealing it (it holds the
// database password), so a paste mistake in the host's settings can be
// diagnosed from the logs.
function describeMongoUri(value: string): string {
  const facts = [
    `length ${value.length}`,
    /^["'`]/.test(value) ? "starts with a quote" : "",
    /^[A-Z_]+=/.test(value) ? "starts with a variable name and =" : "",
    /^mongosh\b/.test(value) ? "is a mongosh command" : "",
    /mongodb(\+srv)?:\/\//.test(value)
      ? `contains a mongodb scheme at position ${value.search(/mongodb(\+srv)?:\/\//)}`
      : "contains no mongodb scheme",
    /<db_(username|password)>/.test(value) ? "still has <db_username>/<db_password> placeholders" : "",
  ];
  return facts.filter(Boolean).join(", ");
}

export function parseMongoConfig(
  env: Record<string, string | undefined> = process.env,
): { mongodbUri: string } {
  const mongodbUri = env.MONGODB_URI?.trim();
  if (!mongodbUri) {
    throw new Error("Missing required server configuration: MONGODB_URI");
  }
  if (!/^mongodb(\+srv)?:\/\//.test(mongodbUri) || /<db_(username|password)>/.test(mongodbUri)) {
    throw new Error(
      `Invalid server configuration: MONGODB_URI must be the driver connection string (mongodb+srv://user:password@host/db); the configured value ${describeMongoUri(mongodbUri)}`,
    );
  }
  return { mongodbUri };
}

export function getCheckoutConfig(): CheckoutConfig {
  return parseCheckoutConfig();
}

export function getResearchRuntimeSecrets(): ResearchRuntimeSecrets {
  return parseResearchRuntimeSecrets();
}
