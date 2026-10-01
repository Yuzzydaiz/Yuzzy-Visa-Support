import { describe, expect, it, beforeEach } from "vitest";

import { hashAccessToken } from "@/lib/research/auth/accessToken";
import type { LlmClient } from "@/lib/research/ai/client";
import {
  applyPaperBibliography,
  applyRenderedPaper,
} from "@/lib/research/generation/apply";
import { handleGenerateNext } from "@/lib/research/generation/next";
import { resetResolveRateLimit } from "@/lib/research/http/rateLimitStub";
import type { OrderStore } from "@/lib/research/orders/store";
import type { PaperDocument } from "@/lib/models/Paper";
import {
  tiptapDocToSections,
  validateTiptapDoc,
  type TiptapDoc,
} from "@/lib/research/editor/document";
import { parseResearchProductConfig } from "@/lib/config/research-product";
import { createPaperDetailsSchema } from "@/lib/validation/research";

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

function memoryStore(paper: Record<string, unknown>): OrderStore {
  const papers = new Map([[String(paper.publicId), paper]]);
  return {
    async findByIdempotencyKey() { return null; },
    async createPaperAndOrder() { return { paperPublicId: "", orderPublicId: "" }; },
    async saveCheckout() {},
    async findOrderByPublicId() { return null; },
    async findOrderByCheckoutId() { return null; },
    async findPaperByPublicId(publicId: string) {
      return (papers.get(publicId) as unknown as PaperDocument) ?? null;
    },
    async savePaper(next) {
      papers.set(next.publicId, { ...next } as unknown as Record<string, unknown>);
    },
    async findPaperForOrder() { return null; },
    async recordWebhookEvent() { return "inserted"; },
    async markPaid() { return { alreadyPaid: false }; },
  };
}

function section(id: string, type: string, text: string, budget = 150) {
  return {
    sectionId: id,
    type,
    title: id,
    order: 0,
    contentJson: {
      sectionId: id,
      title: id,
      paragraphs: [{ text }],
      usedReferenceIds: [],
      wordCountEstimate: budget,
    },
    plainText: "",
    targetWords: budget,
    actualWords: 0,
    citedRefIds: [],
    generationStatus: "pending" as const,
  };
}

describe("R08 coherence replacements are validated", () => {
  beforeEach(() => resetResolveRateLimit());

  it("rejects an uncited empirical coherence edit and keeps the validated section", async () => {
    const base = {
      publicId: "pap_coh",
      title: "Verified sources in visa-related research writing",
      focus: "Citation practice",
      paperType: "literature_review",
      citationStyle: "apa",
      requestedPages: 10,
      targetWords: 3000,
      status: "generating",
      accessTokenHash: hashAccessToken(TOKEN, "pepper"),
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
      sections: [section("abstract", "abstract", "")],
      generation: {
        completedSteps: ["outline"],
        attempts: 1,
        version: 1,
        bibliography: [],
      },
    };
    const store = memoryStore(base);
    const valid = words(120);
    const client: LlmClient = {
      async completeJson(input: { system: string }) {
        if (input.system.includes("Improve coherence")) {
          return {
            text: JSON.stringify({
              sections: [
                {
                  sectionId: "abstract",
                  paragraphs: [
                    {
                      text: `${words(110, "")} The sample size was 500 participants with p < 0.05.`,
                    },
                  ],
                },
              ],
            }),
            usage: { inputTokens: 1, outputTokens: 1 },
          };
        }
        return {
          text: JSON.stringify({
            sectionId: "abstract",
            title: "Abstract",
            paragraphs: [{ text: valid }],
            usedReferenceIds: ["ref_01"],
            limitations: [],
            wordCountEstimate: 120,
          }),
          usage: { inputTokens: 1, outputTokens: 1 },
        };
      },
    };

    const result = await handleGenerateNext({
      paperPublicId: "pap_coh",
      token: TOKEN,
      env,
      store,
      llm: client,
    });
    expect(result.status).toBe(200);
    const paper = (await store.findPaperByPublicId("pap_coh"))!;
    const text = paper.sections[0]!.plainText;
    expect(text).not.toContain("500 participants");
    expect(paper.sections[0]!.contentJson).toMatchObject({
      paragraphs: [{ text: valid }],
    });
  });
});

describe("R09 paper-wide citation numbering", () => {
  it("numbers different references consistently across sections and bibliography", () => {
    const paper = {
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
        section("abstract", "abstract", words(40, "[CITE:ref_01]"), 100),
        section("conclusion", "conclusion", words(40, "[CITE:ref_02]"), 100),
      ],
      generation: { completedSteps: [], bibliography: [] },
    } as unknown as PaperDocument;

    applyRenderedPaper(paper, [
      { refId: "ref_01", title: "Climate synthesis", authors: ["Ada Example"], year: 2020, evidence: "", contentStatus: "abstract" },
      { refId: "ref_02", title: "Soil nitrogen", authors: ["Bea Second"], year: 2019, evidence: "", contentStatus: "abstract" },
    ]);
    applyPaperBibliography(paper, [
      { refId: "ref_01", title: "Climate synthesis", authors: ["Ada Example"], year: 2020, evidence: "", contentStatus: "abstract" },
      { refId: "ref_02", title: "Soil nitrogen", authors: ["Bea Second"], year: 2019, evidence: "", contentStatus: "abstract" },
    ]);

    expect(paper.sections[0]!.plainText).toContain("[1]");
    expect(paper.sections[1]!.plainText).toContain("[2]");
    expect(paper.sections[1]!.plainText).not.toContain("[1]");
    expect(paper.generation?.bibliography).toHaveLength(2);
    expect(paper.generation?.bibliography?.[0]).toMatch(/^\[1\]/);
    expect(paper.generation?.bibliography?.[1]).toMatch(/^\[2\]/);
  });
});

describe("R04 supported editor content is preserved and validated", () => {
  const doc: TiptapDoc = {
    type: "doc",
    content: [
      { type: "heading", attrs: { level: 2, sectionId: "abstract" }, content: [{ type: "text", text: "Abstract" }] },
      {
        type: "paragraph",
        content: [{ type: "text", text: "Bold claim", marks: [{ type: "bold" }] }],
      },
      {
        type: "bulletList",
        content: [
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "First point" }] }] },
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Second point" }] }] },
        ],
      },
      {
        type: "blockquote",
        content: [{ type: "paragraph", content: [{ type: "text", text: "Quoted evidence" }] }],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "See " },
          { type: "citation", attrs: { refIds: ["ref_01"] } },
        ],
      },
    ],
  };

  it("keeps lists and blockquotes instead of dropping them", () => {
    const mapped = tiptapDocToSections(doc, [{ sectionId: "abstract", title: "Abstract" }]);
    const joined = mapped[0]!.paragraphs.map((paragraph) => paragraph.text).join("\n");
    expect(joined).toContain("- First point");
    expect(joined).toContain("- Second point");
    expect(joined).toContain("> Quoted evidence");
    expect(joined).toContain("[CITE:ref_01]");
  });

  it("accepts supported content and rejects unknown citation ids", () => {
    expect(validateTiptapDoc(doc, new Set(["ref_01"]))).toEqual({ ok: true });
    const bad = validateTiptapDoc(doc, new Set(["ref_02"]));
    expect(bad.ok).toBe(false);
  });
});

describe("R10 order email is required when leaving details", () => {
  const config = parseResearchProductConfig({});
  const base = {
    title: "Verified sources in visa-related research writing",
    paperType: "literature_review" as const,
    authors: [{ name: "Ada Example", affiliation: "Example University" }],
    citationStyle: "apa" as const,
    requestedPages: 10,
    allowAdditionalSources: false,
  };

  it("strict details reject a missing order email", () => {
    const parsed = createPaperDetailsSchema(config, { requireOrderEmail: true }).safeParse(base);
    expect(parsed.success).toBe(false);
  });

  it("strict details accept a valid order email", () => {
    const parsed = createPaperDetailsSchema(config, { requireOrderEmail: true }).safeParse({
      ...base,
      customerEmail: "buyer@example.com",
    });
    expect(parsed.success).toBe(true);
  });
});
