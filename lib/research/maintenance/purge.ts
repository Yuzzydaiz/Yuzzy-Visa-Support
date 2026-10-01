import "server-only";

import type { Types } from "mongoose";

import { connectMongo } from "@/lib/db/mongodb";
import { Order } from "@/lib/models/Order";
import { Paper } from "@/lib/models/Paper";
import { WebhookEvent } from "@/lib/models/WebhookEvent";

export const DEFAULT_RETENTION_DAYS = 365;
export const DEFAULT_PURGE_BATCH = 500;

export type PurgeReportItem = {
  publicId: string;
  orderPublicIds: string[];
};

export type PurgeReport = {
  apply: boolean;
  retentionDays: number;
  count: number;
  papers: PurgeReportItem[];
};

export function parseRetentionDays(
  env: Record<string, string | undefined> = process.env,
): number {
  const value = Number.parseInt(env.RESEARCH_RETENTION_DAYS ?? "", 10);
  return Number.isFinite(value) && value >= 1 ? value : DEFAULT_RETENTION_DAYS;
}

async function ordersByPaper(
  paperIds: Types.ObjectId[],
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (!paperIds.length) {
    return map;
  }
  const orders = await Order.find({ paperId: { $in: paperIds } })
    .select({ paperId: 1, publicId: 1 })
    .lean();
  for (const order of orders) {
    const key = String(order.paperId);
    const list = map.get(key) ?? [];
    list.push(String(order.publicId));
    map.set(key, list);
  }
  return map;
}

export async function purgeExpiredResearch(
  input: {
    retentionDays?: number;
    apply?: boolean;
    now?: Date;
    limit?: number;
  } = {},
): Promise<PurgeReport> {
  const retentionDays = input.retentionDays ?? DEFAULT_RETENTION_DAYS;
  const apply = input.apply ?? false;
  const now = input.now ?? new Date();
  const limit = input.limit ?? DEFAULT_PURGE_BATCH;
  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);

  await connectMongo();
  const papers = await Paper.find({ updatedAt: { $lt: cutoff } })
    .select({ publicId: 1 })
    .limit(limit)
    .lean();
  if (!papers.length) {
    return { apply, retentionDays, count: 0, papers: [] };
  }

  const paperIds = papers.map((paper) => paper._id);
  const orders = await ordersByPaper(paperIds);
  const report: PurgeReportItem[] = papers.map((paper) => ({
    publicId: String(paper.publicId),
    orderPublicIds: orders.get(String(paper._id)) ?? [],
  }));

  if (apply) {
    const orderPublicIds = report.flatMap((item) => item.orderPublicIds);
    if (orderPublicIds.length) {
      await WebhookEvent.deleteMany({ orderPublicId: { $in: orderPublicIds } });
    }
    await Order.deleteMany({ paperId: { $in: paperIds } });
    await Paper.deleteMany({ _id: { $in: paperIds } });
  }

  return { apply, retentionDays, count: report.length, papers: report };
}

export async function deletePaperByPublicId(
  publicId: string,
): Promise<PurgeReportItem | null> {
  await connectMongo();
  const paper = await Paper.findOne({ publicId }).select({ publicId: 1 }).lean();
  if (!paper) {
    return null;
  }
  const orderPublicIds = (await Order.find({ paperId: paper._id })
    .select({ publicId: 1 })
    .lean()).map((order) => String(order.publicId));
  if (orderPublicIds.length) {
    await WebhookEvent.deleteMany({ orderPublicId: { $in: orderPublicIds } });
  }
  await Order.deleteMany({ paperId: paper._id });
  await Paper.deleteOne({ _id: paper._id });
  return { publicId: String(paper.publicId), orderPublicIds };
}
