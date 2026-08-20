import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";

import { internalQuery, mutation } from "./_generated/server";
import { hashEmail, rateLimiter } from "./rateLimit";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const subscribe = mutation({
  args: {
    email: v.string(),
    website: v.optional(v.string()),
  },
  returns: v.object({ ok: v.literal(true) }),
  handler: async (ctx, args) => {
    if (args.website && args.website.trim() !== "") {
      return { ok: true as const };
    }

    const email = args.email.trim().toLowerCase();
    if (!emailPattern.test(email)) {
      throw new ConvexError("Invalid email");
    }

    await rateLimiter.limit(ctx, "subscribe", {
      key: await hashEmail(email),
      throws: true,
    });

    const existing = await ctx.db
      .query("subscribers")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();

    if (existing) {
      return { ok: true as const };
    }

    await ctx.db.insert("subscribers", {
      email,
      source: "newsletter_strip",
      createdAt: Date.now(),
    });

    return { ok: true as const };
  },
});

export const list = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.any(),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("subscribers")
      .withIndex("by_email")
      .paginate(args.paginationOpts);
  },
});
