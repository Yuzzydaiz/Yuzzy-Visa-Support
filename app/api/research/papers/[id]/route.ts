import { cookies } from "next/headers";

import { ACCESS_COOKIE } from "@/lib/research/auth/accessToken";
import { handleGetPaper } from "@/lib/research/papers/http";
import { handlePatchPaper } from "@/lib/research/papers/patch";
import { handleDeletePaper } from "@/lib/research/papers/delete";

export const maxDuration = 60;

function tokenFromRequest(request: Request, cookieToken?: string) {
  const url = new URL(request.url);
  const header = request.headers.get("authorization");
  const bearer = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  return {
    token: url.searchParams.get("token") ?? bearer ?? undefined,
    cookieToken,
    secureCookie: process.env.NODE_ENV === "production",
  };
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const cookieStore = await cookies();
  const result = await handleGetPaper({
    paperPublicId: id,
    ...tokenFromRequest(request, cookieStore.get(ACCESS_COOKIE)?.value),
  });
  if (result.cookie) {
    cookieStore.set(result.cookie.name, result.cookie.value, result.cookie.options);
  }
  return Response.json(result.body, { status: result.status });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const cookieStore = await cookies();
  const body = await request.json().catch(() => ({}));
  const result = await handlePatchPaper({
    paperPublicId: id,
    body,
    ...tokenFromRequest(request, cookieStore.get(ACCESS_COOKIE)?.value),
  });
  if (result.cookie) {
    cookieStore.set(result.cookie.name, result.cookie.value, result.cookie.options);
  }
  return Response.json(result.body, { status: result.status });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const cookieStore = await cookies();
  const result = await handleDeletePaper({
    paperPublicId: id,
    ...tokenFromRequest(request, cookieStore.get(ACCESS_COOKIE)?.value),
  });
  return Response.json(result.body, { status: result.status });
}
