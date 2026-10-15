import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { hashAccessToken } from "@/lib/research/auth/accessToken";
import type { LlmClient } from "@/lib/research/ai/client";
import { citationFormatter } from "@/lib/research/citations/editor-labels";
import { renderCitations } from "@/lib/research/citations/render";
import type { CiteSource } from "@/lib/research/citations/styles";
import { idempotencyKeyFor, orderBody } from "@/lib/research/checkout-draft";
import { defaultResearchDraft, IDEMPOTENCY_STORAGE_KEY, DRAFT_STORAGE_KEY } from "@/lib/research/draft";
import { buildSourceManifest } from "@/lib/research/generation/manifest";
import { handleGenerateNext } from "@/lib/research/generation/next";
import { partBudget, partsFor } from "@/lib/research/generation/parts";
import { handleRegenerateSection } from "@/lib/research/generation/regenerate";
import { resetResolveRateLimit } from "@/lib/research/http/rateLimitStub";
import { handleCreateOrder } from "@/lib/research/orders/http";
import type { OrderStore } from "@/lib/research/orders/store";
import { createOpenAlexClient } from "@/lib/research/references/openalex";
import {
  ReferenceProvidersUnavailableError,
  resolveReferences,
  type ResolveInput,
} from "@/lib/research/references/resolve";
import type { CanonicalWork } from "@/lib/research/references/types";
import type { PaperDocument } from "@/lib/models/Paper";

const env = {
  MONGODB_URI: "mongodb://localhost/test",
  OPENAI_API_KEY: "sk-test",
  BACHS_API_KEY: "sk_sandbox_test",
  BACHS_WEBHOOK_SECRET: "whsec",
  BACHS_API_BASE_URL: "https://sandbox-api.bachs.io",
  APP_BASE_URL: "http://localhost:3000",
  RECOVERY_TOKEN_PEPPER: "pepper",
};

const TOKEN = "secret-token";

function words(count: number, prefix = "word") {
  return Array.from({ length: count }, (_, index) =>
    index === 0 ? prefix : "word",
  ).join(" ");
}

function work(overrides: Partial<CanonicalWork> = {}): CanonicalWork {
  return {
    title: "A stable climate meta analysis",
    authors: ["Ada Example"],
    year: 2020,
    doi: "10.1000/base",
    provider: "crossref",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Checkout: ambiguous picks, positional matching, server refIds (fixes 1 and 3)
// ---------------------------------------------------------------------------

function captureStore() {
  const created: { paper?: Record<string, unknown> } = {};
  const store = {
    async findByIdempotencyKey() {
      return null;
    },
    async createPaperAndOrder(input: {
      paper: Record<string, unknown>;
      order: Record<string, unknown>;
    }) {
      created.paper = input.paper;
      return {
        paperPublicId: String(input.paper.publicId),
        orderPublicId: String(input.order.publicId),
      };
    },
    async saveCheckout() {},
  } as unknown as OrderStore;
  return { store, created };
}

const bachs = {
  createCheckout: async () => ({
    checkoutId: "chk_1",
    checkoutUrl: "https://checkout.bachs.io/c/test",
  }),
  getTransaction: async () => ({}),
};

const paperFields = {
  title: "Verified sources in visa-related research writing",
  paperType: "literature_review" as const,
  authors: [{ name: "Ada Example", affiliation: "Example University" }],
  citationStyle: "apa" as const,
  requestedPages: 10,
  allowAdditionalSources: false,
  customerEmail: "buyer@example.com",
};

describe("checkout re-verifies what the user actually selected", () => {
  beforeEach(() => resetResolveRateLimit());

  it("accepts a candidate picked for an ambiguous citation by re-verifying its DOI", async () => {
    const { store, created } = captureStore();
    const seen: string[] = [];
    const resolve = async (inputs: ResolveInput[]) =>
      inputs.map((item) => {
        seen.push(item.originalInput);
        // The free-text citation is ambiguous by definition; only the DOI of
        // the chosen work resolves to a single verified match.
        return item.originalInput === "10.1000/picked"
          ? {
              id: item.id,
              originalInput: item.originalInput,
              inputType: "doi" as const,
              verificationStatus: "verified" as const,
              contentStatus: "abstract" as const,
              matched: work({ doi: "10.1000/picked", title: "The picked work" }),
              candidates: [],
            }
          : {
              id: item.id,
              originalInput: item.originalInput,
              inputType: "citation" as const,
              verificationStatus: "ambiguous" as const,
              contentStatus: "metadata_only" as const,
              candidates: [work(), work({ doi: "10.1000/picked" })],
            };
      });

    const result = await handleCreateOrder({
      ip: "203.0.113.20",
      env,
      store,
      bachs,
      resolve,
      body: {
        idempotencyKey: "idem-ambiguous-pick",
        paper: paperFields,
        references: [
          {
            id: "3f2a9c1e-browser-uuid",
            originalInput: "Example climate review 2020",
            verificationStatus: "verified",
            contentStatus: "abstract",
            matched: { title: "The picked work", authors: ["Ada Example"], doi: "10.1000/picked" },
          },
        ],
      },
    });

    expect(result.status).toBe(201);
    expect(seen).toEqual(["10.1000/picked"]);
    const references = created.paper?.references as Array<Record<string, unknown>>;
    expect(references[0]).toMatchObject({
      title: "The picked work",
      doi: "10.1000/picked",
      // The customer's original text is still what we record as their input.
      originalInput: "Example climate review 2020",
    });
  });

  it("matches results by position so identical citation text keeps both picks", async () => {
    const { store, created } = captureStore();
    const resolve = async (inputs: ResolveInput[]) =>
      inputs.map((item) => ({
        id: item.id,
        originalInput: item.originalInput,
        inputType: "doi" as const,
        verificationStatus: "verified" as const,
        contentStatus: "abstract" as const,
        matched: work({ doi: item.originalInput, title: `Work ${item.originalInput}` }),
        candidates: [],
      }));

    const result = await handleCreateOrder({
      ip: "203.0.113.21",
      env,
      store,
      bachs,
      resolve,
      body: {
        idempotencyKey: "idem-duplicate-text",
        paper: paperFields,
        references: ["10.1000/a", "10.1000/b"].map((doi, index) => ({
          id: `browser-uuid-${index}`,
          originalInput: "Smith climate review",
          verificationStatus: "verified",
          matched: { title: `Work ${doi}`, authors: ["Ada Example"], doi },
        })),
      },
    });

    expect(result.status).toBe(201);
    const references = created.paper?.references as Array<Record<string, unknown>>;
    expect(references.map((reference) => reference.doi)).toEqual([
      "10.1000/a",
      "10.1000/b",
    ]);
  });

  it("assigns short server refIds and keeps volume, issue and pages", async () => {
    const { store, created } = captureStore();
    const resolve = async (inputs: ResolveInput[]) =>
      inputs.map((item) => ({
        id: item.id,
        originalInput: item.originalInput,
        inputType: "doi" as const,
        verificationStatus: "verified" as const,
        contentStatus: "abstract" as const,
        matched: work({
          doi: item.originalInput,
          volume: "521",
          issue: "7553",
          pages: "436-444",
        }),
        candidates: [],
      }));

    const result = await handleCreateOrder({
      ip: "203.0.113.22",
      env,
      store,
      bachs,
      resolve,
      body: {
        idempotencyKey: "idem-server-refids",
        paper: paperFields,
        references: ["10.1000/a", "10.1000/b"].map((doi) => ({
          id: crypto.randomUUID(),
          originalInput: doi,
          verificationStatus: "verified",
          matched: { title: "Work", authors: ["Ada Example"], doi },
        })),
      },
    });

    expect(result.status).toBe(201);
    const references = created.paper?.references as Array<Record<string, unknown>>;
    expect(references.map((reference) => reference.refId)).toEqual([
      "ref_01",
      "ref_02",
    ]);
    expect(references[0]).toMatchObject({
      volume: "521",
      issue: "7553",
      pages: "436-444",
    });
  });
});

// ---------------------------------------------------------------------------
// Editor citation chips show reader-facing labels (fix 3)
// ---------------------------------------------------------------------------

describe("editor citation labels", () => {
  const sources = [
    { refId: "ref_01", title: "Zeta work", authors: ["Zoe Zhang"], year: 2021 },
    { refId: "ref_02", title: "Alpha work", authors: ["Ada Adams"], year: 2019 },
  ];
  const doc = {
    type: "doc" as const,
    content: [
      {
        type: "paragraph",
        content: [
          { type: "citation", attrs: { refIds: ["ref_02"] } },
          { type: "citation", attrs: { refIds: ["ref_01"] } },
        ],
      },
    ],
  };

  it("renders author-date labels, never the internal ids", () => {
    const format = citationFormatter("apa", sources, doc);
    expect(format(["ref_01"])).toBe("(Zhang, 2021)");
    expect(format(["ref_01"])).not.toContain("ref_");
  });

  it("numbers IEEE labels in first-citation order", () => {
    const format = citationFormatter("ieee", sources, doc);
    expect(format(["ref_02"])).toBe("[1]");
    expect(format(["ref_01"])).toBe("[2]");
  });

  it("falls back to a neutral label for an unknown source", () => {
    expect(citationFormatter("apa", sources, doc)(["ref_99"])).toBe("(citation)");
  });
});

// ---------------------------------------------------------------------------
// Checkout idempotency key is bound to the order contents (fix 4)
// ---------------------------------------------------------------------------

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
}

describe("checkout idempotency key", () => {
  it("reuses the key for an unchanged draft and issues a new one after an edit", () => {
    const storage = memoryStorage();
    let counter = 0;
    const newKey = () => `key-${(counter += 1)}`;
    const draft = { ...defaultResearchDraft(), title: "A long enough paper title" };

    const first = idempotencyKeyFor(JSON.stringify(orderBody(draft)), storage, newKey);
    const retry = idempotencyKeyFor(JSON.stringify(orderBody(draft)), storage, newKey);
    const edited = idempotencyKeyFor(
      JSON.stringify(orderBody({ ...draft, requestedPages: 20 })),
      storage,
      newKey,
    );

    expect(retry).toBe(first);
    expect(edited).not.toBe(first);
  });

  it("clears the draft and key once payment is confirmed", async () => {
    const local = memoryStorage();
    const session = memoryStorage();
    local.setItem(DRAFT_STORAGE_KEY, "{}");
    session.setItem(IDEMPOTENCY_STORAGE_KEY, "{}");
    const globals = globalThis as unknown as { window?: unknown };
    globals.window = { localStorage: local, sessionStorage: session };
    try {
      const { clearResearchDraft } = await import(
        "@/components/research/use-research-draft"
      );
      clearResearchDraft();
      expect(local.values.has(DRAFT_STORAGE_KEY)).toBe(false);
      expect(session.values.has(IDEMPOTENCY_STORAGE_KEY)).toBe(false);
    } finally {
      delete globals.window;
    }
  });
});

// ---------------------------------------------------------------------------
// Bibliography order and locators (fix 5)
// ---------------------------------------------------------------------------

describe("bibliography", () => {
  const sources: CiteSource[] = [
    {
      refId: "ref_01",
      authors: ["Zoe Zhang"],
      year: 2021,
      title: "Zeta work",
      journal: "Nature",
      volume: "521",
      issue: "7553",
      pages: "436-444",
      contentStatus: "abstract",
    },
    {
      refId: "ref_02",
      authors: ["Ada Adams"],
      year: 2019,
      title: "Alpha work",
      contentStatus: "abstract",
    },
  ];
  const text = "First [CITE:ref_01]. Second [CITE:ref_02].";
  const allowedIds = new Set(["ref_01", "ref_02"]);

  it("sorts author-date styles alphabetically", () => {
    const { bibliography } = renderCitations({ text, style: "apa", sources, allowedIds });
    expect(bibliography[0]).toMatch(/^Adams/);
    expect(bibliography[1]).toMatch(/^Zhang/);
  });

  it("keeps first-citation order for numbered styles", () => {
    const { bibliography } = renderCitations({ text, style: "ieee", sources, allowedIds });
    expect(bibliography[0]).toMatch(/^\[1\] Zhang/);
    expect(bibliography[1]).toMatch(/^\[2\] Adams/);
  });

  it("prints volume, issue and pages, carried through the source manifest", () => {
    const manifest = buildSourceManifest([
      {
        refId: "ref_01",
        title: "Zeta work",
        authors: ["Zoe Zhang"],
        volume: "521",
        issue: "7553",
        pages: "436-444",
        verificationStatus: "verified",
        contentStatus: "abstract",
      },
    ]);
    expect(manifest[0]).toMatchObject({ volume: "521", issue: "7553", pages: "436-444" });
    const { bibliography } = renderCitations({ text, style: "apa", sources, allowedIds });
    expect(bibliography.join("\n")).toContain("521 (7553) 436-444");
  });
});

// ---------------------------------------------------------------------------
// Long sections are written and regenerated in parts (fix 6)
// ---------------------------------------------------------------------------

describe("section parts", () => {
  it("splits budgets into parts that sum to the section budget", () => {
    expect(partsFor(800)).toBe(1);
    expect(partsFor(1000)).toBe(1);
    expect(partsFor(4200)).toBe(5);
    const total = 5;
    const parts = Array.from({ length: total }, (_, index) =>
      partBudget(4200, index, total),
    );
    expect(parts.reduce((sum, value) => sum + value, 0)).toBe(4200);
    expect(Math.max(...parts)).toBeLessThanOrEqual(1000);
  });
});

const LONG_BUDGET = 2500; // three parts of ~834 words

function sectionPart(sectionId: string, label: string) {
  // Four paragraphs of 200 words, so the coherence pass can edit boundaries.
  return {
    sectionId,
    title: "Literature review",
    paragraphs: [1, 2, 3, 4].map((n) => ({
      text: `${words(198, `${label}p${n}`)} [CITE:ref_01]`,
    })),
    usedReferenceIds: ["ref_01"],
    limitations: [],
    wordCountEstimate: 800,
  };
}

function paperStore(paper: Record<string, unknown>) {
  const papers = new Map([[String(paper.publicId), paper]]);
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
    async savePaper(next: PaperDocument) {
      papers.set(next.publicId, { ...next } as unknown as Record<string, unknown>);
    },
    async findPaperForOrder() {
      return null;
    },
    async recordWebhookEvent() {
      return "inserted" as const;
    },
    async markPaid() {
      return { alreadyPaid: false };
    },
  } satisfies OrderStore;
}

const reference = {
  refId: "ref_01",
  title: "Climate synthesis",
  authors: ["Ada Example"],
  year: 2020,
  verificationStatus: "verified",
  selectedByUser: true,
  contentStatus: "abstract",
  abstract: "Evidence abstract.",
};

const outlineItem = {
  sectionId: "literature_review",
  type: "literature_review",
  title: "Literature review",
  order: 0,
  arguments: [],
  wordBudget: LONG_BUDGET,
  plannedRefIds: ["ref_01"],
};

describe("generate-next writes a long section in parts", () => {
  beforeEach(() => resetResolveRateLimit());

  it("needs one request per part, continues from the previous text, and completes once", async () => {
    const store = paperStore({
      publicId: "pap_parts",
      title: "Verified sources in visa-related research writing",
      focus: "Citation practice",
      paperType: "literature_review",
      citationStyle: "apa",
      requestedPages: 10,
      targetWords: LONG_BUDGET,
      status: "generating",
      accessTokenHash: hashAccessToken(TOKEN, "pepper"),
      references: [reference],
      outline: [outlineItem],
      sections: [
        {
          sectionId: "literature_review",
          type: "literature_review",
          title: "Literature review",
          order: 0,
          plainText: "",
          targetWords: LONG_BUDGET,
          actualWords: 0,
          citedRefIds: [],
          generationStatus: "pending",
          generationAttempts: 0,
          partsTotal: 3,
          partsDone: 0,
        },
      ],
      generation: { completedSteps: ["outline"], attempts: 1, version: 1, bibliography: [] },
    });
    const sectionCalls: Array<{ system: string; user: string; maxTokens: number }> = [];
    let coherenceUser = "";
    const llm: LlmClient = {
      async completeJson(input) {
        if (input.system.includes("Improve coherence")) {
          coherenceUser = input.user;
          return {
            text: JSON.stringify({
              sections: [
                {
                  sectionId: "literature_review",
                  opening: `${words(198, "Smoothed")} [CITE:ref_01]`,
                  closing: "",
                },
              ],
            }),
            usage: { inputTokens: 1, outputTokens: 1 },
          };
        }
        sectionCalls.push(input);
        return {
          text: JSON.stringify(sectionPart("literature_review", `part${sectionCalls.length}`)),
          usage: { inputTokens: 1, outputTokens: 1 },
        };
      },
    };

    const steps: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      const result = await handleGenerateNext({
        paperPublicId: "pap_parts",
        token: TOKEN,
        env,
        store,
        llm,
      });
      expect(result.status).toBe(200);
      steps.push((result.body as { stepId: string }).stepId);
      const paper = (await store.findPaperByPublicId("pap_parts"))!;
      if (i < 2) {
        expect(paper.sections[0]!.generationStatus).toBe("pending");
        expect(paper.status).toBe("generating");
      }
    }

    expect(steps).toEqual([
      "literature_review#1",
      "literature_review#2",
      "literature_review#3",
    ]);
    expect(sectionCalls).toHaveLength(3);
    // Each call carries only its own part budget, so it fits the timeout.
    for (const call of sectionCalls) {
      expect(call.system).toMatch(/part \d of 3/);
      expect(call.maxTokens).toBeLessThanOrEqual(4000);
    }
    expect(sectionCalls[1]!.user).toContain("part1p4");

    const paper = (await store.findPaperByPublicId("pap_parts"))!;
    expect(paper.status).toBe("completed");
    expect(paper.sections[0]!.generationStatus).toBe("complete");
    const paragraphs = (paper.sections[0]!.contentJson as { paragraphs: Array<{ text: string }> })
      .paragraphs;
    expect(paragraphs).toHaveLength(12);
    // The coherence pass saw only boundary paragraphs and changed only those.
    expect(coherenceUser).toContain("part1p1");
    expect(coherenceUser).toContain("part3p4");
    expect(coherenceUser).not.toContain("part2p2");
    expect(paragraphs[0]!.text.startsWith("Smoothed")).toBe(true);
    expect(paragraphs[1]!.text.startsWith("part1p2")).toBe(true);
  });
});

describe("regenerating a long section", () => {
  beforeEach(() => resetResolveRateLimit());
  afterEach(() => resetResolveRateLimit());

  function completedPaper() {
    const original = sectionPart("literature_review", "orig");
    return {
      publicId: "pap_regen_parts",
      title: "Verified sources in visa-related research writing",
      focus: "Citation practice",
      paperType: "literature_review",
      citationStyle: "apa",
      requestedPages: 10,
      targetWords: LONG_BUDGET + 150,
      status: "completed",
      accessTokenHash: hashAccessToken(TOKEN, "pepper"),
      references: [reference],
      outline: [
        outlineItem,
        { ...outlineItem, sectionId: "conclusion", type: "conclusion", title: "Conclusion", order: 1, wordBudget: 150 },
      ],
      sections: [
        {
          sectionId: "literature_review",
          type: "literature_review",
          title: "Literature review",
          order: 0,
          contentJson: original,
          plainText: "",
          targetWords: LONG_BUDGET,
          actualWords: 800,
          citedRefIds: ["ref_01"],
          generationStatus: "complete",
          partsTotal: 3,
          partsDone: 3,
        },
        {
          sectionId: "conclusion",
          type: "conclusion",
          title: "Conclusion",
          order: 1,
          contentJson: {
            sectionId: "conclusion",
            title: "Conclusion",
            paragraphs: [{ text: `${words(120)} [CITE:ref_01]` }],
            usedReferenceIds: ["ref_01"],
            wordCountEstimate: 120,
          },
          plainText: "",
          targetWords: 150,
          actualWords: 120,
          citedRefIds: ["ref_01"],
          generationStatus: "complete",
        },
      ],
      regeneration: { used: 0, limit: 3 },
      editorVersion: 4,
      generation: { completedSteps: [], attempts: 1, version: 1, bibliography: [] },
    };
  }

  it("stages parts, refuses another section meanwhile, and counts one regeneration on commit", async () => {
    const store = paperStore(completedPaper());
    let calls = 0;
    const llm: LlmClient = {
      async completeJson() {
        calls += 1;
        return {
          text: JSON.stringify(sectionPart("literature_review", `new${calls}`)),
          usage: { inputTokens: 1, outputTokens: 1 },
        };
      },
    };
    const call = (sectionId: string) =>
      handleRegenerateSection({
        paperPublicId: "pap_regen_parts",
        token: TOKEN,
        body: { sectionId },
        env,
        store,
        llm,
      });

    const first = await call("literature_review");
    expect(first.status).toBe(200);
    let paper = (await store.findPaperByPublicId("pap_regen_parts"))!;
    expect(paper.regeneration?.used).toBe(0);
    expect((first.body as { regeneration: { pending: unknown } }).regeneration.pending).toEqual({
      sectionId: "literature_review",
      partsDone: 1,
      partsTotal: 3,
    });
    // The section text is untouched until every part is written.
    expect(
      (paper.sections[0]!.contentJson as { paragraphs: Array<{ text: string }> }).paragraphs[0]!
        .text.startsWith("orig"),
    ).toBe(true);

    const other = await call("conclusion");
    expect(other.status).toBe(409);
    expect(calls).toBe(1);

    await call("literature_review");
    const last = await call("literature_review");
    expect(last.status).toBe(200);
    expect(calls).toBe(3);

    paper = (await store.findPaperByPublicId("pap_regen_parts"))!;
    expect(paper.regeneration?.used).toBe(1);
    expect((last.body as { regeneration: { pending: unknown } }).regeneration.pending).toBeNull();
    const paragraphs = (paper.sections[0]!.contentJson as { paragraphs: Array<{ text: string }> })
      .paragraphs;
    expect(paragraphs).toHaveLength(12);
    expect(paragraphs[0]!.text.startsWith("new1")).toBe(true);
    expect(paragraphs[11]!.text.startsWith("new3")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Reference matching survives one provider failing (found in the production
// sandbox test: a "?" in a citation made OpenAlex return 400, which failed
// matching for every source in the request)
// ---------------------------------------------------------------------------

describe("reference matching resilience", () => {
  const bender = work({
    title: "On the Dangers of Stochastic Parrots: Can Language Models Be Too Big?",
    authors: ["Emily M. Bender", "Timnit Gebru"],
    year: 2021,
    doi: "10.1145/3442188.3445922",
  });
  const citation =
    "Bender, E. M., Gebru, T. (2021). On the dangers of stochastic parrots: Can language models be too big?";

  it("strips OpenAlex wildcard characters from free-text searches", async () => {
    const urls: string[] = [];
    const client = createOpenAlexClient({
      email: "ops@example.com",
      fetchImpl: (async (url: string) => {
        urls.push(url);
        return new Response(JSON.stringify({ results: [] }), { status: 200 });
      }) as unknown as typeof fetch,
    });
    await client.searchTitle("Can language models be too big? Or *every* model");
    const search = new URL(urls[0]!).searchParams.get("search");
    expect(search).toBe("Can language models be too big Or every model");
  });

  it("still verifies from Crossref when OpenAlex fails", async () => {
    const failures: string[] = [];
    const [result] = await resolveReferences([{ id: "r1", originalInput: citation }], {
      crossref: {
        lookupDoi: async () => undefined,
        searchBibliographic: async () => [bender],
      },
      openalex: {
        lookupDoi: async () => undefined,
        searchTitle: async () => {
          throw new Error("OpenAlex request failed (400)");
        },
        searchWorks: async () => [],
      },
      onProviderError: (provider) => failures.push(provider),
    });
    expect(result!.verificationStatus).toBe("verified");
    expect(result!.matched?.doi).toBe("10.1145/3442188.3445922");
    expect(failures).toEqual(["openalex"]);
  });

  it("falls back to OpenAlex for a DOI when Crossref is down", async () => {
    const [result] = await resolveReferences(
      [{ id: "r1", originalInput: "10.1145/3442188.3445922" }],
      {
        crossref: {
          lookupDoi: async () => {
            throw new Error("Crossref request failed (503)");
          },
          searchBibliographic: async () => [],
        },
        openalex: {
          lookupDoi: async () => ({ ...bender, provider: "openalex" as const }),
          searchTitle: async () => [],
          searchWorks: async () => [],
        },
      },
    );
    expect(result!.verificationStatus).toBe("verified");
  });

  it("reports a retryable error, not 'unverified', when every provider fails", async () => {
    const down = async () => {
      throw new Error("network down");
    };
    await expect(
      resolveReferences([{ id: "r1", originalInput: citation }], {
        crossref: { lookupDoi: down, searchBibliographic: down },
        openalex: { lookupDoi: down, searchTitle: down, searchWorks: down },
      }),
    ).rejects.toBeInstanceOf(ReferenceProvidersUnavailableError);
  });
});

// Real Crossref results for a full APA citation (production sandbox test,
// 2026-10-15). The right paper only scored 0.18 on plain word overlap,
// because the citation also contains authors, year, and venue.
describe("matching a full citation", () => {
  const apa =
    "Bender, E. M., Gebru, T., McMillan-Major, A., & Shmitchell, S. (2021). On the dangers of stochastic parrots: Can language models be too big? Proceedings of the 2021 ACM Conference on Fairness, Accountability, and Transparency.";
  const paper = work({
    title: "On the Dangers of Stochastic Parrots",
    authors: ["Emily M. Bender", "Timnit Gebru"],
    year: 2021,
    doi: "10.1145/3442188.3445922",
  });
  const proceedings = work({
    title:
      "Proceedings of the 2021 ACM Conference on Fairness, Accountability, and Transparency",
    authors: [],
    year: 2021,
    doi: "10.1145/3442188",
  });
  const other = work({
    title: "Group Fairness",
    authors: ["Michele Räz"],
    year: 2021,
    doi: "10.1145/3442188.3445876",
  });

  function deps(results: CanonicalWork[]) {
    return {
      crossref: {
        lookupDoi: async () => undefined,
        searchBibliographic: async () => results,
      },
      openalex: {
        lookupDoi: async () => undefined,
        searchTitle: async () => [],
        searchWorks: async () => [],
      },
    };
  }

  it("verifies the paper, not the proceedings volume it appeared in", async () => {
    const [result] = await resolveReferences(
      [{ id: "r1", originalInput: apa }],
      deps([paper, proceedings, other]),
    );
    expect(result!.verificationStatus).toBe("verified");
    expect(result!.matched?.doi).toBe("10.1145/3442188.3445922");
  });

  it("does not verify a contained title when the named author disagrees", async () => {
    const [result] = await resolveReferences(
      [{ id: "r1", originalInput: apa }],
      deps([{ ...paper, authors: ["Someone Else"], doi: "10.1000/impostor" }]),
    );
    expect(result!.verificationStatus).not.toBe("verified");
  });
});
