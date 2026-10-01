import { describe, expect, it } from "vitest";

import {
  accessTokensMatch,
  hashAccessToken,
} from "@/lib/research/auth/accessToken";

describe("access tokens", () => {
  it("matches the same raw token and pepper", () => {
    const hash = hashAccessToken("raw-token", "pepper");
    expect(accessTokensMatch("raw-token", hash, "pepper")).toBe(true);
  });

  it("rejects a mismatched token", () => {
    const hash = hashAccessToken("raw-token", "pepper");
    expect(accessTokensMatch("other-token", hash, "pepper")).toBe(false);
    expect(accessTokensMatch(undefined, hash, "pepper")).toBe(false);
  });
});
