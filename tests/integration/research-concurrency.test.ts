import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { hashAccessToken } from "@/lib/research/auth/accessToken";
import { resetMongoCache, connectMongo } from "@/lib/db/mongodb";
import { Paper } from "@/lib/models/Paper";
import { createMongoOrderStore } from "@/lib/research/orders/store";
import { handleGenerateNext } from "@/lib/research/generation/next";
import { allocateOutline } from "@/lib/research/generation/outline";
import type { LlmClient } from "@/lib/research/ai/client";

let mongod: MongoMemoryServer;
const store = createMongoOrderStore();

const SECTION = {
  sectionId: "abstract",
  type: "abstract",
  title: "Abstract",
  order: 0,
  plainText: "Saved abstract [CITE:ref_01]",
  contentJson: {
    sectionId: "abstract",
    title: "Abstract",
    paragraphs: [{ text: "Saved abstract [CITE:ref_01]" }],
    usedReferenceIds: ["ref_01"],
    wordCountEstimate: 4,
  },
  targetWords: 150,
  actualWords: 4,
  citedRefIds: ["ref_01"],
  generationStatus: "complete",
};

async function seedPaper(overrides: Record<string, unknown> = {}) {
  return Paper.create({
    publicId: `pap_${Math.random().toString(36).slice(2)}`,
    customerEmail: "buyer@example.com",
    accessTokenHash: hashAccessToken("token", "pepper"),
    title: "Verified sources in visa-related research writing",
    focus: "Citation practice",
    paperType: "literature_review",
    authors: [{ name: "Ada Example", affiliation: "Example University" }],
    citationStyle: "ieee",
    requestedPages: 10,
    targetWords: 3000,
    allowAdditionalSources: false,
    references: [
      {
        refId: "ref_01",
        originalInput: "10.1000/climate",
        inputType: "doi",
        title: "Climate synthesis",
        authors: ["Ada Example"],
        year: 2020,
        verificationStatus: "verified",
        contentStatus: "abstract",
      },
    ],
    outline: [
      {
        sectionId: "abstract",
        type: "abstract",
        title: "Abstract",
        order: 0,
        arguments: [],
        wordBudget: 150,
        plannedRefIds: ["ref_01"],
      },
    ],
    sections: [SECTION],
    status: "ready",
    editorVersion: 0,
    generation: {
      completedSteps: ["outline", "abstract"],
      attempts: 2,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      version: 1,
      bibliography: [],
    },
    ...overrides,
  });
}

describe("research conditional persistence (isolated MongoDB)", () => {
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
    await Paper.deleteMany({});
  });

  it("R02: two stale editor snapshots cannot both win; exactly one 409 candidate", async () => {
    const created = await seedPaper();
    const snapshotA = await store.findPaperByPublicId(created.publicId);
    const snapshotB = await store.findPaperByPublicId(created.publicId);
    expect(snapshotA).not.toBe(snapshotB);

    snapshotA!.title = "Edited by tab A with a long enough title";
    snapshotB!.title = "Edited by tab B with a long enough title";

    const [a, b] = await Promise.all([
      store.savePaperIfEditorVersion!(snapshotA!, 0),
      store.savePaperIfEditorVersion!(snapshotB!, 0),
    ]);

    const winners = [a, b].filter(Boolean);
    expect(winners).toHaveLength(1);
    expect([a, b].filter((value) => value === null)).toHaveLength(1);

    const stored = await Paper.findOne({ publicId: created.publicId });
    expect(stored?.editorVersion).toBe(1);
    expect(stored?.title).toBe(winners[0]!.title);
  });

  it("R02: a retry with the new editor version succeeds", async () => {
    const created = await seedPaper();
    const first = await store.findPaperByPublicId(created.publicId);
    const second = await store.findPaperByPublicId(created.publicId);
    first!.title = "First accepted revision title here";
    const won = await store.savePaperIfEditorVersion!(first!, 0);
    expect(won?.editorVersion).toBe(1);

    second!.title = "Second retried revision title here";
    const retried = await store.savePaperIfEditorVersion!(second!, 1);
    expect(retried?.editorVersion).toBe(2);
    expect(retried?.title).toBe("Second retried revision title here");
  });

  it("R03: simultaneous generation claims produce exactly one owner", async () => {
    const created = await seedPaper({ status: "ready" });
    const now = new Date();
    const lockUntil = new Date(now.getTime() + 60_000);

    const [first, second] = await Promise.all([
      store.claimGeneration!({
        paperPublicId: created.publicId,
        stepId: "intro",
        owner: "owner-1",
        lockUntil,
        now,
      }),
      store.claimGeneration!({
        paperPublicId: created.publicId,
        stepId: "intro",
        owner: "owner-2",
        lockUntil,
        now,
      }),
    ]);

    expect([first, second].filter(Boolean)).toHaveLength(1);
  });

  it("R03: owner finalize clears the lease and advances the editor revision", async () => {
    const created = await seedPaper({ status: "ready" });
    const now = new Date();
    const claimed = await store.claimGeneration!({
      paperPublicId: created.publicId,
      stepId: "intro",
      owner: "gen-owner",
      lockUntil: new Date(now.getTime() + 60_000),
      now,
    });
    expect(claimed).toBe(true);

    const workingCopy = (await store.findPaperByPublicId(created.publicId))!;
    workingCopy.status = "completed";
    workingCopy.generation!.completedSteps = [
      ...(workingCopy.generation!.completedSteps ?? []),
      "intro",
    ];
    workingCopy.generation!.totalInputTokens = 123;
    workingCopy.generation!.totalOutputTokens = 45;
    const saved = await store.savePaperIfGenerationOwner!(workingCopy, "gen-owner");
    expect(saved?.editorVersion).toBe(1);
    expect(saved?.generation?.lockOwner ?? null).toBeNull();
    expect(saved?.status).toBe("completed");
    expect(saved?.generation?.totalInputTokens).toBe(123);
    expect(saved?.generation?.totalOutputTokens).toBe(45);

    const staleOwnerFinalize = await store.savePaperIfGenerationOwner!(
      workingCopy,
      "someone-else",
    );
    expect(staleOwnerFinalize).toBeNull();
  });

  it("R03: a stale owner cannot finalize regeneration or grant quota", async () => {
    const created = await seedPaper();
    const now = new Date();
    const lockUntil = new Date(now.getTime() + 60_000);
    const claimed = await store.claimRegeneration!({
      paperPublicId: created.publicId,
      sectionId: "abstract",
      owner: "winner",
      lockUntil,
      now,
    });
    expect(claimed).toBe(true);

    const stale = await store.findPaperByPublicId(created.publicId);
    stale!.regeneration = { used: 1, limit: 3 };
    const staleSave = await store.savePaperIfRegenerationOwner!(stale!, "loser");
    expect(staleSave).toBeNull();

    const stored = await Paper.findOne({ publicId: created.publicId });
    expect(stored?.regeneration?.used ?? 0).toBe(0);

    const winnerSave = await store.savePaperIfRegenerationOwner!(stale!, "winner");
    expect(winnerSave?.regeneration?.used).toBe(1);
  });

  it("increments the regeneration quota from the database, not a stale snapshot", async () => {
    const created = await seedPaper({ regeneration: { used: 2, limit: 3 } });
    const now = new Date();
    const claimed = await store.claimRegeneration!({
      paperPublicId: created.publicId,
      sectionId: "abstract",
      owner: "regen-owner",
      lockUntil: new Date(now.getTime() + 60_000),
      now,
    });
    expect(claimed).toBe(true);
    // A concurrent successful regeneration bumps the stored count.
    await Paper.updateOne(
      { publicId: created.publicId },
      { $set: { "regeneration.used": 3 } },
    );
    const stale = (await store.findPaperByPublicId(created.publicId))!;
    stale.regeneration = { used: 0, limit: 3 };
    const saved = await store.savePaperIfRegenerationOwner!(stale, "regen-owner");
    expect(saved?.regeneration?.used).toBe(4);
  });

  it("persists regeneration token totals and the canonical editor document", async () => {
    const created = await seedPaper({ regeneration: { used: 0, limit: 3 } });
    const now = new Date();
    const claimed = await store.claimRegeneration!({
      paperPublicId: created.publicId,
      sectionId: "abstract",
      owner: "regen-owner",
      lockUntil: new Date(now.getTime() + 60_000),
      now,
    });
    expect(claimed).toBe(true);

    const working = (await store.findPaperByPublicId(created.publicId))!;
    working.regeneration = { used: 1, limit: 3 };
    working.generation!.totalInputTokens = 77;
    working.generation!.totalOutputTokens = 88;
    working.editorDocument = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2, sectionId: "abstract" },
          content: [{ type: "text", text: "Abstract" }],
        },
        { type: "paragraph", content: [{ type: "text", text: "regen body" }] },
      ],
    };
    const saved = await store.savePaperIfRegenerationOwner!(working, "regen-owner");
    expect(saved?.generation?.totalInputTokens).toBe(77);
    expect(saved?.generation?.totalOutputTokens).toBe(88);
    expect(JSON.stringify(saved?.editorDocument)).toContain("regen body");
  });

  it("R03: an expired lease can be reclaimed", async () => {
    const created = await seedPaper();
    const expired = new Date(Date.now() - 60_000);
    await Paper.updateOne(
      { publicId: created.publicId },
      { $set: { "generation.lockOwner": "old", "generation.lockUntil": expired } },
    );
    const reclaimed = await store.claimGeneration!({
      paperPublicId: created.publicId,
      stepId: "intro",
      owner: "new",
      lockUntil: new Date(Date.now() + 60_000),
      now: new Date(),
    });
    expect(reclaimed).toBe(true);
    const stored = await Paper.findOne({ publicId: created.publicId });
    expect(stored?.generation?.lockOwner).toBe("new");
  });

  it("persists provider token usage into the stored generation totals", async () => {
    const created = await seedPaper({
      status: "ready",
      outline: [],
      sections: [],
      generation: {
        completedSteps: [],
        attempts: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        version: 0,
        bibliography: [],
      },
    });
    const llm: LlmClient = {
      async completeJson() {
        const outline = allocateOutline({
          paperType: "literature_review",
          targetWords: 3000,
          manifest: [
            {
              refId: "ref_01",
              title: "Climate synthesis",
              authors: ["Ada Example"],
              evidence: "",
              contentStatus: "abstract",
            },
          ],
        });
        return {
          text: JSON.stringify({ sections: outline }),
          usage: { inputTokens: 11, outputTokens: 22 },
        };
      },
    };
    const result = await handleGenerateNext({
      paperPublicId: created.publicId,
      token: "token",
      env: {
        ...process.env,
        OPENAI_API_KEY: "sk-test",
        BACHS_API_KEY: "k",
        BACHS_WEBHOOK_SECRET: "s",
        BACHS_API_BASE_URL: "https://sandbox-api.bachs.io",
        APP_BASE_URL: "http://localhost:3000",
        RECOVERY_TOKEN_PEPPER: "pepper",
      },
      store,
      llm,
    });
    expect(result.status).toBe(200);
    const stored = await Paper.findOne({ publicId: created.publicId });
    expect(stored?.generation?.totalInputTokens).toBe(11);
    expect(stored?.generation?.totalOutputTokens).toBe(22);
  });

  it("R03: regeneration quota claim is denied once used reaches the limit", async () => {
    const created = await seedPaper({ regeneration: { used: 3, limit: 3 } });
    const claimed = await store.claimRegeneration!({
      paperPublicId: created.publicId,
      sectionId: "abstract",
      owner: "owner",
      lockUntil: new Date(Date.now() + 60_000),
      now: new Date(),
    });
    expect(claimed).toBe(false);
  });

  it("R05/R02: a stale editor snapshot cannot overwrite after regeneration advances the version", async () => {
    const created = await seedPaper();
    const staleEditorSnapshot = await store.findPaperByPublicId(created.publicId);
    const regenWorkingCopy = await store.findPaperByPublicId(created.publicId);
    expect(staleEditorSnapshot).not.toBe(regenWorkingCopy);

    const claimed = await store.claimRegeneration!({
      paperPublicId: created.publicId,
      sectionId: "abstract",
      owner: "regen-owner",
      lockUntil: new Date(Date.now() + 60_000),
      now: new Date(),
    });
    expect(claimed).toBe(true);

    regenWorkingCopy!.regeneration = { used: 1, limit: 3 };
    const finalized = await store.savePaperIfRegenerationOwner!(
      regenWorkingCopy!,
      "regen-owner",
    );
    expect(finalized?.editorVersion).toBe(1);

    staleEditorSnapshot!.title = "Stale tab overwrite attempt title";
    const staleSave = await store.savePaperIfEditorVersion!(staleEditorSnapshot!, 0);
    expect(staleSave).toBeNull();

    const stored = await Paper.findOne({ publicId: created.publicId });
    expect(stored?.editorVersion).toBe(1);
    expect(stored?.title).not.toBe("Stale tab overwrite attempt title");
  });
});
