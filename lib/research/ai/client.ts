import "server-only";

export type LlmUsage = {
  inputTokens: number;
  outputTokens: number;
};

export type LlmResult = {
  text: string;
  usage: LlmUsage;
  requestId?: string;
};

export type LlmJsonSchema = {
  name: string;
  schema: Record<string, unknown>;
};

export type LlmClient = {
  completeJson: (input: {
    model: string;
    system: string;
    user: string;
    maxTokens: number;
    schema?: LlmJsonSchema;
    timeoutMs?: number;
  }) => Promise<LlmResult>;
};

export const DEFAULT_LLM_TIMEOUT_MS = 60_000;
export const DEFAULT_LLM_UTILITY_TIMEOUT_MS = 30_000;

export type LlmApiStyle = "responses" | "chat_completions";

export type LlmProviderConfig = {
  name: "openai" | "openrouter";
  apiKey: string;
  baseUrl: string;
  apiStyle: LlmApiStyle;
  writingModel: string;
  utilityModel: string;
};

export type LlmConfig = {
  providers: LlmProviderConfig[];
  writingModel: string;
  utilityModel: string;
};

export type LlmProviderSpec = {
  name: string;
  apiKey: string;
  baseUrl: string;
  apiStyle: LlmApiStyle;
  modelMap?: Record<string, string>;
  extraBody?: Record<string, unknown>;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

type LlmError = Error & {
  retryable?: boolean;
  fallbackable?: boolean;
  status?: number;
};

function httpError(provider: string, status: number, detail: string): LlmError {
  const err = new Error(
    `${provider} request failed (${status})${detail ? `: ${detail}` : ""}`,
  ) as LlmError;
  err.status = status;
  err.retryable = status >= 500 || status === 429 || status === 408;
  err.fallbackable =
    err.retryable || status === 401 || status === 403 || status === 404;
  return err;
}

function networkError(provider: string, error: unknown): LlmError {
  const err = new Error(
    `${provider} request failed: ${
      error instanceof Error ? error.message : "network error"
    }`,
  ) as LlmError;
  err.retryable = true;
  err.fallbackable = true;
  return err;
}

function emptyResultError(provider: string, detail: string): LlmError {
  const err = new Error(`${provider} returned no content${detail ? `: ${detail}` : ""}`) as LlmError;
  err.retryable = false;
  err.fallbackable = true;
  return err;
}

async function readErrorDetail(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.length > 300 ? `${text.slice(0, 300)}…` : text;
  } catch {
    return "";
  }
}

async function completeResponses(input: {
  provider: string;
  fetchImpl: typeof fetch;
  base: string;
  apiKey: string;
  model: string;
  system: string;
  user: string;
  maxTokens: number;
  schema?: LlmJsonSchema;
  signal?: AbortSignal;
}): Promise<LlmResult> {
  const response = await input.fetchImpl(`${input.base}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    signal: input.signal,
    body: JSON.stringify({
      model: input.model,
      max_output_tokens: input.maxTokens,
      input: [
        { role: "system", content: input.system },
        { role: "user", content: input.user },
      ],
      text: {
        format: input.schema
          ? {
              type: "json_schema",
              name: input.schema.name,
              strict: true,
              schema: input.schema.schema,
            }
          : { type: "json_object" },
      },
    }),
  });
  if (!response.ok) {
    throw httpError(
      input.provider,
      response.status,
      await readErrorDetail(response),
    );
  }
  const json = (await response.json()) as {
    id?: string;
    output_text?: string;
    usage?: { input_tokens?: number; output_tokens?: number };
    output?: Array<{
      content?: Array<{ type?: string; text?: string; refusal?: string }>;
    }>;
  };
  const text =
    json.output_text ??
    json.output
      ?.flatMap((item) => item.content ?? [])
      .find((item) => item.type === "output_text" && item.text)?.text;
  if (!text) {
    const refusal = json.output
      ?.flatMap((item) => item.content ?? [])
      .find((item) => item.refusal)?.refusal;
    throw emptyResultError(input.provider, refusal ?? "");
  }
  return {
    text,
    requestId: json.id,
    usage: {
      inputTokens: json.usage?.input_tokens ?? 0,
      outputTokens: json.usage?.output_tokens ?? 0,
    },
  };
}

async function completeChatCompletions(input: {
  provider: string;
  fetchImpl: typeof fetch;
  base: string;
  apiKey: string;
  model: string;
  system: string;
  user: string;
  maxTokens: number;
  schema?: LlmJsonSchema;
  extraBody?: Record<string, unknown>;
  signal?: AbortSignal;
}): Promise<LlmResult> {
  const response = await input.fetchImpl(`${input.base}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    signal: input.signal,
    body: JSON.stringify({
      model: input.model,
      messages: [
        { role: "system", content: input.system },
        { role: "user", content: input.user },
      ],
      max_tokens: input.maxTokens,
      response_format: input.schema
        ? {
            type: "json_schema",
            json_schema: {
              name: input.schema.name,
              strict: true,
              schema: input.schema.schema,
            },
          }
        : { type: "json_object" },
      ...(input.extraBody ?? {}),
    }),
  });
  if (!response.ok) {
    throw httpError(
      input.provider,
      response.status,
      await readErrorDetail(response),
    );
  }
  const json = (await response.json()) as {
    id?: string;
    error?: { message?: string };
    choices?: Array<{
      message?: { content?: string | null; refusal?: string | null };
      error?: { message?: string };
    }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  if (json.error?.message) {
    throw emptyResultError(input.provider, json.error.message);
  }
  const choice = json.choices?.[0];
  if (choice?.error?.message) {
    throw emptyResultError(input.provider, choice.error.message);
  }
  const text = choice?.message?.content;
  if (!text) {
    throw emptyResultError(input.provider, choice?.message?.refusal ?? "");
  }
  return {
    text,
    requestId: json.id,
    usage: {
      inputTokens: json.usage?.prompt_tokens ?? 0,
      outputTokens: json.usage?.completion_tokens ?? 0,
    },
  };
}

export function createLlmProviderClient(spec: LlmProviderSpec): LlmClient {
  const base = spec.baseUrl.replace(/\/+$/, "");
  const fetchImpl = spec.fetchImpl ?? fetch;
  return {
    async completeJson({ model, system, user, maxTokens, schema, timeoutMs }) {
      const resolvedModel = spec.modelMap?.[model] ?? model;
      const timeout = timeoutMs ?? spec.timeoutMs ?? DEFAULT_LLM_TIMEOUT_MS;
      const signal =
        timeout > 0 ? AbortSignal.timeout(timeout) : undefined;
      try {
        if (spec.apiStyle === "chat_completions") {
          return await completeChatCompletions({
            provider: spec.name,
            fetchImpl,
            base,
            apiKey: spec.apiKey,
            model: resolvedModel,
            system,
            user,
            maxTokens,
            schema,
            extraBody: spec.extraBody,
            signal,
          });
        }
        return await completeResponses({
          provider: spec.name,
          fetchImpl,
          base,
          apiKey: spec.apiKey,
          model: resolvedModel,
          system,
          user,
          maxTokens,
          schema,
          signal,
        });
      } catch (error) {
        if (
          error &&
          typeof error === "object" &&
          "fallbackable" in error
        ) {
          throw error;
        }
        const name = (error as { name?: string } | undefined)?.name;
        if (name === "AbortError" || name === "TimeoutError") {
          const err = new Error(
            `${spec.name} request timed out after ${timeout}ms`,
          ) as LlmError;
          err.retryable = true;
          err.fallbackable = true;
          throw err;
        }
        throw networkError(spec.name, error);
      }
    },
  };
}

export function createFallbackLlmClient(clients: LlmClient[]): LlmClient {
  if (!clients.length) {
    throw new Error("No LLM providers configured");
  }
  return {
    async completeJson(input) {
      let lastError: unknown;
      for (let index = 0; index < clients.length; index += 1) {
        try {
          return await clients[index].completeJson(input);
        } catch (error) {
          lastError = error;
          const fallbackable = Boolean(
            error &&
              typeof error === "object" &&
              (error as LlmError).fallbackable,
          );
          if (!fallbackable || index === clients.length - 1) {
            throw error;
          }
        }
      }
      throw lastError instanceof Error
        ? lastError
        : new Error("LLM request failed");
    },
  };
}

export function createLlmClientFromConfig(config: LlmConfig): LlmClient {
  const primary = config.providers[0];
  const specs: LlmProviderSpec[] = config.providers.map((provider, index) => ({
    name: provider.name,
    apiKey: provider.apiKey,
    baseUrl: provider.baseUrl,
    apiStyle: provider.apiStyle,
    extraBody:
      provider.name === "openrouter"
        ? { provider: { require_parameters: true } }
        : undefined,
    modelMap:
      index === 0
        ? undefined
        : {
            [primary.writingModel]: provider.writingModel,
            [primary.utilityModel]: provider.utilityModel,
          },
  }));
  return createFallbackLlmClient(specs.map(createLlmProviderClient));
}

export function createOpenAiClient(input: {
  apiKey: string;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  apiStyle?: LlmApiStyle;
  modelMap?: Record<string, string>;
}): LlmClient {
  return createLlmProviderClient({
    name: "openai",
    apiKey: input.apiKey,
    baseUrl: input.baseUrl ?? "https://api.openai.com/v1",
    apiStyle: input.apiStyle ?? "responses",
    fetchImpl: input.fetchImpl,
    modelMap: input.modelMap,
  });
}
