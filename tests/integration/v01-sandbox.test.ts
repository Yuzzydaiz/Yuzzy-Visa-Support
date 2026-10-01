import fs from "node:fs";
import { createHmac } from "node:crypto";
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createLlmClientFromConfig } from "@/lib/research/ai/client";
import { parseWritingLlmConfig } from "@/lib/config/research";
import { resetResearchRateLimit } from "@/lib/research/http/rateLimitStub";
import type { OrderStore } from "@/lib/research/orders/store";
import { createMongoOrderStore } from "@/lib/research/orders/store";
import { handleCreateOrder } from "@/lib/research/orders/http";
import { handleBachsWebhook } from "@/lib/research/payments/webhook";
import { handleGenerateNext } from "@/lib/research/generation/next";
import { handleGetPaper } from "@/lib/research/papers/http";
import { handlePatchPaper } from "@/lib/research/papers/patch";
import { handleRegenerateSection } from "@/lib/research/generation/regenerate";
import { handleExportPaper } from "@/lib/research/export/http";

function loadEnvLocal() {
  const text = fs.readFileSync(".env.local", "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    const value = m[2].trim().replace(/^["']|["']$/g, "");
    if (process.env[m[1]] === undefined) {
      process.env[m[1]] = value;
    }
  }
}

const RUN = process.env.RUN_V01 === "1";
const REQUIRED = [
  "MONGODB_URI",
  "BACHS_API_KEY",
  "BACHS_WEBHOOK_SECRET",
  "BACHS_API_BASE_URL",
  "APP_BASE_URL",
  "RECOVERY_TOKEN_PEPPER",
  "CROSSREF_CONTACT_EMAIL",
];

type State = {
  paperPublicId?: string;
  orderPublicId?: string;
  token?: string;
  checkoutUrl?: string;
  chargedAmountCents?: number;
  currency?: string;
};

describe.skipIf(!RUN)("V01 sandbox journey", () => {
  const state: State = {};
  const store: OrderStore = createMongoOrderStore();
  const env = process.env;
  const createdPaperIds: string[] = [];
  let memoryMongo: { getUri(): string; stop(): Promise<boolean> } | undefined;

  beforeAll(async () => {
    loadEnvLocal();
    const missing = REQUIRED.filter((k) => !process.env[k]?.trim());
    if (missing.length) {
      throw new Error(`Missing env keys: ${missing.join(", ")}`);
    }
    const hasLlmKey =
      process.env.OPENAI_API_KEY?.trim() ||
      process.env.OPENROUTER_API_KEY?.trim() ||
      process.env.LLM_API_KEY?.trim();
    if (!hasLlmKey) {
      throw new Error("Missing env keys: OPENAI_API_KEY or OPENROUTER_API_KEY");
    }
    if (!process.env.BACHS_API_BASE_URL!.includes("sandbox")) {
      throw new Error("Refusing to run: BACHS_API_BASE_URL is not a sandbox URL");
    }
    if (!process.env.BACHS_API_KEY!.startsWith("sk_sandbox_")) {
      throw new Error("Refusing to run: BACHS_API_KEY is not a sandbox key");
    }
    if (process.env.V01_MEMORY_MONGO === "1") {
      const { MongoMemoryReplSet } = await import("mongodb-memory-server");
      const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
      memoryMongo = replSet;
      process.env.MONGODB_URI = replSet.getUri();
      const { resetMongoCache } = await import("@/lib/db/mongodb");
      resetMongoCache();
      console.log("[V01] using isolated single-node replica-set MongoDB (transactions enabled)");
    }
    resetResearchRateLimit();
  }, 120_000);

  afterAll(async () => {
    try {
      const { Paper } = await import("@/lib/models/Paper");
      const mongoose = (await import("mongoose")).default;
      for (const publicId of createdPaperIds) {
        await Paper.deleteOne({ publicId });
      }
      await mongoose.disconnect();
      await memoryMongo?.stop();
    } catch {
      /* best effort cleanup */
    }
  }, 30_000);

  async function confirmPayment(orderPublicId: string) {
    const order = await store.findOrderByPublicId(orderPublicId);
    if (!order) {
      throw new Error("order missing for confirmation");
    }
    const amount = (order.chargedAmountCents / 100).toFixed(2);
    const currency = order.currency;
    const secret = env.BACHS_WEBHOOK_SECRET!;
    const ts = String(Math.floor(Date.now() / 1000));
    const event = {
      id: `evt_${Math.random().toString(36).slice(2, 12)}`,
      type: "collection.succeeded",
      data: {
        charge_id: `chg_${Math.random().toString(36).slice(2, 12)}`,
        status: "succeeded",
        amount,
        currency,
        metadata: { orderPublicId },
        reference: orderPublicId,
      },
    };
    const raw = JSON.stringify(event);
    const signature = createHmac("sha256", secret)
      .update(`${ts}.${raw}`)
      .digest("hex");
    return handleBachsWebhook({ rawBody: raw, timestamp: ts, signature, env, store });
  }

  async function createPaidPaper(input: {
    title: string;
    focus?: string;
    paperType: "literature_review" | "research_proposal" | "original_research_draft";
    citationStyle?: string;
    requestedPages?: number;
    actualMethodology?: string;
    actualFindings?: string;
    references: Array<{ id: string; originalInput: string }>;
    ip?: string;
  }) {
    const idempotencyKey = `v01-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const created = await handleCreateOrder({
      ip: input.ip ?? "203.0.113.210",
      env,
      body: {
        idempotencyKey,
        chargedAmountCents: 1,
        paper: {
          title: input.title,
          focus: input.focus ?? "Synthetic focus",
          paperType: input.paperType,
          authors: [
            { name: "V01 Synthetic Author", affiliation: "V01 Test University" },
          ],
          citationStyle: input.citationStyle ?? "apa",
          requestedPages: input.requestedPages ?? 10,
          allowAdditionalSources: false,
          customerEmail: "v01-sandbox@example.com",
          actualMethodology: input.actualMethodology,
          actualFindings: input.actualFindings,
        },
        references: input.references.map((reference) => ({
          id: reference.id,
          originalInput: reference.originalInput,
          verificationStatus: "verified",
          contentStatus: "abstract",
          selectedByUser: true,
          isUserKeyReference: true,
        })),
      },
    });
    if (created.status !== 201) {
      throw new Error(
        `create order failed ${created.status}: ${JSON.stringify(created.body)}`,
      );
    }
    const body = created.body as {
      paperPublicId: string;
      orderPublicId: string;
      accessToken: string;
    };
    createdPaperIds.push(body.paperPublicId);
    const confirmed = await confirmPayment(body.orderPublicId);
    if (confirmed.status !== 200) {
      throw new Error(
        `webhook failed ${confirmed.status}: ${JSON.stringify(confirmed.body)}`,
      );
    }
    return {
      paperPublicId: body.paperPublicId,
      orderPublicId: body.orderPublicId,
      token: body.accessToken,
    };
  }

  async function generateToCompletion(
    paperPublicId: string,
    token: string,
    ip = "198.51.100.7",
  ) {
    let paper = await store.findPaperByPublicId(paperPublicId);
    let guard = 0;
    while (paper?.status !== "completed" && guard < 40) {
      guard += 1;
      resetResearchRateLimit();
      const result = await handleGenerateNext({
        paperPublicId,
        token,
        env,
        store,
        ip,
      });
      if (result.status !== 200) {
        throw new Error(
          `generate failed ${result.status}: ${JSON.stringify(result.body)}`,
        );
      }
      paper = await store.findPaperByPublicId(paperPublicId);
    }
    return paper;
  }

  it("probe: configured LLM model accepts the request contract (OpenAI then OpenRouter)", async () => {
    const writing = parseWritingLlmConfig(env);
    const client = createLlmClientFromConfig(writing.llm);
    const result = await client.completeJson({
      model: writing.writingModel,
      system: "Reply with JSON {\"ok\":true} only.",
      user: "ping",
      maxTokens: 64,
      schema: {
        name: "ping",
        schema: {
          type: "object",
          properties: { ok: { type: "boolean" } },
          required: ["ok"],
          additionalProperties: false,
        },
      },
    });
    console.log(
      `[V01] llm providers=${writing.llm.providers.map((p) => p.name).join(">")} model=${writing.writingModel} text=${result.text.slice(0, 80)} usage=${JSON.stringify(result.usage)}`,
    );
    expect(result.text.length).toBeGreaterThan(0);
  }, 120_000);

  it("creates a sandbox checkout at the server price; tamper ignored; duplicate idempotent", async () => {
    const idempotencyKey = `v01-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const body = {
      idempotencyKey,
      chargedAmountCents: 1,
      paper: {
        title: "V01 sandbox literature review on citation practice",
        focus: "How researchers build verifiable citation records",
        paperType: "literature_review",
        authors: [{ name: "V01 Synthetic Author", affiliation: "V01 Test University" }],
        citationStyle: "apa",
        requestedPages: 10,
        allowAdditionalSources: false,
        customerEmail: "v01-sandbox@example.com",
      },
      references: [
        {
          id: "ref_01",
          originalInput: "10.1038/nature14539",
          verificationStatus: "verified",
          contentStatus: "abstract",
          selectedByUser: true,
          isUserKeyReference: true,
        },
      ],
    };

    const first = await handleCreateOrder({ ip: "203.0.113.201", env, body });
    expect(first.status).toBe(201);
    const fb = first.body as {
      checkoutUrl?: string;
      accessToken?: string;
      paperPublicId?: string;
      orderPublicId?: string;
      chargedAmountCents?: number;
      currency?: string;
    };
    expect(fb.checkoutUrl).toBeTruthy();
    expect(fb.chargedAmountCents).toBe(250000);
    state.paperPublicId = fb.paperPublicId;
    state.orderPublicId = fb.orderPublicId;
    state.token = fb.accessToken;
    state.checkoutUrl = fb.checkoutUrl;
    state.chargedAmountCents = fb.chargedAmountCents;
    state.currency = fb.currency;
    if (fb.paperPublicId) createdPaperIds.push(fb.paperPublicId);
    console.log(`[V01] checkout created order=${fb.orderPublicId} amount=${fb.chargedAmountCents} ${fb.currency}`);

    const duplicate = await handleCreateOrder({ ip: "203.0.113.202", env, body });
    expect(duplicate.status).toBe(200);
    const db = duplicate.body as { checkoutUrl?: string; accessToken?: string };
    expect(db.checkoutUrl).toBe(fb.checkoutUrl);
    expect(db.accessToken).toBeUndefined();
  }, 120_000);

  it("denies generation before the webhook confirms payment", async () => {
    expect(state.paperPublicId).toBeTruthy();
    const result = await handleGenerateNext({
      paperPublicId: state.paperPublicId!,
      token: state.token!,
      env,
      store,
    });
    expect(result.status).toBe(422);
    expect((result.body as { code?: string }).code).toBe("PAYMENT_REQUIRED");
  }, 60_000);

  it("rejects invalid signature and wrong amount; accepts the valid signed webhook", async () => {
    expect(state.orderPublicId).toBeTruthy();
    const order = await store.findOrderByPublicId(state.orderPublicId!);
    expect(order).toBeTruthy();
    const amount = (order!.chargedAmountCents / 100).toFixed(2);
    const currency = order!.currency;
    const secret = env.BACHS_WEBHOOK_SECRET!;
    const ts = String(Math.floor(Date.now() / 1000));

    const makeEvent = (overrides: Record<string, unknown> = {}) => ({
      id: `evt_${Math.random().toString(36).slice(2, 12)}`,
      type: "collection.succeeded",
      data: {
        charge_id: `chg_${Math.random().toString(36).slice(2, 12)}`,
        status: "succeeded",
        amount,
        currency,
        metadata: { orderPublicId: state.orderPublicId },
        reference: state.orderPublicId,
        ...overrides,
      },
    });

    const sign = (raw: string, timestamp: string) =>
      createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex");

    const invalid = await handleBachsWebhook({
      rawBody: JSON.stringify(makeEvent()),
      timestamp: ts,
      signature: "deadbeef",
      env,
      store,
    });
    expect(invalid.status).toBe(401);

    const wrongAmountEvent = makeEvent({ amount: "1.00" });
    const wrongAmountRaw = JSON.stringify(wrongAmountEvent);
    const wrongAmount = await handleBachsWebhook({
      rawBody: wrongAmountRaw,
      timestamp: ts,
      signature: sign(wrongAmountRaw, ts),
      env,
      store,
    });
    expect(wrongAmount.status).toBe(422);

    const validEvent = makeEvent();
    const validRaw = JSON.stringify(validEvent);
    const valid = await handleBachsWebhook({
      rawBody: validRaw,
      timestamp: ts,
      signature: sign(validRaw, ts),
      env,
      store,
    });
    expect(valid.status).toBe(200);

    const paper = await store.findPaperByPublicId(state.paperPublicId!);
    expect(paper?.status).toBe("ready");
    console.log(`[V01] payment confirmed, paper status=${paper?.status}`);

    const duplicateRaw = validRaw;
    const dupTs = String(Math.floor(Date.now() / 1000));
    const duplicate = await handleBachsWebhook({
      rawBody: duplicateRaw,
      timestamp: dupTs,
      signature: sign(duplicateRaw, dupTs),
      env,
      store,
    });
    expect(duplicate.status).toBe(200);
    expect((duplicate.body as { alreadyPaid?: boolean }).alreadyPaid).toBe(true);
  }, 90_000);

  it("generates a complete literature review step by step", async () => {
    expect(state.paperPublicId).toBeTruthy();
    let paper = await store.findPaperByPublicId(state.paperPublicId!);
    let guard = 0;
    while (paper?.status !== "completed" && guard < 30) {
      guard += 1;
      resetResearchRateLimit();
      const result = await handleGenerateNext({
        paperPublicId: state.paperPublicId!,
        token: state.token!,
        env,
        store,
      });
      const body = result.body as { stepId?: string; replayed?: boolean; status?: string; code?: string; message?: string };
      console.log(
        `[V01] generate step=${body.stepId} replayed=${body.replayed} status=${result.status} code=${body.code ?? ""} ${body.message ?? ""}`,
      );
      if (result.status !== 200) {
        break;
      }
      paper = await store.findPaperByPublicId(state.paperPublicId!);
    }
    expect(paper?.status).toBe("completed");
    const sections = paper?.sections ?? [];
    expect(sections.length).toBeGreaterThan(1);
    for (const section of sections) {
      expect(section.generationStatus).toBe("complete");
      expect((section.plainText ?? "").length).toBeGreaterThan(0);
    }
    console.log(`[V01] completed with ${sections.length} sections`);
  }, 600_000);

  it("persists edits, enforces two-tab conflict, and regenerates within quota", async () => {
    expect(state.paperPublicId).toBeTruthy();
    const paper = await store.findPaperByPublicId(state.paperPublicId!);
    expect(paper).toBeTruthy();
    const version = paper!.editorVersion ?? 0;

    const contentJson = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2, sectionId: paper!.sections[0].sectionId }, content: [{ type: "text", text: paper!.sections[0].title }] },
        { type: "paragraph", content: [{ type: "text", text: "V01 edited body with a bullet list below." }] },
        { type: "bulletList", content: [
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "V01 first bullet" }] }] },
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "V01 second bullet" }] }] },
        ] },
        { type: "paragraph", content: [{ type: "text", text: "Cites " }, { type: "citation", attrs: { refIds: [paper!.references[0].refId] } }] },
      ],
    };

    const saved = await handlePatchPaper({
      paperPublicId: state.paperPublicId!,
      token: state.token!,
      env,
      store,
      body: { editorVersion: version, contentJson },
    });
    expect(saved.status).toBe(200);
    expect((saved.body as { editorVersion: number }).editorVersion).toBe(version + 1);

    const stale = await handlePatchPaper({
      paperPublicId: state.paperPublicId!,
      token: state.token!,
      env,
      store,
      body: { editorVersion: version, contentJson },
    });
    expect(stale.status).toBe(409);
    console.log(`[V01] edit saved, stale write rejected with 409`);

    const last = await store.findPaperByPublicId(state.paperPublicId!);
    const sectionToRegen = last!.sections[0].sectionId;
    for (let i = 0; i < 3; i += 1) {
      resetResearchRateLimit();
      const r = await handleRegenerateSection({
        paperPublicId: state.paperPublicId!,
        token: state.token!,
        env,
        store,
        body: { sectionId: sectionToRegen },
      });
      console.log(`[V01] regenerate #${i + 1} status=${r.status}`);
      expect(r.status).toBe(200);
    }
    resetResearchRateLimit();
    const fourth = await handleRegenerateSection({
      paperPublicId: state.paperPublicId!,
      token: state.token!,
      env,
      store,
      body: { sectionId: sectionToRegen },
    });
    expect(fourth.status).toBe(422);
    expect((fourth.body as { code?: string }).code).toBe("REGENERATION_QUOTA_EXCEEDED");
    console.log(`[V01] quota enforced after 3 regenerations`);
  }, 600_000);

  it("changes citation style and exports matching DOCX and PDF", async () => {
    expect(state.paperPublicId).toBeTruthy();
    const before = await store.findPaperByPublicId(state.paperPublicId!);
    const tokens = JSON.stringify(before!.sections.map((s) => s.contentJson));

    resetResearchRateLimit();
    const styled = await handlePatchPaper({
      paperPublicId: state.paperPublicId!,
      token: state.token!,
      env,
      store,
      body: { editorVersion: before!.editorVersion, citationStyle: "ieee" },
    });
    expect(styled.status).toBe(200);
    const after = await store.findPaperByPublicId(state.paperPublicId!);
    expect(JSON.stringify(after!.sections.map((s) => s.contentJson))).toBe(tokens);
    console.log(`[V01] style switched to IEEE without rewriting tokens`);

    const docx = await handleExportPaper({
      paperPublicId: state.paperPublicId!,
      format: "docx",
      token: state.token!,
      env,
      store,
    });
    const pdf = await handleExportPaper({
      paperPublicId: state.paperPublicId!,
      format: "pdf",
      token: state.token!,
      env,
      store,
    });
    expect(docx.status).toBe(200);
    expect(pdf.status).toBe(200);
    expect(docx.bytes?.byteLength ?? 0).toBeGreaterThan(100);
    expect(pdf.bytes?.byteLength ?? 0).toBeGreaterThan(100);
    console.log(`[V01] exports produced docx=${docx.bytes?.byteLength} pdf=${pdf.bytes?.byteLength}`);

    const zip = await JSZip.loadAsync(docx.bytes!);
    const documentXml = await zip.file("word/document.xml")!.async("string");
    expect(documentXml).toContain(after!.title.slice(0, 20));
    expect(documentXml).toContain("References");
    const referenceTitle = after!.references[0]?.title ?? "";
    if (referenceTitle) {
      expect(documentXml).toContain(referenceTitle.slice(0, 15));
    }
    const pdfDoc = await PDFDocument.load(pdf.bytes!);
    expect(pdfDoc.getPageCount()).toBeGreaterThan(0);
    console.log(
      `[V01] export content verified (title, references, ${pdfDoc.getPageCount()} pdf pages)`,
    );
  }, 180_000);

  it("returns paper projection without the access token hash", async () => {
    expect(state.paperPublicId).toBeTruthy();
    const result = await handleGetPaper({
      paperPublicId: state.paperPublicId!,
      token: state.token!,
      env,
      store,
    });
    expect(result.status).toBe(200);
    expect(JSON.stringify(result.body)).not.toContain("accessTokenHash");
  }, 60_000);

  it("resumes generation after an interruption without duplicating sections", async () => {
    const created = await createPaidPaper({
      title: "V01 resume run on citation practice and verification",
      paperType: "literature_review",
      references: [{ id: "ref_01", originalInput: "10.1038/nature14539" }],
      ip: "203.0.113.211",
    });
    for (let i = 0; i < 2; i += 1) {
      resetResearchRateLimit();
      const step = await handleGenerateNext({
        paperPublicId: created.paperPublicId,
        token: created.token,
        env,
        store,
        ip: "198.51.100.11",
      });
      expect(step.status).toBe(200);
    }
    const midway = await store.findPaperByPublicId(created.paperPublicId);
    expect(midway?.status).not.toBe("completed");

    const paper = await generateToCompletion(
      created.paperPublicId,
      created.token,
      "198.51.100.11",
    );
    expect(paper?.status).toBe("completed");
    const ids = (paper?.sections ?? []).map((section) => section.sectionId);
    expect(new Set(ids).size).toBe(ids.length);

    const sectionsBefore = paper!.sections.length;
    resetResearchRateLimit();
    const replay = await handleGenerateNext({
      paperPublicId: created.paperPublicId,
      token: created.token,
      env,
      store,
      ip: "198.51.100.11",
    });
    expect(replay.status).toBe(200);
    const after = await store.findPaperByPublicId(created.paperPublicId);
    expect(after!.sections.length).toBe(sectionsBefore);
    console.log(`[V01] resumed cleanly with ${sectionsBefore} unique sections`);
  }, 600_000);

  it("original research uses supplied findings and completes", async () => {
    const created = await createPaidPaper({
      title: "V01 original research draft on application triage",
      focus: "Effects of a triage checklist on approval timelines",
      paperType: "original_research_draft",
      actualMethodology:
        "We reviewed 120 synthetic applications handled at one district office during 2024 using a structured triage checklist.",
      actualFindings:
        "Median approval time fell by nine days after the checklist was introduced, with no change in the refusal rate.",
      references: [{ id: "ref_01", originalInput: "10.1038/nature14539" }],
      ip: "203.0.113.212",
    });
    const paper = await generateToCompletion(
      created.paperPublicId,
      created.token,
      "198.51.100.12",
    );
    expect(paper?.status).toBe("completed");
    const types = (paper?.sections ?? []).map((section) => section.type);
    expect(types).toContain("methodology");
    expect(types).toContain("results_discussion");
    for (const section of paper!.sections) {
      expect(section.generationStatus).toBe("complete");
    }
    console.log(`[V01] original research completed with types ${types.join(",")}`);
  }, 600_000);

  it("research proposal does not write completed results", async () => {
    const created = await createPaidPaper({
      title: "V01 proposal for a citation metadata verification pipeline",
      focus: "A proposed approach to verifying citation metadata automatically",
      paperType: "research_proposal",
      references: [{ id: "ref_01", originalInput: "10.1038/nature14539" }],
      ip: "203.0.113.213",
    });
    const paper = await generateToCompletion(
      created.paperPublicId,
      created.token,
      "198.51.100.13",
    );
    expect(paper?.status).toBe("completed");
    expect(
      (paper?.sections ?? []).some((section) => section.type === "results_discussion"),
    ).toBe(false);
    console.log(`[V01] proposal completed without a results section`);
  }, 600_000);

  it("handles a longer paper with a longer reference list", async () => {
    const dois = [
      "10.1038/nature14539",
      "10.1038/nature12373",
      "10.1126/science.169.3946.635",
      "10.1103/PhysRevLett.116.061102",
      "10.1145/3290605.3300233",
      "10.1038/nmat3601",
    ];
    const created = await createPaidPaper({
      title: "V01 longer literature review across computing and physical sciences",
      focus: "Cross disciplinary citation practice and evidence quality",
      paperType: "literature_review",
      requestedPages: 15,
      references: dois.map((doi, index) => ({
        id: `ref_${String(index + 1).padStart(2, "0")}`,
        originalInput: doi,
      })),
      ip: "203.0.113.214",
    });
    const paper = await generateToCompletion(
      created.paperPublicId,
      created.token,
      "198.51.100.14",
    );
    expect(paper?.status).toBe("completed");
    const sections = paper?.sections ?? [];
    expect(sections.length).toBeGreaterThanOrEqual(6);
    expect(sections.every((section) => (section.actualWords ?? 0) > 0)).toBe(true);
    expect((paper?.generation?.bibliography ?? []).length).toBeGreaterThanOrEqual(1);
    console.log(
      `[V01] longer paper completed with ${sections.length} sections and ${(paper?.generation?.bibliography ?? []).length} bibliography entries`,
    );
  }, 900_000);
});
