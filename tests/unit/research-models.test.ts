import mongoose from "mongoose";
import { describe, expect, it } from "vitest";

import { Order } from "@/lib/models/Order";
import { Paper } from "@/lib/models/Paper";

function validOrder(overrides: Record<string, unknown> = {}) {
  return new Order({
    publicId: "ord_test_1",
    paperId: new mongoose.Types.ObjectId(),
    customerEmail: "buyer@example.com",
    requestedPages: 10,
    wordsPerPage: 300,
    targetWords: 3000,
    unitPriceCents: 25000,
    subtotalCents: 250000,
    minimumChargeCents: 250000,
    chargedAmountCents: 250000,
    currency: "NGN",
    provider: "bachs",
    status: "created",
    idempotencyKey: "idem_1",
    ...overrides,
  });
}

function validPaper(overrides: Record<string, unknown> = {}) {
  return new Paper({
    publicId: "pap_test_1",
    customerEmail: "buyer@example.com",
    accessTokenHash: "hash",
    title: "Verified sources in visa-related research writing",
    focus: "How literature reviews should cite verified academic sources",
    paperType: "literature_review",
    authors: [{ name: "Ada Example" }],
    citationStyle: "apa",
    requestedPages: 10,
    targetWords: 3000,
    allowAdditionalSources: false,
    status: "draft",
    ...overrides,
  });
}

describe("Order model", () => {
  it("accepts a valid document", async () => {
    await expect(validOrder().validate()).resolves.toBeUndefined();
  });

  it("rejects missing charged amount", async () => {
    await expect(
      validOrder({ chargedAmountCents: undefined }).validate(),
    ).rejects.toThrow();
  });
});

describe("Paper model", () => {
  it("accepts a valid document", async () => {
    await expect(validPaper().validate()).resolves.toBeUndefined();
  });

  it("rejects a missing title", async () => {
    await expect(validPaper({ title: undefined }).validate()).rejects.toThrow();
  });

  it("rejects an unknown paper type", async () => {
    await expect(validPaper({ paperType: "blog_post" }).validate()).rejects.toThrow();
  });

  it("stores access token hash rather than a raw token field", () => {
    const paper = validPaper();
    expect(paper.accessTokenHash).toBe("hash");
    expect("accessToken" in paper.toObject()).toBe(false);
  });
});
