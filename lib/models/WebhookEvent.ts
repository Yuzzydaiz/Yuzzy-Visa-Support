import "server-only";

import mongoose, { type InferSchemaType, type Model } from "mongoose";

const WebhookEventSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, unique: true, index: true },
    type: { type: String, required: true },
    orderPublicId: { type: String },
    processedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true },
);

export type WebhookEventDocument = InferSchemaType<typeof WebhookEventSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const WebhookEvent: Model<WebhookEventDocument> =
  (mongoose.models.WebhookEvent as Model<WebhookEventDocument> | undefined) ??
  mongoose.model<WebhookEventDocument>("WebhookEvent", WebhookEventSchema);
