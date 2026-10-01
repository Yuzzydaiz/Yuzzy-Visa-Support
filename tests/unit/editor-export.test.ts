import { describe, expect, it, beforeEach } from "vitest";

import { hashAccessToken } from "@/lib/research/auth/accessToken";
import type { LlmClient } from "@/lib/research/ai/client";
import { sectionsToTiptapDoc, tiptapDocToSections, type TiptapDoc } from "@/lib/research/editor/document";
import { buildDocx } from "@/lib/research/export/docx";
import { handleExportPaper } from "@/lib/research/export/http";
import { buildNormalizedExport, sanitizeExportFilename } from "@/lib/research/export/model";
import { buildPdf } from "@/lib/research/export/pdf";
import { allocateOutline } from "@/lib/research/generation/outline";
import { handleRegenerateSection } from "@/lib/research/generation/regenerate";
import { resetResolveRateLimit } from "@/lib/research/http/rateLimitStub";
import type { OrderStore } from "@/lib/research/orders/store";
import type { PaperDocument } from "@/lib/models/Paper";
import { handleGetPaper } from "@/lib/research/papers/http";
import { handlePatchPaper } from "@/lib/research/papers/patch";

const env = {
  MONGODB_URI: "mongodb://localhost/test",
  OPENAI_API_KEY: "sk-test",
  BACHS_API_KEY: "k",
  BACHS_WEBHOOK_SECRET: "s",
  BACHS_API_BASE_URL: "https://sandbox-api.bachs.io",
  APP_BASE_URL: "http://localhost:3000",
  RECOVERY_TOKEN_PEPPER: "pepper",
};

const TOKEN = "secret-token";

function words(count: number, cite = "[CITE:ref_01]") {
  return `${Array.from({ length: count }, () => "word").join(" ")} ${cite}`;
}

function completedPaper(overrides: Record<string, unknown> = {}) {
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
    publicId: "pap_edit",
    title: "Verified sources in visa-related research writing",
    focus: "Citation practice",
    paperType: "literature_review",
    citationStyle: "apa",
    requestedPages: 10,
    targetWords: 3000,
    status: "completed",
    editorVersion: 0,
    authors: [{ name: "José Müller", affiliation: "Example University" }],
    accessTokenHash: hashAccessToken(TOKEN, "pepper"),
    regeneration: { used: 0, limit: 3 },
    references: [
      {
        refId: "ref_01",
        title: "Climate synthesis",
        authors: ["Ada Example"],
        year: 2020,
        verificationStatus: "verified",
        selectedByUser: true,
        contentStatus: "abstract",
        abstract: "Evidence abstract.",
      },
    ],
    outline,
    sections: outline.map((item) => ({
      sectionId: item.sectionId,
      type: item.type,
      title: item.title,
      order: item.order,
      contentJson: {
        sectionId: item.sectionId,
        title: item.title,
        paragraphs: [{ text: words(120) }],
        usedReferenceIds: ["ref_01"],
        wordCountEstimate: 120,
      },
      plainText: "Hello (Example, 2020).",
      targetWords: item.wordBudget,
      actualWords: 120,
      citedRefIds: ["ref_01"],
      generationStatus: "complete",
    })),
    generation: {
      completedSteps: ["outline", ...outline.map((item) => item.sectionId)],
      bibliography: ["Example (2020). Climate synthesis."],
      version: 1,
    },
    ...overrides,
  };
}

function memoryStore(paper: Record<string, unknown>): OrderStore {
  const papers = new Map([[String(paper.publicId), { ...paper }]]);
  return {
    async findByIdempotencyKey() {
      return null;
    },
    async createPaperAndOrder() {
      return { paperPublicId: "", orderPublicId: "" };
    },
    async saveCheckout() {},
    async findOrderByPublicId() {
      return null;
    },
    async findOrderByCheckoutId() {
      return null;
    },
    async findPaperByPublicId(publicId: string) {
      return (papers.get(publicId) as unknown as PaperDocument) ?? null;
    },
    async savePaper(next) {
      papers.set(next.publicId, { ...next } as unknown as Record<string, unknown>);
    },
    async findPaperForOrder() {
      return null;
    },
    async recordWebhookEvent() {
      return "inserted";
    },
    async markPaid() {
      return { alreadyPaid: false };
    },
  };
}

describe("PATCH paper", () => {
  beforeEach(() => {
    resetResolveRateLimit();
  });

  it("rejects a stale editorVersion", async () => {
    const store = memoryStore(completedPaper({ editorVersion: 2 }));
    const result = await handlePatchPaper({
      paperPublicId: "pap_edit",
      token: TOKEN,
      env,
      store,
      body: { editorVersion: 0, title: "Verified sources in visa-related research writing" },
    });
    expect(result.status).toBe(409);
    expect((result.body as { code: string }).code).toBe("VERSION_CONFLICT");
  });

  it("saves TipTap JSON and bumps editorVersion", async () => {
    const store = memoryStore(completedPaper());
    const contentJson = sectionsToTiptapDoc([
      {
        sectionId: "abstract",
        title: "Abstract",
        paragraphs: [{ text: words(90) }],
      },
    ]);
    const result = await handlePatchPaper({
      paperPublicId: "pap_edit",
      token: TOKEN,
      env,
      store,
      body: { editorVersion: 0, contentJson },
    });
    expect(result.status).toBe(200);
    expect((result.body as { editorVersion: number }).editorVersion).toBe(1);
  });

  it("rejects a fabricated citation id and does not persist it", async () => {
    const store = memoryStore(completedPaper());
    const contentJson = sectionsToTiptapDoc([
      {
        sectionId: "abstract",
        title: "Abstract",
        paragraphs: [{ text: words(90, "[CITE:ref_99]") }],
      },
    ]);
    const result = await handlePatchPaper({
      paperPublicId: "pap_edit",
      token: TOKEN,
      env,
      store,
      body: { editorVersion: 0, contentJson },
    });
    expect(result.status).toBe(422);
    const paper = await store.findPaperByPublicId("pap_edit");
    const json = paper?.sections[0]?.contentJson as { paragraphs?: Array<{ text: string }> };
    expect(json?.paragraphs?.[0]?.text).not.toContain("ref_99");
  });

  it("re-renders citations when style changes without rewriting tokens", async () => {
    const store = memoryStore(completedPaper());
    const before = await store.findPaperByPublicId("pap_edit");
    const tokens = (before?.sections[0]?.contentJson as { paragraphs: Array<{ text: string }> })
      .paragraphs[0].text;
    expect(tokens).toContain("[CITE:ref_01]");
    const result = await handlePatchPaper({
      paperPublicId: "pap_edit",
      token: TOKEN,
      env,
      store,
      body: { editorVersion: 0, citationStyle: "ieee" },
    });
    expect(result.status).toBe(200);
    const after = await store.findPaperByPublicId("pap_edit");
    const afterTokens = (
      after?.sections[0]?.contentJson as { paragraphs: Array<{ text: string }> }
    ).paragraphs[0].text;
    expect(afterTokens).toBe(tokens);
    expect(after?.citationStyle).toBe("ieee");
    expect(after?.sections[0]?.plainText).toMatch(/\[1\]/);
    expect(after?.generation?.bibliography?.[0]).toMatch(/^\[1\]/);
  });
});

describe("GET paper projection", () => {
  it("includes editor fields without the access token hash", async () => {
    const store = memoryStore(
      completedPaper({
        editorDocument: {
          type: "doc",
          content: [
            { type: "heading", attrs: { level: 2, sectionId: "abstract" }, content: [{ type: "text", text: "Abstract" }] },
            { type: "paragraph", content: [{ type: "text", text: "Body" }] },
          ],
        },
      }),
    );
    const result = await handleGetPaper({
      paperPublicId: "pap_edit",
      token: TOKEN,
      env,
      store,
    });
    expect(result.status).toBe(200);
    const serialized = JSON.stringify(result.body);
    expect(serialized).not.toContain("accessTokenHash");
    expect(result.body).toHaveProperty("editorVersion");
    expect(result.body).toHaveProperty("editorDocument");
    expect(result.body).toHaveProperty("references");
    expect(result.body).toHaveProperty("regeneration");
  });
});

describe("regenerate quota", () => {
  beforeEach(() => {
    resetResolveRateLimit();
  });

  it("allows three successes then blocks the fourth without calling OpenAI", async () => {
    const store = memoryStore(completedPaper());
    const llm: LlmClient & { calls: number } = {
      calls: 0,
      async completeJson() {
        llm.calls += 1;
        return {
          text: JSON.stringify({
            sectionId: "abstract",
            title: "Abstract",
            paragraphs: [{ text: words(90) }],
            usedReferenceIds: ["ref_01"],
            wordCountEstimate: 90,
          }),
          usage: { inputTokens: 1, outputTokens: 1 },
        };
      },
    };
    for (let i = 0; i < 3; i += 1) {
      const result = await handleRegenerateSection({
        paperPublicId: "pap_edit",
        token: TOKEN,
        env,
        store,
        llm,
        body: { sectionId: "abstract" },
      });
      expect(result.status).toBe(200);
    }
    const callsAfterThree = llm.calls;
    const blocked = await handleRegenerateSection({
      paperPublicId: "pap_edit",
      token: TOKEN,
      env,
      store,
      llm,
      body: { sectionId: "abstract" },
    });
    expect(blocked.status).toBe(422);
    expect((blocked.body as { code: string }).code).toBe("REGENERATION_QUOTA_EXCEEDED");
    expect(llm.calls).toBe(callsAfterThree);
  });

  it("does not consume quota when citations stay invalid", async () => {
    const store = memoryStore(completedPaper());
    const llm: LlmClient & { calls: number } = {
      calls: 0,
      async completeJson() {
        llm.calls += 1;
        return {
          text: JSON.stringify({
            sectionId: "abstract",
            title: "Abstract",
            paragraphs: [{ text: words(90, "[CITE:ref_99]") }],
            usedReferenceIds: ["ref_99"],
            wordCountEstimate: 90,
          }),
          usage: { inputTokens: 1, outputTokens: 1 },
        };
      },
    };
    const result = await handleRegenerateSection({
      paperPublicId: "pap_edit",
      token: TOKEN,
      env,
      store,
      llm,
      body: { sectionId: "abstract" },
    });
    expect(result.status).toBe(422);
    const paper = await store.findPaperByPublicId("pap_edit");
    expect(paper?.regeneration?.used ?? 0).toBe(0);
  });
});

describe("regeneration preserves the canonical editor document", () => {
  beforeEach(() => {
    resetResolveRateLimit();
  });

  it("updates editorDocument for the regenerated section so it is not stale", async () => {
    const editorDocument = sectionsToTiptapDoc([
      {
        sectionId: "abstract",
        title: "Abstract",
        paragraphs: [{ text: "OLD abstract [CITE:ref_01]" }],
      },
    ]);
    const store = memoryStore(completedPaper({ editorDocument }));
    const llm: LlmClient = {
      async completeJson() {
        return {
          text: JSON.stringify({
            sectionId: "abstract",
            title: "Abstract",
            paragraphs: [{ text: words(90) }],
            usedReferenceIds: ["ref_01"],
            wordCountEstimate: 90,
          }),
          usage: { inputTokens: 5, outputTokens: 5 },
        };
      },
    };
    const result = await handleRegenerateSection({
      paperPublicId: "pap_edit",
      token: TOKEN,
      env,
      store,
      llm,
      body: { sectionId: "abstract" },
    });
    expect(result.status).toBe(200);
    const paper = await store.findPaperByPublicId("pap_edit");
    const mapped = tiptapDocToSections(paper!.editorDocument as TiptapDoc, []);
    const text = mapped[0]?.paragraphs.map((paragraph) => paragraph.text).join(" ") ?? "";
    expect(text).toContain("word");
    expect(text).not.toContain("OLD abstract");
  });
});

describe("normalized export", () => {
  it("includes section headings and bibliography keys", () => {
    const model = buildNormalizedExport(completedPaper() as unknown as PaperDocument);
    expect(model.sections[0]?.title).toBeTruthy();
    expect(model.bibliography.length).toBeGreaterThan(0);
    expect(sanitizeExportFilename("Hello / World!!")).toBe("hello-world");
  });

  it("builds non-empty docx and pdf buffers", async () => {
    const model = buildNormalizedExport(completedPaper() as unknown as PaperDocument);
    const docx = await buildDocx(model);
    const pdf = await buildPdf(model);
    expect(docx.byteLength).toBeGreaterThan(100);
    expect(pdf.byteLength).toBeGreaterThan(100);
  });

  it("numbers citations across the whole paper in the export model", () => {
    const paper = completedPaper({
      citationStyle: "ieee",
      references: [
        {
          refId: "ref_01",
          title: "Climate synthesis",
          authors: ["Ada Example"],
          year: 2020,
          verificationStatus: "verified",
          selectedByUser: true,
          contentStatus: "abstract",
        },
        {
          refId: "ref_02",
          title: "Soil nitrogen",
          authors: ["Bea Second"],
          year: 2019,
          verificationStatus: "verified",
          selectedByUser: true,
          contentStatus: "abstract",
        },
      ],
      sections: [
        {
          sectionId: "abstract",
          type: "abstract",
          title: "Abstract",
          order: 0,
          contentJson: {
            sectionId: "abstract",
            title: "Abstract",
            paragraphs: [{ text: "One [CITE:ref_01]." }],
            usedReferenceIds: ["ref_01"],
            wordCountEstimate: 3,
          },
          plainText: "",
          targetWords: 150,
          actualWords: 0,
          citedRefIds: ["ref_01"],
          generationStatus: "complete",
        },
        {
          sectionId: "conclusion",
          type: "conclusion",
          title: "Conclusion",
          order: 1,
          contentJson: {
            sectionId: "conclusion",
            title: "Conclusion",
            paragraphs: [{ text: "Two [CITE:ref_02]." }],
            usedReferenceIds: ["ref_02"],
            wordCountEstimate: 3,
          },
          plainText: "",
          targetWords: 150,
          actualWords: 0,
          citedRefIds: ["ref_02"],
          generationStatus: "complete",
        },
      ],
      generation: { completedSteps: [], bibliography: [] },
    });
    const model = buildNormalizedExport(paper as unknown as PaperDocument);
    expect(model.sections[0]?.paragraphs.join(" ")).toContain("[1]");
    expect(model.sections[1]?.paragraphs.join(" ")).toContain("[2]");
    expect(model.bibliography[0]).toMatch(/^\[1\]/);
    expect(model.bibliography[1]).toMatch(/^\[2\]/);
  });

  it("keeps supported list and quote text in the export model", () => {
    const paper = completedPaper({
      sections: [
        {
          sectionId: "abstract",
          type: "abstract",
          title: "Abstract",
          order: 0,
          contentJson: {
            sectionId: "abstract",
            title: "Abstract",
            paragraphs: [
              { text: "Intro paragraph." },
              { text: "- First point" },
              { text: "- Second point" },
              { text: "> Quoted evidence" },
            ],
            usedReferenceIds: [],
            wordCountEstimate: 8,
          },
          plainText: "",
          targetWords: 150,
          actualWords: 0,
          citedRefIds: [],
          generationStatus: "complete",
        },
      ],
      generation: { completedSteps: [], bibliography: [] },
    });
    const model = buildNormalizedExport(paper as unknown as PaperDocument);
    const joined = model.sections[0]?.paragraphs.join("\n") ?? "";
    expect(joined).toContain("- First point");
    expect(joined).toContain("> Quoted evidence");
  });

  it("denies export without a token", async () => {
    const result = await handleExportPaper({
      paperPublicId: "pap_edit",
      format: "docx",
      env,
      store: memoryStore(completedPaper()),
    });
    expect(result.status).toBe(401);
  });
});
