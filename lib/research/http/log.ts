const EXTRA_ALLOW = new Set([
  "inputTokens",
  "outputTokens",
  "stepId",
  "format",
  "code",
  "alreadyPaid",
  "verificationStatus",
  "matchedCount",
]);

const BLOCKED = new Set([
  "token",
  "accessToken",
  "accessTokenHash",
  "secret",
  "body",
  "abstract",
  "stack",
  "_id",
]);

export type ResearchLogInput = {
  requestId: string;
  operation: string;
  publicPaperId?: string;
  publicOrderId?: string;
  status: number | string;
  durationMs: number;
  extra?: Record<string, unknown>;
};

export function sanitizeResearchLogExtra(
  extra: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!extra) {
    return undefined;
  }
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(extra)) {
    if (BLOCKED.has(key) || !EXTRA_ALLOW.has(key)) {
      continue;
    }
    next[key] = value;
  }
  return Object.keys(next).length ? next : undefined;
}

export function researchLog(input: ResearchLogInput) {
  const line = {
    scope: "research",
    requestId: input.requestId,
    operation: input.operation,
    publicPaperId: input.publicPaperId,
    publicOrderId: input.publicOrderId,
    status: input.status,
    durationMs: input.durationMs,
    extra: sanitizeResearchLogExtra(input.extra),
  };
  console.info(JSON.stringify(line));
}

let tokenDay = "";
let tokenTotal = 0;
let tokenWarned = false;

export function resetResearchTokenTotals() {
  tokenDay = "";
  tokenTotal = 0;
  tokenWarned = false;
}

export function recordTokenUsage(
  usage: { inputTokens?: number; outputTokens?: number },
  env: Record<string, string | undefined> = process.env,
) {
  const warnRaw = env.RESEARCH_DAILY_TOKEN_WARN?.trim();
  if (!warnRaw) {
    return;
  }
  const warnAt = Number.parseInt(warnRaw, 10);
  if (!Number.isFinite(warnAt) || warnAt < 1) {
    return;
  }
  const day = new Date().toISOString().slice(0, 10);
  if (tokenDay !== day) {
    tokenDay = day;
    tokenTotal = 0;
    tokenWarned = false;
  }
  tokenTotal += (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0);
  if (!tokenWarned && tokenTotal >= warnAt) {
    tokenWarned = true;
    researchLog({
      requestId: "openai_daily_warn",
      operation: "openai_daily_warn",
      status: "warn",
      durationMs: 0,
      extra: { inputTokens: tokenTotal },
    });
  }
}
