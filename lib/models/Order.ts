import "server-only";

import mongoose, {
  type HydratedDocument,
  type InferSchemaType,
  type Model,
} from "mongoose";

export const ORDER_STATUSES = [
  "created",
  "checkout_created",
  "processing",
  "paid",
  "failed",
  "expired",
  "refunded",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

const OrderSchema = new mongoose.Schema(
  {
    publicId: { type: String, required: true, unique: true, index: true },
    paperId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Paper",
      required: true,
    },
    customerEmail: { type: String, required: true },
    requestedPages: { type: Number, required: true, min: 1 },
    wordsPerPage: { type: Number, required: true, min: 1 },
    targetWords: { type: Number, required: true, min: 1 },
    unitPriceCents: { type: Number, required: true, min: 0 },
    subtotalCents: { type: Number, required: true, min: 0 },
    minimumChargeCents: { type: Number, required: true, min: 0 },
    chargedAmountCents: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: "NGN" },
    provider: { type: String, required: true, enum: ["bachs"], default: "bachs" },
    checkoutSessionId: { type: String, unique: true, sparse: true },
    checkoutUrl: { type: String },
    transactionId: { type: String, unique: true, sparse: true },
    status: {
      type: String,
      required: true,
      enum: ORDER_STATUSES,
      default: "created",
    },
    idempotencyKey: { type: String, required: true, unique: true },
    paidAt: { type: Date },
    paidAmountCents: { type: Number },
    paidCurrency: { type: String },
    lastWebhookEventId: { type: String },
    failureReason: { type: String },
  },
  { timestamps: true },
);

export type OrderData = InferSchemaType<typeof OrderSchema>;
export type OrderDocument = HydratedDocument<OrderData>;

export const Order: Model<OrderDocument> =
  (mongoose.models.Order as Model<OrderDocument> | undefined) ??
  mongoose.model<OrderDocument>("Order", OrderSchema);
