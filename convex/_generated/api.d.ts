/* eslint-disable */
import type { AnyApi, FilterApi, FunctionReference } from "convex/server";
import type { ComponentApi } from "@convex-dev/rate-limiter/dist/component/_generated/component.js";

export declare const api: FilterApi<
  AnyApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  AnyApi,
  FunctionReference<any, "internal">
>;
export declare const components: {
  rateLimiter: ComponentApi;
};
