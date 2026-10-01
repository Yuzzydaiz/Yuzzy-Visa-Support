import { cookies } from "next/headers";

import { ACCESS_COOKIE } from "@/lib/research/auth/accessToken";
import { handleExportPaper } from "@/lib/research/export/http";

export const maxDuration = 120;

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const url = new URL(request.url);
  const header = request.headers.get("authorization");
  const bearer = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  const cookieStore = await cookies();
  const result = await handleExportPaper({
    paperPublicId: id,
    format: url.searchParams.get("format") ?? "",
    token: url.searchParams.get("token") ?? bearer ?? undefined,
    cookieToken: cookieStore.get(ACCESS_COOKIE)?.value,
    secureCookie: process.env.NODE_ENV === "production",
  });
  if (result.cookie) {
    cookieStore.set(result.cookie.name, result.cookie.value, result.cookie.options);
  }
  if (result.bytes && result.contentType && result.filename) {
    return new Response(new Uint8Array(result.bytes), {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": `attachment; filename="${result.filename}"`,
      },
    });
  }
  return Response.json(result.body, { status: result.status });
}
