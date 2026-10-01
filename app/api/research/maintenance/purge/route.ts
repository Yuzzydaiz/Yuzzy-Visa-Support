import { timingSafeEqual } from "node:crypto";

import {
  parseRetentionDays,
  purgeExpiredResearch,
} from "@/lib/research/maintenance/purge";

export const maxDuration = 60;

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return false;
  }
  const bearer = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();
  const header = request.headers.get("x-maintenance-secret")?.trim();
  const provided = bearer || header;
  return Boolean(provided) && safeEqual(provided!, secret);
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dryRun") === "1";
  try {
    const report = await purgeExpiredResearch({
      apply: !dryRun,
      retentionDays: parseRetentionDays(),
    });
    return Response.json(report);
  } catch {
    return Response.json({ error: "purge failed" }, { status: 500 });
  }
}
