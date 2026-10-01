export const RESEARCH_ERROR_CODES = [
  "REFERENCE_AMBIGUOUS",
  "REFERENCE_UNRESOLVED",
  "PAYMENT_REQUIRED",
  "PAYMENT_PROCESSING",
  "GENERATION_RETRYABLE",
  "GENERATION_INVALID_OUTPUT",
  "REGENERATION_QUOTA_EXCEEDED",
  "ACCESS_DENIED",
  "VERSION_CONFLICT",
  "SSRF_BLOCKED",
  "RATE_LIMITED",
  "VALIDATION_FAILED",
] as const;

export type ResearchErrorCode = (typeof RESEARCH_ERROR_CODES)[number];

const STATUS_BY_CODE: Record<ResearchErrorCode, number> = {
  REFERENCE_AMBIGUOUS: 422,
  REFERENCE_UNRESOLVED: 422,
  PAYMENT_REQUIRED: 422,
  PAYMENT_PROCESSING: 409,
  GENERATION_RETRYABLE: 503,
  GENERATION_INVALID_OUTPUT: 422,
  REGENERATION_QUOTA_EXCEEDED: 422,
  ACCESS_DENIED: 401,
  VERSION_CONFLICT: 409,
  SSRF_BLOCKED: 422,
  RATE_LIMITED: 429,
  VALIDATION_FAILED: 422,
};

export class ResearchApiError extends Error {
  readonly code: ResearchErrorCode;
  readonly status: number;
  readonly requestId: string;
  readonly details?: Record<string, unknown>;

  constructor(input: {
    code: ResearchErrorCode;
    message: string;
    requestId: string;
    status?: number;
    details?: Record<string, unknown>;
  }) {
    super(input.message);
    this.name = "ResearchApiError";
    this.code = input.code;
    this.status = input.status ?? STATUS_BY_CODE[input.code];
    this.requestId = input.requestId;
    this.details = sanitizeDetails(input.details);
  }
}

function sanitizeDetails(
  details: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!details) {
    return undefined;
  }
  const blocked = new Set(["_id", "stack", "secret", "token", "accessTokenHash"]);
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details)) {
    if (blocked.has(key)) {
      continue;
    }
    next[key] = value;
  }
  return next;
}

export function createRequestId(): string {
  return crypto.randomUUID();
}

export function researchErrorBody(error: ResearchApiError) {
  return {
    code: error.code,
    message: error.message,
    requestId: error.requestId,
    details: error.details,
  };
}

export function httpStatusForCode(code: ResearchErrorCode): number {
  return STATUS_BY_CODE[code];
}
