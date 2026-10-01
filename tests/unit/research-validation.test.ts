import { describe, expect, it } from "vitest";

import { parseResearchProductConfig } from "@/lib/config/research";
import {
  ResearchApiError,
  httpStatusForCode,
  researchErrorBody,
} from "@/lib/research/http/errors";
import {
  detectReferenceInputType,
  getResearchValidationSchemas,
} from "@/lib/validation/research";

const schemas = getResearchValidationSchemas(parseResearchProductConfig({}));

const validDetails = {
  title: "Climate policy evidence in recent meta analyses",
  paperType: "literature_review" as const,
  authors: [{ name: "Ada Example", affiliation: "Example University" }],
  citationStyle: "apa" as const,
  requestedPages: 10,
  allowAdditionalSources: false,
};

describe("reference input detection", () => {
  it("detects DOI, URL, and citation text", () => {
    expect(detectReferenceInputType("10.1038/nature12373")).toBe("doi");
    expect(detectReferenceInputType("https://doi.org/10.1038/nature12373")).toBe(
      "doi",
    );
    expect(detectReferenceInputType("https://example.com/paper")).toBe("url");
    expect(
      detectReferenceInputType("Smith J. Example title. Nature. 2020."),
    ).toBe("citation");
  });
});

describe("paper details schema", () => {
  it("accepts a valid literature review", () => {
    const parsed = schemas.paperDetails.parse(validDetails);
    expect(parsed.title).toContain("Climate");
  });

  it("requires an author affiliation", () => {
    const result = schemas.paperDetails.safeParse({
      ...validDetails,
      authors: [{ name: "Ada Example" }],
    });
    expect(result.success).toBe(false);
  });

  it("accepts optional focus and email when omitted", () => {
    const result = schemas.paperDetails.safeParse({
      ...validDetails,
      focus: "",
      customerEmail: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejects titles under 10 characters", () => {
    const result = schemas.paperDetails.safeParse({
      ...validDetails,
      title: "Too short",
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown citation styles", () => {
    const result = schemas.paperDetails.safeParse({
      ...validDetails,
      citationStyle: "ama",
    });
    expect(result.success).toBe(false);
  });

  it("rejects page counts outside configured limits", () => {
    expect(
      schemas.paperDetails.safeParse({ ...validDetails, requestedPages: 9 })
        .success,
    ).toBe(false);
    expect(
      schemas.paperDetails.safeParse({ ...validDetails, requestedPages: 41 })
        .success,
    ).toBe(false);
  });

  it("requires method and findings for original research", () => {
    const result = schemas.paperDetails.safeParse({
      ...validDetails,
      paperType: "original_research_draft",
    });
    expect(result.success).toBe(false);
  });

  it("accepts original research when method and findings are supplied", () => {
    const result = schemas.paperDetails.safeParse({
      ...validDetails,
      paperType: "original_research_draft",
      actualMethodology: "Interviews with 12 participants using a fixed protocol",
      actualFindings: "Participants reported three recurring barriers to filing",
    });
    expect(result.success).toBe(true);
  });
});

describe("patch and export schemas", () => {
  it("rejects unknown patch keys including price fields", () => {
    const result = schemas.paperPatch.safeParse({
      editorVersion: 1,
      chargedAmountCents: 1,
    });
    expect(result.success).toBe(false);
  });

  it("accepts docx and pdf export formats only", () => {
    expect(schemas.exportQuery.parse({ format: "docx" }).format).toBe("docx");
    expect(schemas.exportQuery.safeParse({ format: "html" }).success).toBe(
      false,
    );
  });
});

describe("research API errors", () => {
  it("maps codes to HTTP statuses and strips secrets from details", () => {
    expect(httpStatusForCode("RATE_LIMITED")).toBe(429);
    expect(httpStatusForCode("VERSION_CONFLICT")).toBe(409);
    expect(httpStatusForCode("GENERATION_RETRYABLE")).toBe(503);
    expect(httpStatusForCode("VALIDATION_FAILED")).toBe(422);

    const error = new ResearchApiError({
      code: "ACCESS_DENIED",
      message: "Missing recovery token",
      requestId: "req_1",
      details: { _id: "mongo-id", token: "raw", reason: "no-cookie" },
    });
    const body = researchErrorBody(error);
    expect(body.details).toEqual({ reason: "no-cookie" });
    expect(JSON.stringify(body)).not.toContain("mongo-id");
  });
});
