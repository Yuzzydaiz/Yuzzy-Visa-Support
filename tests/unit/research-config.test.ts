import { describe, expect, it } from "vitest";

import {
  generationLeaseMs,
  parseCheckoutConfig,
  parseLlmTimeouts,
  parseResearchRuntimeSecrets,
  parseUtilityLlmConfig,
  parseWritingLlmConfig,
} from "@/lib/config/research";
import {
  DEFAULT_UTILITY_MODEL,
  DEFAULT_WRITING_MODEL,
  calculateOrderPricing,
  parseResearchProductConfig,
} from "@/lib/config/research-product";

const productDefaults = parseResearchProductConfig({});

describe("research product config", () => {
  it("pins Terra and Luna model ids by default", () => {
    expect(productDefaults.maxAdditionalSources).toBe(5);
    expect(productDefaults.writingModel).toBe(DEFAULT_WRITING_MODEL);
    expect(productDefaults.utilityModel).toBe(DEFAULT_UTILITY_MODEL);
    expect(productDefaults.writingModel).toBe("gpt-5.6-terra");
    expect(productDefaults.utilityModel).toBe("gpt-5.6-luna");
  });

  it("rejects the bare gpt-5.6 alias", () => {
    expect(() =>
      parseResearchProductConfig({ OPENAI_WRITING_MODEL: "gpt-5.6" }),
    ).toThrow(/bare gpt-5.6/);
  });

  it("keeps wizard steps strict unless the public flag is false", () => {
    expect(parseResearchProductConfig({}).wizardStrict).toBe(true);
    expect(
      parseResearchProductConfig({
        NEXT_PUBLIC_RESEARCH_WIZARD_STRICT: "true",
      }).wizardStrict,
    ).toBe(true);
    expect(
      parseResearchProductConfig({
        NEXT_PUBLIC_RESEARCH_WIZARD_STRICT: "false",
      }).wizardStrict,
    ).toBe(false);
  });
});

describe("calculateOrderPricing", () => {
  it("charges page count times unit price when above the minimum", () => {
    const pricing = calculateOrderPricing(12, productDefaults);
    expect(pricing.targetWords).toBe(3600);
    expect(pricing.subtotalCents).toBe(300000);
    expect(pricing.chargedAmountCents).toBe(300000);
  });

  it("applies the ₦2,500 minimum below 10 pages when config allows fewer pages", () => {
    const config = parseResearchProductConfig({ MIN_PAGES: "1" });
    const pricing = calculateOrderPricing(4, config);
    expect(pricing.subtotalCents).toBe(100000);
    expect(pricing.chargedAmountCents).toBe(250000);
  });

  it("uses the 10-page default floor of ₦2,500", () => {
    const pricing = calculateOrderPricing(10, productDefaults);
    expect(pricing.chargedAmountCents).toBe(250000);
    expect(pricing.targetWords).toBe(3000);
  });
});

describe("parseResearchRuntimeSecrets", () => {
  const complete = {
    MONGODB_URI: "mongodb://localhost/test",
    OPENAI_API_KEY: "sk-test",
    BACHS_API_KEY: "bachs-key",
    BACHS_WEBHOOK_SECRET: "whsec",
    BACHS_API_BASE_URL: "https://sandbox.bachs.example",
    APP_BASE_URL: "http://localhost:3000",
    RECOVERY_TOKEN_PEPPER: "pepper",
    CROSSREF_CONTACT_EMAIL: "ops@example.com",
  };

  it("fails closed when a required secret is missing", () => {
    expect(() => parseResearchRuntimeSecrets({})).toThrow(
      /Missing required server configuration: MONGODB_URI/,
    );
    expect(() =>
      parseResearchRuntimeSecrets({ ...complete, OPENAI_API_KEY: "" }),
    ).toThrow(/OPENAI_API_KEY/);
  });

  it("loads required secrets without exposing optional empties", () => {
    const secrets = parseResearchRuntimeSecrets(complete);
    expect(secrets.mongodbUri).toBe(complete.MONGODB_URI);
    expect(secrets.openalexApiKey).toBeUndefined();
  });
});

describe("split research configs", () => {
  it("requires OpenAI only for the utility helper", () => {
    expect(() => parseUtilityLlmConfig({})).toThrow(/OPENAI_API_KEY/);
    expect(
      parseUtilityLlmConfig({ OPENAI_API_KEY: "sk-test" }).utilityModel,
    ).toBe(DEFAULT_UTILITY_MODEL);
  });

  it("splits writing models from OpenAI without checkout secrets", () => {
    const writing = parseWritingLlmConfig({ OPENAI_API_KEY: "sk-test" });
    expect(writing.writingModel).toBe(DEFAULT_WRITING_MODEL);
    expect(writing.utilityModel).toBe(DEFAULT_UTILITY_MODEL);
  });

  it("requires checkout secrets without OpenAI", () => {
    expect(() => parseCheckoutConfig({})).toThrow(/MONGODB_URI/);
    expect(
      parseCheckoutConfig({
        MONGODB_URI: "mongodb://localhost/test",
        BACHS_API_KEY: "k",
        BACHS_WEBHOOK_SECRET: "s",
        BACHS_API_BASE_URL: "https://sandbox-api.bachs.io",
        APP_BASE_URL: "http://localhost:3000",
        RECOVERY_TOKEN_PEPPER: "p",
      }).bachsApiKey,
    ).toBe("k");
  });
});

describe("LLM provider fallback config", () => {
  it("uses OpenAI as primary and OpenRouter as fallback when both keys exist", () => {
    const writing = parseWritingLlmConfig({
      OPENAI_API_KEY: "sk-openai",
      OPENROUTER_API_KEY: "sk-or-test",
    });
    expect(writing.llm.providers.map((p) => p.name)).toEqual([
      "openai",
      "openrouter",
    ]);
    expect(writing.llm.providers[0]!.apiStyle).toBe("responses");
    expect(writing.llm.providers[0]!.baseUrl).toBe("https://api.openai.com/v1");
    expect(writing.llm.providers[1]!.apiStyle).toBe("chat_completions");
    expect(writing.llm.providers[1]!.baseUrl).toBe(
      "https://openrouter.ai/api/v1",
    );
    expect(writing.llm.providers[1]!.writingModel).toBe("openai/gpt-5.6-terra");
    expect(writing.writingModel).toBe("gpt-5.6-terra");
  });

  it("runs OpenRouter alone when it is the only key", () => {
    const writing = parseWritingLlmConfig({ OPENROUTER_API_KEY: "sk-or-test" });
    expect(writing.llm.providers).toHaveLength(1);
    expect(writing.llm.providers[0]!.name).toBe("openrouter");
    expect(writing.writingModel).toBe("openai/gpt-5.6-terra");
    expect(writing.utilityModel).toBe("openai/gpt-5.6-luna");
  });

  it("accepts LLM_API_KEY as the OpenRouter alias", () => {
    const utility = parseUtilityLlmConfig({ LLM_API_KEY: "sk-or-alias" });
    expect(utility.llm.providers[0]!.name).toBe("openrouter");
  });

  it("can invert the order with LLM_PRIMARY=openrouter", () => {
    const writing = parseWritingLlmConfig({
      OPENAI_API_KEY: "sk-openai",
      OPENROUTER_API_KEY: "sk-or-test",
      LLM_PRIMARY: "openrouter",
    });
    expect(writing.llm.providers.map((p) => p.name)).toEqual([
      "openrouter",
      "openai",
    ]);
    expect(writing.writingModel).toBe("openai/gpt-5.6-terra");
  });
});

describe("generation lease budget", () => {
  it("outlasts the worst case single step for the configured timeouts", () => {
    const timeouts = parseLlmTimeouts({});
    const worstCase =
      2 * timeouts.writingMs + 4 * timeouts.utilityMs;
    expect(generationLeaseMs(timeouts)).toBeGreaterThan(worstCase);
  });

  it("grows with a larger configured timeout while staying inside the route budget", () => {
    const timeouts = parseLlmTimeouts({
      LLM_TIMEOUT_MS: "120000",
      LLM_UTILITY_TIMEOUT_MS: "60000",
    });
    const worstCase = 2 * timeouts.writingMs + 4 * timeouts.utilityMs;
    expect(generationLeaseMs(timeouts)).toBeGreaterThan(worstCase);
    expect(generationLeaseMs(timeouts)).toBeLessThanOrEqual(300_000);
  });

  it("never exceeds the route maxDuration even with very large configured timeouts", () => {
    const timeouts = parseLlmTimeouts({
      LLM_TIMEOUT_MS: "600000",
      LLM_UTILITY_TIMEOUT_MS: "600000",
    });
    const lease = generationLeaseMs(timeouts);
    expect(lease).toBeLessThanOrEqual(300_000);
    expect(lease).toBeGreaterThan(2 * timeouts.writingMs + 4 * timeouts.utilityMs);
  });
});
