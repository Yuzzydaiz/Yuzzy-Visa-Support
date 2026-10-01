export const CITATION_STYLE_IDS = [
  "apa",
  "ieee",
  "mla",
  "vancouver",
  "harvard",
  "chicago",
] as const;

export type CitationStyleId = (typeof CITATION_STYLE_IDS)[number];

export const PAPER_TYPES = [
  "literature_review",
  "research_proposal",
  "original_research_draft",
] as const;

export type PaperType = (typeof PAPER_TYPES)[number];

export const DEFAULT_CURRENCY = "NGN";
export const MINOR_UNITS_PER_MAJOR = 100;
export const DEFAULT_PRICE_PER_PAGE_NAIRA = 250;
export const DEFAULT_PRICE_PER_PAGE_KOBO =
  DEFAULT_PRICE_PER_PAGE_NAIRA * MINOR_UNITS_PER_MAJOR;
export const DEFAULT_MINIMUM_ORDER_KOBO =
  10 * DEFAULT_PRICE_PER_PAGE_KOBO;
export const DEFAULT_WRITING_MODEL = "gpt-5.6-terra";
export const DEFAULT_UTILITY_MODEL = "gpt-5.6-luna";

export type ResearchProductConfig = {
  wordsPerPage: number;
  pricePerPageCents: number;
  minimumOrderCents: number;
  currency: string;
  minPages: number;
  maxPages: number;
  maxReferences: number;
  maxAdditionalSources: number;
  regenerationLimit: number;
  writingModel: string;
  utilityModel: string;
  citationStyleIds: readonly CitationStyleId[];
  wizardStrict: boolean;
};

function parseWizardStrict(raw: string | undefined): boolean {
  if (raw === undefined || raw.trim() === "") {
    return true;
  }
  const value = raw.trim().toLowerCase();
  if (value === "true" || value === "1") {
    return true;
  }
  if (value === "false" || value === "0") {
    return false;
  }
  throw new Error("NEXT_PUBLIC_RESEARCH_WIZARD_STRICT must be true or false");
}

function parsePositiveInt(
  raw: string | undefined,
  fallback: number,
  name: string,
): number {
  if (raw === undefined || raw.trim() === "") {
    return fallback;
  }
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value < 1) {
    throw new Error(`Invalid ${name}`);
  }
  return value;
}

export function parseResearchProductConfig(
  env: Record<string, string | undefined> = process.env,
): ResearchProductConfig {
  const wordsPerPage = parsePositiveInt(env.WORDS_PER_PAGE, 300, "WORDS_PER_PAGE");
  const pricePerPageCents = parsePositiveInt(
    env.PRICE_PER_PAGE_CENTS,
    DEFAULT_PRICE_PER_PAGE_KOBO,
    "PRICE_PER_PAGE_CENTS",
  );
  const minimumOrderCents = parsePositiveInt(
    env.MINIMUM_ORDER_CENTS,
    DEFAULT_MINIMUM_ORDER_KOBO,
    "MINIMUM_ORDER_CENTS",
  );
  const minPages = parsePositiveInt(env.MIN_PAGES, 10, "MIN_PAGES");
  const maxPages = parsePositiveInt(env.MAX_PAGES, 40, "MAX_PAGES");
  const maxReferences = parsePositiveInt(env.MAX_REFERENCES, 25, "MAX_REFERENCES");
  const maxAdditionalSources = parsePositiveInt(
    env.MAX_ADDITIONAL_SOURCES,
    5,
    "MAX_ADDITIONAL_SOURCES",
  );
  const regenerationLimit = parsePositiveInt(
    env.REGENERATION_LIMIT,
    3,
    "REGENERATION_LIMIT",
  );

  if (minPages > maxPages) {
    throw new Error("MIN_PAGES cannot exceed MAX_PAGES");
  }

  const writingModel = env.OPENAI_WRITING_MODEL?.trim() || DEFAULT_WRITING_MODEL;
  const utilityModel = env.OPENAI_UTILITY_MODEL?.trim() || DEFAULT_UTILITY_MODEL;

  if (writingModel === "gpt-5.6" || utilityModel === "gpt-5.6") {
    throw new Error("Do not use the bare gpt-5.6 alias; it routes to Sol");
  }

  return {
    wordsPerPage,
    pricePerPageCents,
    minimumOrderCents,
    currency: env.RESEARCH_CURRENCY?.trim() || DEFAULT_CURRENCY,
    minPages,
    maxPages,
    maxReferences,
    maxAdditionalSources,
    regenerationLimit,
    writingModel,
    utilityModel,
    citationStyleIds: CITATION_STYLE_IDS,
    wizardStrict: parseWizardStrict(env.NEXT_PUBLIC_RESEARCH_WIZARD_STRICT),
  };
}

let productCache: ResearchProductConfig | undefined;

export function getResearchProductConfig(): ResearchProductConfig {
  productCache ??= parseResearchProductConfig();
  return productCache;
}

export function resetResearchProductConfigCache() {
  productCache = undefined;
}

export type OrderPricing = {
  requestedPages: number;
  wordsPerPage: number;
  targetWords: number;
  unitPriceCents: number;
  subtotalCents: number;
  minimumChargeCents: number;
  chargedAmountCents: number;
};

export function calculateOrderPricing(
  requestedPages: number,
  config: ResearchProductConfig = getResearchProductConfig(),
): OrderPricing {
  if (!Number.isInteger(requestedPages) || requestedPages < 1) {
    throw new Error("requestedPages must be a positive integer");
  }

  const subtotalCents = requestedPages * config.pricePerPageCents;
  return {
    requestedPages,
    wordsPerPage: config.wordsPerPage,
    targetWords: requestedPages * config.wordsPerPage,
    unitPriceCents: config.pricePerPageCents,
    subtotalCents,
    minimumChargeCents: config.minimumOrderCents,
    chargedAmountCents: Math.max(subtotalCents, config.minimumOrderCents),
  };
}

export function formatMoneyFromMinorUnits(
  minorUnits: number,
  currency: string = DEFAULT_CURRENCY,
): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
  }).format(minorUnits / MINOR_UNITS_PER_MAJOR);
}
