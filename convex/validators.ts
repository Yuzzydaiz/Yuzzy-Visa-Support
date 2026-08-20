import { v } from "convex/values";

export const visaCategory = v.union(
  v.literal("EB1A"),
  v.literal("O1"),
  v.literal("EB2_NIW"),
);

export const messageStatus = v.union(v.literal("new"), v.literal("read"));
