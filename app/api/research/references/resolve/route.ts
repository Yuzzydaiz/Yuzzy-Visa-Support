import { handleReferenceResolve } from "@/lib/research/references/http";

export const maxDuration = 60;

export async function POST(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "unknown";
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const result = await handleReferenceResolve({ ip, body });
  return Response.json(result.body, { status: result.status });
}
