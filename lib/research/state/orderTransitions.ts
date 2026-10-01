import "server-only";

import type { ClientSession } from "mongoose";

import { Order, type OrderStatus } from "@/lib/models/Order";
import { Paper, type PaperStatus } from "@/lib/models/Paper";

export class InvalidStateTransitionError extends Error {
  readonly code = "VERSION_CONFLICT";

  constructor(
    readonly entity: "order" | "paper",
    readonly from: string,
    readonly to: string,
  ) {
    super(`Invalid ${entity} transition from ${from} to ${to}`);
    this.name = "InvalidStateTransitionError";
  }
}

const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  created: ["checkout_created", "failed"],
  checkout_created: ["processing", "paid", "failed", "expired"],
  processing: ["paid", "failed"],
  paid: ["refunded"],
  failed: [],
  expired: [],
  refunded: [],
};

const PAPER_TRANSITIONS: Record<PaperStatus, readonly PaperStatus[]> = {
  draft: ["awaiting_payment"],
  awaiting_payment: ["ready"],
  ready: ["generating"],
  generating: ["completed", "failed"],
  failed: ["generating"],
  completed: [],
};

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

export function canTransitionPaper(from: PaperStatus, to: PaperStatus): boolean {
  return PAPER_TRANSITIONS[from].includes(to);
}

export function assertOrderTransition(from: OrderStatus, to: OrderStatus) {
  if (!canTransitionOrder(from, to)) {
    throw new InvalidStateTransitionError("order", from, to);
  }
}

export function assertPaperTransition(from: PaperStatus, to: PaperStatus) {
  if (!canTransitionPaper(from, to)) {
    throw new InvalidStateTransitionError("paper", from, to);
  }
}

export type PaymentSuccessPlan =
  | { kind: "already_done" }
  | { kind: "apply"; orderTo: "paid"; paperTo: "ready" };

export function planPaymentSuccess(
  orderStatus: OrderStatus,
  paperStatus: PaperStatus,
): PaymentSuccessPlan {
  if (orderStatus === "paid" && (paperStatus === "ready" || paperStatus === "generating" || paperStatus === "completed" || paperStatus === "failed")) {
    return { kind: "already_done" };
  }

  if (orderStatus === "paid" && paperStatus === "awaiting_payment") {
    assertPaperTransition(paperStatus, "ready");
    return { kind: "apply", orderTo: "paid", paperTo: "ready" };
  }

  assertOrderTransition(orderStatus, "paid");
  assertPaperTransition(paperStatus, "ready");
  return { kind: "apply", orderTo: "paid", paperTo: "ready" };
}

export function applyStatusAndExtra<T extends { status: string }>(
  doc: T,
  to: string,
  extra: Record<string, unknown>,
): T {
  const allowedExtra = { ...extra };
  delete allowedExtra.status;
  Object.assign(doc, allowedExtra);
  doc.status = to;
  return doc;
}

export function orderOwnsPaper(
  orderPaperId: { toString(): string } | undefined,
  paperId: { toString(): string } | undefined,
): boolean {
  return (
    !!orderPaperId && !!paperId && orderPaperId.toString() === paperId.toString()
  );
}

export async function transitionOrderStatus(
  publicId: string,
  to: OrderStatus,
  extra: Record<string, unknown> = {},
  session?: ClientSession,
) {
  const query = Order.findOne({ publicId });
  if (session) {
    query.session(session);
  }
  const order = await query;
  if (!order) {
    throw new Error("Order not found");
  }
  assertOrderTransition(order.status, to);
  applyStatusAndExtra(order, to, extra);
  await order.save(session ? { session } : undefined);
  return order;
}

export async function transitionPaperStatus(
  publicId: string,
  to: PaperStatus,
  extra: Record<string, unknown> = {},
  session?: ClientSession,
) {
  const query = Paper.findOne({ publicId });
  if (session) {
    query.session(session);
  }
  const paper = await query;
  if (!paper) {
    throw new Error("Paper not found");
  }
  assertPaperTransition(paper.status, to);
  applyStatusAndExtra(paper, to, extra);
  await paper.save(session ? { session } : undefined);
  return paper;
}

export async function markOrderPaidAndPaperReady(input: {
  orderPublicId: string;
  paperPublicId: string;
  transactionId: string;
  paidAt?: Date;
}): Promise<{ alreadyPaid: boolean }> {
  const order = await Order.findOne({ publicId: input.orderPublicId });
  const paper = await Paper.findOne({ publicId: input.paperPublicId });
  if (!order || !paper) {
    throw new Error("Order or paper not found");
  }

  const bound = orderOwnsPaper(order.paperId, paper._id);
  if (!bound) {
    throw new Error("Order does not belong to paper");
  }
  const plan = planPaymentSuccess(order.status, paper.status);
  if (plan.kind === "already_done") {
    return { alreadyPaid: true };
  }

  let alreadyPaid = false;
  const session = await Order.startSession();
  try {
    await session.withTransaction(async () => {
      const paidAt = input.paidAt ?? new Date();
      const updatedOrder = await Order.findOneAndUpdate(
        {
          publicId: input.orderPublicId,
          status: { $in: ["checkout_created", "processing"] },
        },
        {
          $set: {
            status: "paid",
            transactionId: input.transactionId,
            paidAt,
          },
        },
        { session, returnDocument: "after" },
      );

      if (!updatedOrder) {
        const current = await Order.findOne({ publicId: input.orderPublicId }).session(
          session,
        );
        if (current?.status !== "paid") {
          throw new InvalidStateTransitionError(
            "order",
            current?.status ?? "unknown",
            "paid",
          );
        }
        alreadyPaid = true;
      }

      const updatedPaper = await Paper.findOneAndUpdate(
        {
          publicId: input.paperPublicId,
          status: "awaiting_payment",
        },
        { $set: { status: "ready" } },
        { session, returnDocument: "after" },
      );

      if (!updatedPaper) {
        const currentPaper = await Paper.findOne({
          publicId: input.paperPublicId,
        }).session(session);
        if (
          currentPaper &&
          (currentPaper.status === "ready" ||
            currentPaper.status === "generating" ||
            currentPaper.status === "completed")
        ) {
          return;
        }
        throw new InvalidStateTransitionError(
          "paper",
          currentPaper?.status ?? "unknown",
          "ready",
        );
      }
    });
  } finally {
    await session.endSession();
  }

  return { alreadyPaid };
}
