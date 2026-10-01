import "server-only";

import mongoose, { type InferSchemaType, type Model } from "mongoose";

const RateLimitSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  count: { type: Number, required: true, default: 0 },
  windowStart: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
});

RateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type RateLimitData = InferSchemaType<typeof RateLimitSchema>;

export const RateLimit: Model<RateLimitData> =
  (mongoose.models.RateLimit as Model<RateLimitData> | undefined) ??
  mongoose.model<RateLimitData>("RateLimit", RateLimitSchema);
