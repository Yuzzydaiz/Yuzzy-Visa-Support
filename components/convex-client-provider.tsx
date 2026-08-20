"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";

const url = process.env.NEXT_PUBLIC_CONVEX_URL;
const client = url ? new ConvexReactClient(url) : null;

export function ConvexClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!client) {
    return children;
  }
  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}
