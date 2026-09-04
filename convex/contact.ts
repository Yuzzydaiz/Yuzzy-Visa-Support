import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";


import { internalQuery, mutation } from "./_generated/server";
import { hashEmail, rateLimiter } from "./rateLimit";
import { visaCategory } from "./validators";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const submit = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    visaCategory,
    message: v.string(),
    website: v.optional(v.string()),
    sourcePage: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  returns: v.object({ ok: v.literal(true) }),
  handler: async (ctx, args) => {
    if (args.website && args.website.trim() !== "") {
      return { ok: true as const };
    }

    const name = args.name.trim();
    const email = args.email.trim().toLowerCase();
    const message = args.message.trim();
    if (!name || !message || !emailPattern.test(email)) {
      throw new ConvexError("Invalid contact fields");
    }

    await rateLimiter.limit(ctx, "contact", {
      key: await hashEmail(email),
      throws: true,
    });

    await ctx.db.insert("contactMessages", {
      name,
      email,
      visaCategory: args.visaCategory,
      message,
      status: "new",
      createdAt: Date.now(),
      ...(args.sourcePage ? { sourcePage: args.sourcePage } : {}),
      ...(args.userAgent ? { userAgent: args.userAgent } : {}),
    });

    return { ok: true as const };
  },
});

export const list = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.any(),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("contactMessages")
      .withIndex("by_createdAt")
      .order("desc")
      .paginate(args.paginationOpts);
  },
});
