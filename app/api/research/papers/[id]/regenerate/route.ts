import { cookies } from "next/headers";

import { ACCESS_COOKIE } from "@/lib/research/auth/accessToken";
import { handleRegenerateSection } from "@/lib/research/generation/regenerate";

export const maxDuration = 300;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const url = new URL(request.url);
  const header = request.headers.get("authorization");
  const bearer = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  const cookieStore = await cookies();
  const forwarded = request.headers.get("x-forwarded-for");
  const body = await request.json().catch(() => ({}));
  const result = await handleRegenerateSection({
    paperPublicId: id,
    body,
    token: url.searchParams.get("token") ?? bearer ?? undefined,
    cookieToken: cookieStore.get(ACCESS_COOKIE)?.value,
    ip: forwarded?.split(",")[0]?.trim() ?? "unknown",
    secureCookie: process.env.NODE_ENV === "production",
  });
  if (result.cookie) {
    cookieStore.set(result.cookie.name, result.cookie.value, result.cookie.options);
  }
  return Response.json(result.body, { status: result.status });
}
