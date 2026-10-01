import "server-only";

import { connectMongo } from "@/lib/db/mongodb";
import { RateLimit } from "@/lib/models/RateLimit";

const WINDOW_MS = 10 * 60 * 1000;

export type ResearchRateBucket =
  | "resolve"
  | "discover"
  | "orders"
  | "orders-retry"
  | "generate-next"
  | "regenerate"
  | "patch"
  | "export";

const LIMITS: Record<ResearchRateBucket, { ip?: number; paper?: number }> = {
  resolve: { ip: 30 },
  discover: { ip: 30 },
  orders: { ip: 10 },
  "orders-retry": { ip: 10 },
  "generate-next": { ip: 40, paper: 80 },
  regenerate: { ip: 10, paper: 8 },
  patch: { paper: 120 },
  export: { paper: 20 },
};

// In-process fallback. Used in tests and dev, and when the shared store is
// unavailable (fail open rather than block users on a database blip).
const hits = new Map<string, number[]>();

export function resetResearchRateLimit() {
  hits.clear();
}

/** @deprecated use resetResearchRateLimit */
export function resetResolveRateLimit() {
  resetResearchRateLimit();
}

function consumeMemory(key: string, max: number, now: number): boolean {
  const recent = (hits.get(key) ?? []).filter((stamp) => now - stamp < WINDOW_MS);
  if (recent.length >= max) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}

async function consumeMongoOnce(
  key: string,
  max: number,
  now: number,
): Promise<boolean> {
  await connectMongo();
  const window = Math.floor(now / WINDOW_MS);
  const doc = await RateLimit.findOneAndUpdate(
    { key: `${key}:${window}` },
    {
      $inc: { count: 1 },
      $setOnInsert: {
        windowStart: new Date(window * WINDOW_MS),
        // Keep the row until shortly after its window closes; the TTL index
        // removes it for us.
        expiresAt: new Date((window + 2) * WINDOW_MS),
      },
    },
    { upsert: true, returnDocument: "after" },
  );
  return (doc?.count ?? 0) <= max;
}

async function consumeMongo(key: string, max: number, now: number): Promise<boolean> {
  try {
    return await consumeMongoOnce(key, max, now);
  } catch (error) {
    // A concurrent first-time upsert on the same key can raise E11000; the
    // document now exists, so one retry resolves it.
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: number }).code === 11000
    ) {
      return consumeMongoOnce(key, max, now);
    }
    throw error;
  }
}

type RateLimitScope = {
  bucket: string;
  scope: "ip" | "paper";
  id: string;
  max: number;
};

function consumeMemoryScopes(scopes: RateLimitScope[], now: number): boolean {
  for (const scope of scopes) {
    if (!consumeMemory(`${scope.bucket}:${scope.scope}:${scope.id}`, scope.max, now)) {
      return false;
    }
  }
  return true;
}

export function sharedRateLimitEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.RESEARCH_RATE_LIMIT_STORE?.trim() === "mongo";
}

export async function consumeResearchRateLimit(input: {
  bucket: ResearchRateBucket;
  ip?: string;
  paperId?: string;
  now?: number;
}): Promise<boolean> {
  const now = input.now ?? Date.now();
  const limits = LIMITS[input.bucket];
  const scopes: RateLimitScope[] = [];
  if (limits.ip) {
    scopes.push({
      bucket: input.bucket,
      scope: "ip",
      id: input.ip?.trim() || "unknown",
      max: limits.ip,
    });
  }
  if (limits.paper) {
    const paperId = input.paperId?.trim();
    if (paperId) {
      scopes.push({
        bucket: input.bucket,
        scope: "paper",
        id: paperId,
        max: limits.paper,
      });
    }
  }
  if (!scopes.length) {
    return true;
  }

  if (sharedRateLimitEnabled()) {
    for (let index = 0; index < scopes.length; index += 1) {
      const scope = scopes[index];
      let allowed: boolean;
      try {
        allowed = await consumeMongo(
          `${scope.bucket}:${scope.scope}:${scope.id}`,
          scope.max,
          now,
        );
      } catch {
        // Store failed part way through. Fall back to the in-process limiter
        // only for scopes not already consumed, so a scope is never counted
        // twice for one request.
        return consumeMemoryScopes(scopes.slice(index), now);
      }
      if (!allowed) {
        return false;
      }
    }
    return true;
  }

  return consumeMemoryScopes(scopes, now);
}

/** @deprecated use consumeResearchRateLimit({ bucket: "resolve", ip }) */
export async function consumeResolveRateLimit(
  ip: string,
  now = Date.now(),
): Promise<boolean> {
  return consumeResearchRateLimit({ bucket: "resolve", ip, now });
}
