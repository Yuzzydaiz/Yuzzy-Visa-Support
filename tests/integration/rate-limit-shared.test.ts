import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { connectMongo, resetMongoCache } from "@/lib/db/mongodb";
import { RateLimit } from "@/lib/models/RateLimit";
import {
  consumeResearchRateLimit,
  resetResearchRateLimit,
} from "@/lib/research/http/rateLimit";

let mongod: MongoMemoryServer;

describe("shared rate limit store", () => {
  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();
    process.env.RESEARCH_RATE_LIMIT_STORE = "mongo";
    resetMongoCache();
    await connectMongo();
  }, 120_000);

  afterAll(async () => {
    delete process.env.RESEARCH_RATE_LIMIT_STORE;
    await mongoose.disconnect();
    resetMongoCache();
    await mongod?.stop();
  });

  beforeEach(async () => {
    await RateLimit.deleteMany({});
    resetResearchRateLimit();
  });

  it("enforces one shared fixed window across callers", async () => {
    const now = Date.UTC(2026, 0, 1, 12, 0, 0);
    for (let i = 0; i < 30; i += 1) {
      expect(
        await consumeResearchRateLimit({ bucket: "resolve", ip: "1.2.3.4", now }),
      ).toBe(true);
    }
    expect(
      await consumeResearchRateLimit({ bucket: "resolve", ip: "1.2.3.4", now }),
    ).toBe(false);
    expect(
      await consumeResearchRateLimit({ bucket: "resolve", ip: "5.6.7.8", now }),
    ).toBe(true);
  });

  it("resets after the window advances", async () => {
    const now = Date.UTC(2026, 0, 1, 12, 0, 0);
    for (let i = 0; i < 30; i += 1) {
      await consumeResearchRateLimit({ bucket: "resolve", ip: "9.9.9.9", now });
    }
    expect(
      await consumeResearchRateLimit({ bucket: "resolve", ip: "9.9.9.9", now }),
    ).toBe(false);
    const later = now + 10 * 60 * 1000 + 1;
    expect(
      await consumeResearchRateLimit({ bucket: "resolve", ip: "9.9.9.9", now: later }),
    ).toBe(true);
  });

  it("fails open to the in-memory limiter when the store errors", async () => {
    const spy = vi
      .spyOn(RateLimit, "findOneAndUpdate")
      .mockRejectedValueOnce(new Error("store down"));
    expect(
      await consumeResearchRateLimit({
        bucket: "resolve",
        ip: "1.1.1.1",
        now: Date.UTC(2026, 0, 2),
      }),
    ).toBe(true);
    spy.mockRestore();
  });
});
