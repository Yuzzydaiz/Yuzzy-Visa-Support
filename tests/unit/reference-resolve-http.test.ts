import { describe, expect, it, beforeEach } from "vitest";

import { handleReferenceResolve } from "@/lib/research/references/http";
import { resetResolveRateLimit } from "@/lib/research/http/rateLimitStub";
import { referenceAllowsReview, type DraftReference } from "@/lib/research/draft";
import type { ResolvedReference } from "@/lib/research/references/resolve";

const env = { CROSSREF_CONTACT_EMAIL: "ops@example.com" };

const verified: ResolvedReference = {
  originalInput: "10.1038/nature12373",
  inputType: "doi",
  verificationStatus: "verified",
  contentStatus: "abstract",
  matched: {
    title: "A fake but stable climate meta analysis",
    authors: ["Ada Example"],
    year: 2020,
    doi: "10.1038/nature12373",
    provider: "crossref",
  },
  candidates: [],
};

describe("handleReferenceResolve", () => {
  beforeEach(() => {
    resetResolveRateLimit();
  });

  it("returns public verified fields without provider payloads", async () => {
    const result = await handleReferenceResolve({
      ip: "203.0.113.1",
      env,
      body: { references: [{ originalInput: "10.1038/nature12373" }] },
      resolve: async () => [verified],
    });
    expect(result.status).toBe(200);
    const body = result.body as { results: Array<Record<string, unknown>> };
    expect(body.results[0]?.verificationStatus).toBe("verified");
    expect(JSON.stringify(body)).not.toContain("message-type");
  });

  it("rejects an empty body", async () => {
    const result = await handleReferenceResolve({
      ip: "203.0.113.2",
      env,
      body: { references: [] },
      resolve: async () => [],
    });
    expect(result.status).toBe(422);
  });
});

describe("referenceAllowsReview", () => {
  it("requires a verified match", () => {
    const pending: DraftReference = {
      id: "1",
      originalInput: "10.1038/nature12373",
      userProvidedNotes: "",
      verificationStatus: "pending",
    };
    const verifiedRef: DraftReference = {
      ...pending,
      verificationStatus: "verified",
      matched: verified.matched,
    };
    expect(referenceAllowsReview(pending)).toBe(false);
    expect(referenceAllowsReview(verifiedRef)).toBe(true);
  });
});
