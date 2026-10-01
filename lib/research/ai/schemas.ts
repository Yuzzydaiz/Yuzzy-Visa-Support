import { z } from "zod";

export const outlineJsonSchema = z.object({
  sections: z.array(
    z.object({
      sectionId: z.string().min(1),
      type: z.string().min(1),
      title: z.string().min(1),
      order: z.number().int().min(0),
      arguments: z.array(z.string()),
      wordBudget: z.number().int().min(1),
      plannedRefIds: z.array(z.string()),
    }),
  ),
});

export const sectionJsonSchema = z.object({
  sectionId: z.string().min(1),
  title: z.string().min(1),
  paragraphs: z.array(z.object({ text: z.string().min(1) })).min(1),
  usedReferenceIds: z.array(z.string()),
  limitations: z.array(z.string()).optional(),
  wordCountEstimate: z.number().int().min(0),
});

export const coherenceJsonSchema = z.object({
  sections: z.array(
    z.object({
      sectionId: z.string().min(1),
      paragraphs: z.array(z.object({ text: z.string().min(1) })).min(1),
    }),
  ),
});

export type OutlineJson = z.infer<typeof outlineJsonSchema>;
export type SectionJson = z.infer<typeof sectionJsonSchema>;

const paragraphSchema = {
  type: "object",
  properties: {
    text: { type: "string" },
  },
  required: ["text"],
  additionalProperties: false,
} as const;

export const sectionOutputJsonSchema = {
  type: "object",
  properties: {
    sectionId: { type: "string" },
    title: { type: "string" },
    paragraphs: { type: "array", items: paragraphSchema, minItems: 1 },
    usedReferenceIds: { type: "array", items: { type: "string" } },
    limitations: { type: "array", items: { type: "string" } },
    wordCountEstimate: { type: "integer", minimum: 0 },
  },
  required: [
    "sectionId",
    "title",
    "paragraphs",
    "usedReferenceIds",
    "limitations",
    "wordCountEstimate",
  ],
  additionalProperties: false,
} as const;

const outlineItemJsonSchema = {
  type: "object",
  properties: {
    sectionId: { type: "string" },
    type: { type: "string" },
    title: { type: "string" },
    order: { type: "integer", minimum: 0 },
    arguments: { type: "array", items: { type: "string" } },
    wordBudget: { type: "integer", minimum: 1 },
    plannedRefIds: { type: "array", items: { type: "string" } },
  },
  required: [
    "sectionId",
    "type",
    "title",
    "order",
    "arguments",
    "wordBudget",
    "plannedRefIds",
  ],
  additionalProperties: false,
} as const;

export const outlineOutputJsonSchema = {
  type: "object",
  properties: {
    sections: { type: "array", items: outlineItemJsonSchema, minItems: 1 },
  },
  required: ["sections"],
  additionalProperties: false,
} as const;

export const coherenceOutputJsonSchema = {
  type: "object",
  properties: {
    sections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          sectionId: { type: "string" },
          paragraphs: { type: "array", items: paragraphSchema, minItems: 1 },
        },
        required: ["sectionId", "paragraphs"],
        additionalProperties: false,
      },
    },
  },
  required: ["sections"],
  additionalProperties: false,
} as const;
