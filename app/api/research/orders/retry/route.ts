import { cookies } from "next/headers";

import { ACCESS_COOKIE } from "@/lib/research/auth/accessToken";
import { handleRetryCheckout } from "@/lib/research/orders/retry";

export const maxDuration = 60;

export async function POST(request: Request) {
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const header = request.headers.get("authorization");
  const bearer = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  const cookieStore = await cookies();
  const result = await handleRetryCheckout({
    body,
    token:
      (body as { token?: string }).token ||
      bearer ||
      cookieStore.get(ACCESS_COOKIE)?.value,
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown",
  });
  return Response.json(result.body, { status: result.status });
}
