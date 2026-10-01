import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { connectMongo, resetMongoCache } from "@/lib/db/mongodb";
import { Order } from "@/lib/models/Order";
import { Paper } from "@/lib/models/Paper";
import { WebhookEvent } from "@/lib/models/WebhookEvent";
import {
  deletePaperByPublicId,
  purgeExpiredResearch,
} from "@/lib/research/maintenance/purge";
import { GET as purgeRoute } from "@/app/api/research/maintenance/purge/route";

let mongod: MongoMemoryServer;

async function seed(publicId: string, ageDays: number) {
  const paper = await Paper.create({
    publicId,
    customerEmail: "synthetic@example.com",
    accessTokenHash: "hash",
    title: "A synthetic research paper title for retention",
    focus: "Synthetic focus for retention testing",
    paperType: "literature_review",
    authors: [{ name: "Synthetic Author", affiliation: "Example University" }],
    citationStyle: "apa",
    requestedPages: 10,
    targetWords: 3000,
    allowAdditionalSources: false,
  });
  const order = await Order.create({
    publicId: `ord_${publicId}`,
    paperId: paper._id,
    customerEmail: "synthetic@example.com",
    requestedPages: 10,
    wordsPerPage: 300,
    targetWords: 3000,
    unitPriceCents: 25000,
    subtotalCents: 250000,
    minimumChargeCents: 250000,
    chargedAmountCents: 250000,
    currency: "NGN",
    idempotencyKey: `idem_${publicId}`,
  });
  await WebhookEvent.create({
    eventId: `evt_${publicId}`,
    type: "collection.succeeded",
    orderPublicId: order.publicId,
  });
  const updatedAt = new Date(Date.now() - ageDays * 24 * 60 * 60 * 1000);
  await Paper.collection.updateOne(
    { publicId },
    { $set: { updatedAt } },
  );
}

describe("retention purge", () => {
  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();
    resetMongoCache();
    await connectMongo();
  }, 120_000);

  afterAll(async () => {
    await mongoose.disconnect();
    resetMongoCache();
    await mongod?.stop();
  });

  beforeEach(async () => {
    await Promise.all([
      Paper.deleteMany({}),
      Order.deleteMany({}),
      WebhookEvent.deleteMany({}),
    ]);
  });

  it("reports expired papers without deleting on a dry run", async () => {
    await seed("pap_old", 400);
    await seed("pap_new", 10);
    const report = await purgeExpiredResearch({ apply: false, retentionDays: 365 });
    expect(report.count).toBe(1);
    expect(report.papers[0]?.publicId).toBe("pap_old");
    expect(await Paper.countDocuments({ publicId: "pap_old" })).toBe(1);
  });

  it("cascades deletion to orders and webhook events on apply", async () => {
    await seed("pap_old", 400);
    await seed("pap_new", 10);
    const report = await purgeExpiredResearch({ apply: true, retentionDays: 365 });
    expect(report.count).toBe(1);
    expect(await Paper.countDocuments({ publicId: "pap_old" })).toBe(0);
    expect(await Order.countDocuments({ publicId: "ord_pap_old" })).toBe(0);
    expect(await WebhookEvent.countDocuments({ eventId: "evt_pap_old" })).toBe(0);
    expect(await Paper.countDocuments({ publicId: "pap_new" })).toBe(1);
  });

  it("deletes one paper on request", async () => {
    await seed("pap_one", 5);
    const removed = await deletePaperByPublicId("pap_one");
    expect(removed?.publicId).toBe("pap_one");
    expect(await Paper.countDocuments({ publicId: "pap_one" })).toBe(0);
  });

  it("bounds the batch size with limit", async () => {
    await seed("pap_a", 400);
    await seed("pap_b", 400);
    await seed("pap_c", 400);
    const report = await purgeExpiredResearch({
      apply: true,
      retentionDays: 365,
      limit: 2,
    });
    expect(report.count).toBe(2);
    expect(await Paper.countDocuments({})).toBe(1);
  });

  it("rejects the maintenance route without the cron secret", async () => {
    const previous = process.env.CRON_SECRET;
    delete process.env.CRON_SECRET;
    const response = await purgeRoute(
      new Request("http://localhost/api/research/maintenance/purge"),
    );
    expect(response.status).toBe(401);
    if (previous !== undefined) {
      process.env.CRON_SECRET = previous;
    }
  });

  it("runs the purge when authorized", async () => {
    await seed("pap_old", 400);
    process.env.CRON_SECRET = "cron-secret";
    const response = await purgeRoute(
      new Request("http://localhost/api/research/maintenance/purge?dryRun=1", {
        headers: { authorization: "Bearer cron-secret" },
      }),
    );
    expect(response.status).toBe(200);
    const headerResponse = await purgeRoute(
      new Request("http://localhost/api/research/maintenance/purge?dryRun=1", {
        headers: { "x-maintenance-secret": "cron-secret" },
      }),
    );
    expect(headerResponse.status).toBe(200);
    delete process.env.CRON_SECRET;
  });
});
