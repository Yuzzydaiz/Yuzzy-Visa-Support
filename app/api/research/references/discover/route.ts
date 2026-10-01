import { handleReferenceDiscover } from "@/lib/research/discovery/http";

export const maxDuration = 120;

export async function POST(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "unknown";
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const result = await handleReferenceDiscover({ ip, body });
  return Response.json(result.body, { status: result.status });
}
