import { describe, expect, it } from "vitest";

import {
  InvalidStateTransitionError,
  applyStatusAndExtra,
  assertOrderTransition,
  assertPaperTransition,
  canTransitionOrder,
  canTransitionPaper,
  orderOwnsPaper,
  planPaymentSuccess,
} from "@/lib/research/state/orderTransitions";
import type { OrderStatus } from "@/lib/models/Order";
import type { PaperStatus } from "@/lib/models/Paper";

const orderEdges: Array<[OrderStatus, OrderStatus]> = [
  ["created", "checkout_created"],
  ["created", "failed"],
  ["checkout_created", "processing"],
  ["checkout_created", "paid"],
  ["checkout_created", "failed"],
  ["checkout_created", "expired"],
  ["processing", "paid"],
  ["processing", "failed"],
  ["paid", "refunded"],
];

const paperEdges: Array<[PaperStatus, PaperStatus]> = [
  ["draft", "awaiting_payment"],
  ["awaiting_payment", "ready"],
  ["ready", "generating"],
  ["generating", "completed"],
  ["generating", "failed"],
  ["failed", "generating"],
];

describe("order transitions", () => {
  it.each(orderEdges)("allows %s -> %s", (from, to) => {
    expect(canTransitionOrder(from, to)).toBe(true);
    expect(() => assertOrderTransition(from, to)).not.toThrow();
  });

  it("rejects illegal order transitions", () => {
    expect(() => assertOrderTransition("created", "paid")).toThrow(
      InvalidStateTransitionError,
    );
    expect(() => assertOrderTransition("paid", "processing")).toThrow(
      InvalidStateTransitionError,
    );
    expect(() => assertOrderTransition("refunded", "paid")).toThrow(
      InvalidStateTransitionError,
    );
  });
});

describe("paper transitions", () => {
  it.each(paperEdges)("allows %s -> %s", (from, to) => {
    expect(canTransitionPaper(from, to)).toBe(true);
    expect(() => assertPaperTransition(from, to)).not.toThrow();
  });

  it("rejects illegal paper transitions", () => {
    expect(() => assertPaperTransition("draft", "ready")).toThrow(
      InvalidStateTransitionError,
    );
    expect(() => assertPaperTransition("completed", "generating")).toThrow(
      InvalidStateTransitionError,
    );
  });
});

describe("planPaymentSuccess", () => {
  it("applies paid + ready from checkout_created and awaiting_payment", () => {
    expect(planPaymentSuccess("checkout_created", "awaiting_payment")).toEqual({
      kind: "apply",
      orderTo: "paid",
      paperTo: "ready",
    });
  });

  it("is a no-op when already paid", () => {
    expect(planPaymentSuccess("paid", "ready")).toEqual({ kind: "already_done" });
    expect(planPaymentSuccess("paid", "generating")).toEqual({
      kind: "already_done",
    });
  });

  it("still applies paper unlock when the order is already paid", () => {
    expect(planPaymentSuccess("paid", "awaiting_payment")).toEqual({
      kind: "apply",
      orderTo: "paid",
      paperTo: "ready",
    });
  });
});

describe("applyStatusAndExtra", () => {
  it("keeps the intended status if extra tries to overwrite it", () => {
    const doc = { status: "created", checkoutSessionId: "" };
    applyStatusAndExtra(doc, "checkout_created", {
      status: "paid",
      checkoutSessionId: "cs_1",
    });
    expect(doc.status).toBe("checkout_created");
    expect(doc.checkoutSessionId).toBe("cs_1");
  });
});

describe("orderOwnsPaper", () => {
  it("requires matching ids", () => {
    expect(orderOwnsPaper({ toString: () => "a" }, { toString: () => "b" })).toBe(
      false,
    );
  });
});
