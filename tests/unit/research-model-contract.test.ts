import { describe, expect, it } from "vitest";

import { createOpenAiClient, createLlmProviderClient, createFallbackLlmClient } from "@/lib/research/ai/client";
import { completeJsonWithBackoff } from "@/lib/research/ai/retry";
import { sectionUserPrompt } from "@/lib/research/ai/prompts";
import { generateSectionJson } from "@/lib/research/generation/next";
import type { SourceManifestEntry } from "@/lib/research/generation/manifest";
import type { PaperDocument } from "@/lib/models/Paper";
import type { LlmClient } from "@/lib/research/ai/client";

function words(count: number, cite = "[CITE:ref_01]") {
  return `${Array.from({ length: count }, () => "word").join(" ")} ${cite}`;
}

const manifest: SourceManifestEntry[] = [
  {
    refId: "ref_01",
    title: "Climate synthesis",
    authors: ["Ada Example"],
    evidence: "",
    contentStatus: "abstract",
  },
];

function paper(overrides: Record<string, unknown> = {}): PaperDocument {
  return {
    paperType: "original_research_draft",
    title: "Verified sources in visa-related research writing",
    focus: "Citation practice",
    citationStyle: "apa",
    actualMethodology: "We surveyed 120 applicants at a district office.",
    actualFindings: "Approval timelines shortened by nine days after triage.",
    researchNotes: "Sample drawn from the 2024 pilot cohort.",
    generation: { completedSteps: [], attempts: 0, totalInputTokens: 0, totalOutputTokens: 0, version: 0, bibliography: [] },
    ...overrides,
  } as unknown as PaperDocument;
}

describe("R06 model output contract", () => {
  it("sends a strict json_schema and the exact section id to the provider", async () => {
    let captured: Record<string, unknown> | undefined;
    const client = createOpenAiClient({
      apiKey: "sk-test",
      fetchImpl: (async (_url: string, init: RequestInit) => {
        captured = JSON.parse(String(init.body)) as Record<string, unknown>;
        return new Response(
          JSON.stringify({
            id: "resp_1",
            output_text: JSON.stringify({
              sectionId: "abstract",
              title: "Abstract",
              paragraphs: [{ text: words(120) }],
              usedReferenceIds: ["ref_01"],
              limitations: [],
              wordCountEstimate: 120,
            }),
            usage: { input_tokens: 5, output_tokens: 6 },
          }),
          { status: 200 },
        );
      }) as unknown as typeof fetch,
    });

    await client.completeJson({
      model: "gpt-test",
      system: "draft",
      user: "draft",
      maxTokens: 100,
      schema: { name: "research_section", schema: { type: "object" } },
    });

    const text = captured?.text as { format?: { type?: string; name?: string; strict?: boolean } };
    expect(text?.format?.type).toBe("json_schema");
    expect(text?.format?.name).toBe("research_section");
    expect(text?.format?.strict).toBe(true);
  });

  it("rejects a response whose sectionId does not match the requested section", async () => {
    const client: LlmClient = {
      async completeJson() {
        return {
          text: JSON.stringify({
            sectionId: "introduction",
            title: "Introduction",
            paragraphs: [{ text: words(120) }],
            usedReferenceIds: ["ref_01"],
            limitations: [],
            wordCountEstimate: 120,
          }),
          usage: { inputTokens: 1, outputTokens: 1 },
        };
      },
    };
    await expect(
      generateSectionJson({
        paper: paper(),
        outlineItem: {
          sectionId: "abstract",
          type: "abstract",
          title: "Abstract",
          order: 0,
          arguments: [],
          wordBudget: 150,
          plannedRefIds: ["ref_01"],
        },
        manifest,
        client,
        writingModel: "gpt-test",
        utilityModel: "gpt-test",
      }),
    ).rejects.toMatchObject({ code: "GENERATION_INVALID_OUTPUT" });
  });
});

describe("R07 customer research context", () => {
  it("carries supplied methodology and findings into the section request", async () => {
    let capturedUser = "";
    const client: LlmClient = {
      async completeJson(input: { user: string }) {
        capturedUser = input.user;
        return {
          text: JSON.stringify({
            sectionId: "abstract",
            title: "Abstract",
            paragraphs: [{ text: words(120) }],
            usedReferenceIds: ["ref_01"],
            limitations: [],
            wordCountEstimate: 120,
          }),
          usage: { inputTokens: 1, outputTokens: 1 },
        };
      },
    };
    await generateSectionJson({
      paper: paper(),
      outlineItem: {
        sectionId: "abstract",
        type: "abstract",
        title: "Abstract",
        order: 0,
        arguments: [],
        wordBudget: 150,
        plannedRefIds: ["ref_01"],
      },
      manifest,
      client,
      writingModel: "gpt-test",
      utilityModel: "gpt-test",
    });
    expect(capturedUser).toContain("CUSTOMER_RESEARCH_CONTEXT");
    const parsed = JSON.parse(capturedUser) as {
      customerResearchContext: string;
      sectionId: string;
    };
    expect(parsed.sectionId).toBe("abstract");
    expect(parsed.customerResearchContext).toContain("surveyed 120 applicants");
    expect(parsed.customerResearchContext).toContain("nine days");
  });

  it("labels research context as data, not instructions", () => {
    const prompt = sectionUserPrompt({
      title: "A paper title long enough",
      sectionId: "abstract",
      sectionTitle: "Abstract",
      arguments: [],
      plannedRefIds: ["ref_01"],
      evidence: "",
      researchContext: "<<<CUSTOMER_RESEARCH_CONTEXT>>>\nfindings=x\n<<<END_CUSTOMER_RESEARCH_CONTEXT>>>",
    });
    expect(prompt).toContain("CUSTOMER_RESEARCH_CONTEXT");
  });
});

describe("OpenRouter provider path", () => {
  it("sends chat completions with response_format json_schema", async () => {
    const captured: Array<{ url: string; body: Record<string, unknown> }> = [];
    const client = createLlmProviderClient({
      name: "openrouter",
      apiKey: "sk-or-test",
      baseUrl: "https://openrouter.ai/api/v1/",
      apiStyle: "chat_completions",
      extraBody: { provider: { require_parameters: true } },
      fetchImpl: (async (url: string, init: RequestInit) => {
        captured.push({ url, body: JSON.parse(String(init.body)) });
        return new Response(
          JSON.stringify({
            id: "gen_1",
            choices: [{ message: { content: JSON.stringify({ ok: true }) } }],
            usage: { prompt_tokens: 3, completion_tokens: 4 },
          }),
          { status: 200 },
        );
      }) as unknown as typeof fetch,
    });

    const result = await client.completeJson({
      model: "openai/gpt-5.6-terra",
      system: "s",
      user: "u",
      maxTokens: 50,
      schema: { name: "x", schema: { type: "object" } },
    });

    expect(captured[0]!.url).toBe(
      "https://openrouter.ai/api/v1/chat/completions",
    );
    const body = captured[0]!.body as {
      response_format: { type: string; json_schema: { name: string } };
      max_tokens: number;
      provider: { require_parameters: boolean };
    };
    expect(body.response_format.type).toBe("json_schema");
    expect(body.response_format.json_schema.name).toBe("x");
    expect(body.max_tokens).toBe(50);
    expect(body.provider.require_parameters).toBe(true);
    expect(result.text).toBe(JSON.stringify({ ok: true }));
    expect(result.usage).toEqual({ inputTokens: 3, outputTokens: 4 });
  });

  it("falls back to the next provider on a retryable/insufficient-quota error", async () => {
    let primaryCalls = 0;
    let fallbackCalls = 0;
    const primary = createLlmProviderClient({
      name: "openai",
      apiKey: "sk-primary",
      baseUrl: "https://api.openai.com/v1",
      apiStyle: "responses",
      fetchImpl: (async () => {
        primaryCalls += 1;
        return new Response(
          JSON.stringify({
            error: { code: "credit_balance_exhausted", message: "no credits" },
          }),
          { status: 429 },
        );
      }) as unknown as typeof fetch,
    });
    const fallback = createLlmProviderClient({
      name: "openrouter",
      apiKey: "sk-or-test",
      baseUrl: "https://openrouter.ai/api/v1",
      apiStyle: "chat_completions",
      fetchImpl: (async () => {
        fallbackCalls += 1;
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: '{"ok":true}' } }],
            usage: { prompt_tokens: 1, completion_tokens: 1 },
          }),
          { status: 200 },
        );
      }) as unknown as typeof fetch,
    });

    const client = createFallbackLlmClient([primary, fallback]);
    const result = await client.completeJson({
      model: "gpt-5.6-terra",
      system: "s",
      user: "u",
      maxTokens: 10,
    });

    expect(primaryCalls).toBe(1);
    expect(fallbackCalls).toBe(1);
    expect(result.text).toBe('{"ok":true}');
  });

  it("does not fall back on a non-retryable client error", async () => {
    let fallbackCalls = 0;
    const primary = createLlmProviderClient({
      name: "openai",
      apiKey: "sk-primary",
      baseUrl: "https://api.openai.com/v1",
      apiStyle: "responses",
      fetchImpl: (async () =>
        new Response(JSON.stringify({ error: { message: "bad request" } }), {
          status: 400,
        })) as unknown as typeof fetch,
    });
    const fallback = createLlmProviderClient({
      name: "openrouter",
      apiKey: "sk-or-test",
      baseUrl: "https://openrouter.ai/api/v1",
      apiStyle: "chat_completions",
      fetchImpl: (async () => {
        fallbackCalls += 1;
        return new Response("{}", { status: 200 });
      }) as unknown as typeof fetch,
    });

    const client = createFallbackLlmClient([primary, fallback]);
    await expect(
      client.completeJson({
        model: "gpt-5.6-terra",
        system: "s",
        user: "u",
        maxTokens: 10,
      }),
    ).rejects.toThrow(/400/);
    expect(fallbackCalls).toBe(0);
  });
});

describe("LLM request timeout", () => {
  function hungFetch(): typeof fetch {
    return ((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
      })) as unknown as typeof fetch;
  }

  it("aborts a hung provider request", async () => {
    const client = createLlmProviderClient({
      name: "openai",
      apiKey: "k",
      baseUrl: "https://api.openai.com/v1",
      apiStyle: "responses",
      fetchImpl: hungFetch(),
    });
    await expect(
      client.completeJson({
        model: "m",
        system: "s",
        user: "u",
        maxTokens: 10,
        timeoutMs: 20,
      }),
    ).rejects.toThrow(/timed out/);
  });

  it("falls back to the next provider when the primary times out", async () => {
    let fallbackCalls = 0;
    const primary = createLlmProviderClient({
      name: "openai",
      apiKey: "k",
      baseUrl: "https://api.openai.com/v1",
      apiStyle: "responses",
      fetchImpl: hungFetch(),
    });
    const fallback = createLlmProviderClient({
      name: "openrouter",
      apiKey: "k2",
      baseUrl: "https://openrouter.ai/api/v1",
      apiStyle: "chat_completions",
      fetchImpl: (async () => {
        fallbackCalls += 1;
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: '{"ok":true}' } }],
            usage: { prompt_tokens: 1, completion_tokens: 1 },
          }),
          { status: 200 },
        );
      }) as unknown as typeof fetch,
    });
    const client = createFallbackLlmClient([primary, fallback]);
    const result = await client.completeJson({
      model: "m",
      system: "s",
      user: "u",
      maxTokens: 10,
      timeoutMs: 20,
    });
    expect(fallbackCalls).toBe(1);
    expect(result.text).toBe('{"ok":true}');
  });
});

describe("bounded generation attempts", () => {
  it("does not retry a logical call, keeping one step inside the lease", async () => {
    let calls = 0;
    const client: LlmClient = {
      async completeJson() {
        calls += 1;
        const error = new Error("provider busy") as Error & { retryable?: boolean };
        error.retryable = true;
        throw error;
      },
    };
    await expect(
      completeJsonWithBackoff(client, {
        model: "m",
        system: "s",
        user: "u",
        maxTokens: 10,
      }),
    ).rejects.toThrow(/provider busy/);
    expect(calls).toBe(1);
  });
});
