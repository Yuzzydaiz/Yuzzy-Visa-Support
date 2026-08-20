import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

import { messageStatus, visaCategory } from "./validators";

export default defineSchema({
  contactMessages: defineTable({
    name: v.string(),
    email: v.string(),
    visaCategory,
    message: v.string(),
    status: messageStatus,
    sourcePage: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_createdAt", ["createdAt"])
    .index("by_status_and_created", ["status", "createdAt"]),
  subscribers: defineTable({
    email: v.string(),
    source: v.string(),
    createdAt: v.number(),
    unsubscribedAt: v.optional(v.number()),
  }).index("by_email", ["email"]),
});
