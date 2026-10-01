import { z } from "zod";

import {
  CITATION_STYLE_IDS,
  PAPER_TYPES,
  type ResearchProductConfig,
  parseResearchProductConfig,
} from "@/lib/config/research-product";

const DOI_PATTERN = /^10\.\d{4,9}\/\S+$/i;

export function detectReferenceInputType(
  raw: string,
): "doi" | "url" | "citation" {
  const value = raw.trim();
  const withoutPrefix = value.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");
  if (DOI_PATTERN.test(withoutPrefix) || /^doi:\s*10\./i.test(value)) {
    return "doi";
  }
  if (/^https?:\/\//i.test(value)) {
    return "url";
  }
  return "citation";
}

function optionalText(max: number, minWhenPresent = 0) {
  return z
    .string()
    .trim()
    .max(max)
    .optional()
    .refine(
      (value) =>
        value === undefined ||
        value.length === 0 ||
        value.length >= minWhenPresent,
      {
        message: `Must be at least ${minWhenPresent} characters when provided`,
      },
    );
}

const optionalEmail = z
  .union([z.literal(""), z.string().trim().email()])
  .optional();

const authorSchema = z.object({
  name: z.string().trim().min(1).max(200),
  affiliation: z.string().trim().min(1).max(300),
  department: optionalText(200),
  email: optionalEmail,
  orcid: optionalText(50),
});

export function createPaperDetailsSchema(
  config: ResearchProductConfig,
  options: { requireOrderEmail?: boolean } = {},
) {
  return z
    .object({
      title: z.string().trim().min(10).max(300),
      focus: optionalText(2000, 10),
      paperType: z.enum(PAPER_TYPES),
      authors: z.array(authorSchema).min(1),
      citationStyle: z.enum(CITATION_STYLE_IDS),
      requestedPages: z
        .number()
        .int()
        .min(config.minPages)
        .max(config.maxPages),
      allowAdditionalSources: z.boolean(),
      researchNotes: optionalText(8000),
      actualMethodology: optionalText(8000),
      actualFindings: optionalText(8000),
      customerEmail: optionalEmail,
    })
    .superRefine((value, ctx) => {
      if (value.paperType === "original_research_draft") {
        if (!value.actualMethodology || value.actualMethodology.length < 10) {
          ctx.addIssue({
            code: "custom",
            path: ["actualMethodology"],
            message: "Original research requires the actual methodology",
          });
        }
        if (!value.actualFindings || value.actualFindings.length < 10) {
          ctx.addIssue({
            code: "custom",
            path: ["actualFindings"],
            message: "Original research requires actual findings; they will not be invented",
          });
        }
      }
      if (options.requireOrderEmail) {
        const email = value.customerEmail?.trim() ?? "";
        if (!email || !z.string().email().safeParse(email).success) {
          ctx.addIssue({
            code: "custom",
            path: ["customerEmail"],
            message: "Enter the email that should receive this order",
          });
        }
      }
    });
}

export function createReferenceInputSchema() {
  return z.object({
    originalInput: z.string().trim().min(3).max(2000),
    userProvidedNotes: z.string().trim().max(8000).optional(),
    isUserKeyReference: z.boolean().optional(),
  }).transform((value) => ({
    ...value,
    inputType: detectReferenceInputType(value.originalInput),
  }));
}

export function createReferenceListSchema(config: ResearchProductConfig) {
  const item = createReferenceInputSchema();
  return z
    .array(item)
    .min(1)
    .max(config.maxReferences);
}

export function createResolveRequestSchema(config: ResearchProductConfig) {
  return z.object({
    references: z
      .array(
        z.object({
          id: z.string().trim().min(1).max(80).optional(),
          originalInput: z.string().trim().min(3).max(2000),
          userProvidedNotes: z.string().trim().max(8000).optional(),
        }),
      )
      .min(1)
      .max(config.maxReferences),
  });
}

export function createDiscoverRequestSchema(config: ResearchProductConfig) {
  return z.object({
    allowAdditionalSources: z.boolean(),
    title: z.string().trim().min(10).max(300),
    focus: optionalText(2000),
    references: z
      .array(
        z.object({
          originalInput: z.string().trim().min(3).max(2000),
          title: z.string().trim().min(1).max(500).optional(),
          doi: z.string().trim().max(200).optional(),
          year: z.number().int().optional(),
          authors: z.array(z.string()).optional(),
        }),
      )
      .max(config.maxReferences),
  });
}

export function createOrderRequestSchema(config: ResearchProductConfig) {
  return z.object({
    chargedAmountCents: z.number().int().optional(),
    idempotencyKey: z.string().trim().min(8).max(120),
    paper: createPaperDetailsSchema(config, { requireOrderEmail: true }).safeExtend({
      customerEmail: z.string().trim().email(),
    }),
    references: z
      .array(
        z.object({
          id: z.string().trim().min(1).max(80).optional(),
          originalInput: z.string().trim().min(3).max(2000),
          userProvidedNotes: z.string().trim().max(8000).optional(),
          verificationStatus: z.enum(["verified", "ambiguous", "unverified"]),
          contentStatus: z
            .enum(["abstract", "user_notes", "metadata_only", "unavailable"])
            .optional(),
          isSystemAdded: z.boolean().optional(),
          isUserKeyReference: z.boolean().optional(),
          selectedByUser: z.boolean().optional(),
          matched: z
            .object({
              title: z.string().trim().min(1).max(500),
              authors: z.array(z.string()),
              year: z.number().int().optional(),
              journal: z.string().optional(),
              doi: z.string().optional(),
              url: z.string().optional(),
              abstract: z.string().optional(),
            })
            .optional(),
        }),
      )
      .min(1)
      .max(config.maxReferences + config.maxAdditionalSources),
  });
}

export function createPaperPatchSchema() {
  return z
    .object({
      editorVersion: z.number().int().min(0),
      contentJson: z.unknown().optional(),
      citationStyle: z.enum(CITATION_STYLE_IDS).optional(),
      title: z.string().trim().min(10).max(300).optional(),
    })
    .strict()
    .superRefine((value, ctx) => {
      const forbidden = [
        "chargedAmountCents",
        "requestedPages",
        "unitPriceCents",
        "subtotalCents",
      ];
      for (const key of forbidden) {
        if (key in value) {
          ctx.addIssue({
            code: "custom",
            message: "Price fields cannot be patched after checkout",
            path: [key],
          });
        }
      }
    });
}

export function createRegenerateSchema() {
  return z.object({
    sectionId: z.string().trim().min(1).max(80),
    instruction: z.string().trim().max(500).optional(),
  });
}

export function createExportQuerySchema() {
  return z.object({
    format: z.enum(["docx", "pdf"]),
  });
}

export function getResearchValidationSchemas(
  config: ResearchProductConfig = parseResearchProductConfig(),
) {
  return {
    paperDetails: createPaperDetailsSchema(config),
    paperDetailsStrict: createPaperDetailsSchema(config, { requireOrderEmail: true }),
    referenceInput: createReferenceInputSchema(),
    referenceList: createReferenceListSchema(config),
    resolveRequest: createResolveRequestSchema(config),
    discoverRequest: createDiscoverRequestSchema(config),
    orderRequest: createOrderRequestSchema(config),
    paperPatch: createPaperPatchSchema(),
    regenerate: createRegenerateSchema(),
    exportQuery: createExportQuerySchema(),
  };
}
