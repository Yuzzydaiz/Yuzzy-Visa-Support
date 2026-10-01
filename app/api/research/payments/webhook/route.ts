import { handleBachsWebhook } from "@/lib/research/payments/webhook";

export const maxDuration = 60;

export async function POST(request: Request) {
  const rawBody = await request.text();
  const result = await handleBachsWebhook({
    rawBody,
    timestamp: request.headers.get("x-bachs-timestamp"),
    signature: request.headers.get("x-bachs-signature"),
  });
  return Response.json(result.body, { status: result.status });
}
