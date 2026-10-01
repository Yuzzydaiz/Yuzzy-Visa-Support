import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const ACCESS_COOKIE = "yuzzy_research_access";

export function createAccessToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashAccessToken(raw: string, pepper: string): string {
  return createHash("sha256").update(`${pepper}:${raw}`).digest("hex");
}

export function accessTokensMatch(
  raw: string | undefined,
  hash: string,
  pepper: string,
): boolean {
  if (!raw) {
    return false;
  }
  const actual = Buffer.from(hashAccessToken(raw, pepper), "hex");
  const expected = Buffer.from(hash, "hex");
  if (actual.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(actual, expected);
}

export function accessCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  };
}
