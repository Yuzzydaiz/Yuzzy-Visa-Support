import "server-only";

import { connectMongo } from "@/lib/db/mongodb";
import { Order, type OrderDocument, type OrderStatus } from "@/lib/models/Order";
import { Paper, type PaperDocument } from "@/lib/models/Paper";
import { WebhookEvent } from "@/lib/models/WebhookEvent";
import { markOrderPaidAndPaperReady } from "@/lib/research/state/orderTransitions";

export type StoredCheckout = {
  orderPublicId: string;
  paperPublicId: string;
  checkoutSessionId?: string;
  checkoutUrl?: string;
  status: OrderStatus;
  chargedAmountCents: number;
  currency: string;
  customerEmail: string;
  paperStatus: string;
  accessTokenHash: string;
};

export type OrderStore = {
  findByIdempotencyKey(key: string): Promise<StoredCheckout | null>;
  createPaperAndOrder(input: {
    paper: Record<string, unknown>;
    order: Record<string, unknown>;
  }): Promise<{ paperPublicId: string; orderPublicId: string }>;
  saveCheckout(input: {
    orderPublicId: string;
    checkoutSessionId: string;
    checkoutUrl?: string;
  }): Promise<void>;
  findOrderByPublicId(publicId: string): Promise<OrderDocument | null>;
  findOrderByCheckoutId(checkoutId: string): Promise<OrderDocument | null>;
  findPaperByPublicId(publicId: string): Promise<PaperDocument | null>;
  savePaper(paper: PaperDocument): Promise<void>;
  savePaperIfEditorVersion?(paper: PaperDocument, expectedEditorVersion: number): Promise<PaperDocument | null>;
  claimGeneration?(input: {
    paperPublicId: string;
    stepId: string;
    owner: string;
    lockUntil: Date;
    now: Date;
  }): Promise<boolean>;
  savePaperIfGenerationOwner?(paper: PaperDocument, owner: string): Promise<PaperDocument | null>;
  releaseGeneration?(input: {
    paperPublicId: string;
    owner: string;
    status?: "failed" | "generating" | "ready" | "completed";
    lastError?: string;
  }): Promise<void>;
  claimRegeneration?(input: {
    paperPublicId: string;
    sectionId: string;
    owner: string;
    lockUntil: Date;
    now: Date;
  }): Promise<boolean>;
  // commit=false saves an unfinished long-section regeneration (its pending
  // parts) without touching the paper text or the quota.
  savePaperIfRegenerationOwner?(
    paper: PaperDocument,
    owner: string,
    options?: { commit?: boolean },
  ): Promise<PaperDocument | null>;
  findPaperForOrder(order: OrderDocument): Promise<PaperDocument | null>;
  recordWebhookEvent(eventId: string, type: string, orderPublicId?: string): Promise<"inserted" | "duplicate">;
  markPaid(input: {
    orderPublicId: string;
    paperPublicId: string;
    transactionId: string;
    paidAmountCents?: number;
    paidCurrency?: string;
    eventId?: string;
  }): Promise<{ alreadyPaid: boolean }>;
};

const checkoutUrls = new Map<string, string>();

export function createMongoOrderStore(): OrderStore {
  return {
    async findByIdempotencyKey(key) {
      await connectMongo();
      const order = await Order.findOne({ idempotencyKey: key });
      if (!order) {
        return null;
      }
      const paper = await Paper.findById(order.paperId);
      if (!paper) {
        return null;
      }
      const checkoutUrl = checkoutUrls.get(order.publicId);
      return {
        orderPublicId: order.publicId,
        paperPublicId: paper.publicId,
        checkoutSessionId: order.checkoutSessionId ?? undefined,
        checkoutUrl: order.checkoutUrl || checkoutUrl,
        status: order.status,
        chargedAmountCents: order.chargedAmountCents,
        currency: order.currency,
        customerEmail: order.customerEmail,
        paperStatus: paper.status,
        accessTokenHash: paper.accessTokenHash,
      };
    },

    async createPaperAndOrder(input) {
      await connectMongo();
      const paper = await Paper.create(input.paper);
      let order;
      try {
        order = await Order.create({
          ...input.order,
          paperId: paper._id,
        });
      } catch (error) {
        // Avoid orphaning a paper with no order (for example a losing
        // idempotency-key race on the unique Order index).
        await Paper.deleteOne({ _id: paper._id });
        throw error;
      }
      return { paperPublicId: paper.publicId, orderPublicId: order.publicId };
    },

    async saveCheckout(input) {
      await connectMongo();
      await Order.updateOne(
        { publicId: input.orderPublicId },
        {
          $set: {
            checkoutSessionId: input.checkoutSessionId,
            ...(input.checkoutUrl ? { checkoutUrl: input.checkoutUrl } : {}),
            status: "checkout_created",
          },
        },
      );
      if (input.checkoutUrl) {
        checkoutUrls.set(input.orderPublicId, input.checkoutUrl);
      }
    },

    async findOrderByPublicId(publicId) {
      await connectMongo();
      return Order.findOne({ publicId });
    },

    async findOrderByCheckoutId(checkoutId) {
      await connectMongo();
      return Order.findOne({ checkoutSessionId: checkoutId });
    },

    async findPaperByPublicId(publicId) {
      await connectMongo();
      return Paper.findOne({ publicId });
    },

    async savePaper(paper) {
      await connectMongo();
      await paper.save();
    },

    async savePaperIfEditorVersion(paper, expectedEditorVersion) {
      await connectMongo();
      const nextVersion = expectedEditorVersion + 1;
      const result = await Paper.updateOne(
        { publicId: paper.publicId, editorVersion: expectedEditorVersion },
        {
          $set: {
            title: paper.title,
            citationStyle: paper.citationStyle,
            sections: paper.sections,
            editorDocument: paper.editorDocument,
            "generation.bibliography": paper.generation?.bibliography ?? [],
            editorVersion: nextVersion,
          },
          $currentDate: { updatedAt: true },
        },
      );
      if (result.matchedCount !== 1) {
        return null;
      }
      return Paper.findOne({ publicId: paper.publicId });
    },

    async claimGeneration(input) {
      await connectMongo();
      const result = await Paper.updateOne(
        {
          publicId: input.paperPublicId,
          status: { $in: ["ready", "generating", "failed"] },
          $and: [
            {
              $or: [
                { "generation.lockUntil": { $exists: false } },
                { "generation.lockUntil": null },
                { "generation.lockUntil": { $lte: input.now } },
              ],
            },
            {
              $or: [
                { "generation.completedSteps": { $ne: input.stepId } },
                { "generation.completedSteps": { $exists: false } },
              ],
            },
          ],
        },
        {
          $set: {
            status: "generating",
            "generation.currentStep": input.stepId,
            "generation.lockOwner": input.owner,
            "generation.lockUntil": input.lockUntil,
          },
          $inc: { "generation.attempts": 1 },
          $currentDate: { updatedAt: true },
        },
      );
      return result.matchedCount === 1;
    },

    async savePaperIfGenerationOwner(paper, owner) {
      await connectMongo();
      const result = await Paper.updateOne(
        { publicId: paper.publicId, "generation.lockOwner": owner },
        {
          $set: {
            status: paper.status,
            outline: paper.outline,
            sections: paper.sections,
            completedAt: paper.completedAt,
            generation: {
              ...paper.generation,
              lockOwner: undefined,
              lockUntil: undefined,
            },
          },
          $inc: { editorVersion: 1 },
          $currentDate: { updatedAt: true },
        },
      );
      if (result.matchedCount !== 1) {
        return null;
      }
      return Paper.findOne({ publicId: paper.publicId });
    },

    async releaseGeneration(input) {
      await connectMongo();
      await Paper.updateOne(
        { publicId: input.paperPublicId, "generation.lockOwner": input.owner },
        {
          $set: {
            ...(input.status ? { status: input.status } : {}),
            ...(input.lastError ? { "generation.lastError": input.lastError } : {}),
          },
          $unset: {
            "generation.lockOwner": "",
            "generation.lockUntil": "",
          },
          $currentDate: { updatedAt: true },
        },
      );
    },

    async claimRegeneration(input) {
      await connectMongo();
      const result = await Paper.updateOne(
        {
          publicId: input.paperPublicId,
          status: { $nin: ["draft", "awaiting_payment"] },
          $expr: {
            $lt: [
              { $ifNull: ["$regeneration.used", 0] },
              { $ifNull: ["$regeneration.limit", 3] },
            ],
          },
          $or: [
            { "generation.lockUntil": { $exists: false } },
            { "generation.lockUntil": null },
            { "generation.lockUntil": { $lte: input.now } },
          ],
        },
        {
          $set: {
            "generation.currentStep": `regenerate:${input.sectionId}`,
            "generation.lockOwner": input.owner,
            "generation.lockUntil": input.lockUntil,
          },
          $currentDate: { updatedAt: true },
        },
      );
      return result.matchedCount === 1;
    },

    async savePaperIfRegenerationOwner(paper, owner, options) {
      await connectMongo();
      if (options?.commit === false) {
        const partial = await Paper.updateOne(
          { publicId: paper.publicId, "generation.lockOwner": owner },
          {
            $set: {
              "regeneration.pending": paper.regeneration?.pending,
              "generation.currentStep": paper.generation?.currentStep,
              "generation.totalInputTokens": paper.generation?.totalInputTokens ?? 0,
              "generation.totalOutputTokens": paper.generation?.totalOutputTokens ?? 0,
            },
            $unset: {
              "generation.lockOwner": "",
              "generation.lockUntil": "",
            },
            $currentDate: { updatedAt: true },
          },
        );
        if (partial.matchedCount !== 1) {
          return null;
        }
        return Paper.findOne({ publicId: paper.publicId });
      }
      const result = await Paper.updateOne(
        { publicId: paper.publicId, "generation.lockOwner": owner },
        {
          $set: {
            sections: paper.sections,
            editorDocument: paper.editorDocument,
            "regeneration.limit": paper.regeneration?.limit ?? 3,
            "generation.bibliography": paper.generation?.bibliography ?? [],
            "generation.currentStep": paper.generation?.currentStep,
            "generation.totalInputTokens": paper.generation?.totalInputTokens ?? 0,
            "generation.totalOutputTokens": paper.generation?.totalOutputTokens ?? 0,
          },
          // Increment in the database so a stale snapshot cannot undercount the
          // quota and hand out a free regeneration.
          $inc: { "regeneration.used": 1, editorVersion: 1 },
          $unset: {
            "generation.lockOwner": "",
            "generation.lockUntil": "",
            "regeneration.pending": "",
          },
          $currentDate: { updatedAt: true },
        },
      );
      if (result.matchedCount !== 1) {
        return null;
      }
      return Paper.findOne({ publicId: paper.publicId });
    },

    async findPaperForOrder(order) {
      await connectMongo();
      return Paper.findById(order.paperId);
    },

    async recordWebhookEvent(eventId, type, orderPublicId) {
      await connectMongo();
      try {
        await WebhookEvent.create({ eventId, type, orderPublicId });
        return "inserted";
      } catch (error) {
        if (
          typeof error === "object" &&
          error &&
          "code" in error &&
          (error as { code?: number }).code === 11000
        ) {
          return "duplicate";
        }
        throw error;
      }
    },

    async markPaid(input) {
      await connectMongo();
      const result = await markOrderPaidAndPaperReady({
        orderPublicId: input.orderPublicId,
        paperPublicId: input.paperPublicId,
        transactionId: input.transactionId,
      });
      await Order.updateOne(
        { publicId: input.orderPublicId },
        {
          $set: {
            ...(input.paidAmountCents !== undefined
              ? { paidAmountCents: input.paidAmountCents }
              : {}),
            ...(input.paidCurrency ? { paidCurrency: input.paidCurrency } : {}),
            ...(input.eventId ? { lastWebhookEventId: input.eventId } : {}),
          },
        },
      );
      return result;
    },
  };
}
