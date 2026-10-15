import "server-only";

import mongoose, {
  type HydratedDocument,
  type InferSchemaType,
  type Model,
} from "mongoose";

import { CITATION_STYLE_IDS, PAPER_TYPES } from "@/lib/config/research-product";

export const PAPER_STATUSES = [
  "draft",
  "awaiting_payment",
  "ready",
  "generating",
  "completed",
  "failed",
] as const;

export type PaperStatus = (typeof PAPER_STATUSES)[number];

export const REFERENCE_VERIFICATION_STATUSES = [
  "pending",
  "verified",
  "ambiguous",
  "unverified",
] as const;

export const REFERENCE_CONTENT_STATUSES = [
  "full_text",
  "abstract",
  "user_notes",
  "metadata_only",
  "unavailable",
] as const;

const AuthorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    affiliation: { type: String },
    department: { type: String },
    email: { type: String },
    orcid: { type: String },
  },
  { _id: false },
);

const ReferenceSchema = new mongoose.Schema(
  {
    refId: { type: String, required: true },
    originalInput: { type: String, required: true },
    inputType: {
      type: String,
      required: true,
      enum: ["doi", "url", "citation"],
    },
    title: { type: String },
    authors: { type: [String], default: [] },
    year: { type: Number },
    journal: { type: String },
    publisher: { type: String },
    volume: { type: String },
    issue: { type: String },
    pages: { type: String },
    doi: { type: String },
    canonicalUrl: { type: String },
    openAccessUrl: { type: String },
    abstract: { type: String },
    userProvidedNotes: { type: String },
    providerIds: {
      crossref: { type: String },
      openalex: { type: String },
    },
    verificationStatus: {
      type: String,
      required: true,
      enum: REFERENCE_VERIFICATION_STATUSES,
      default: "pending",
    },
    contentStatus: {
      type: String,
      required: true,
      enum: REFERENCE_CONTENT_STATUSES,
      default: "unavailable",
    },
    confidence: { type: Number },
    isUserKeyReference: { type: Boolean, default: true },
    isSystemAdded: { type: Boolean, default: false },
    selectedByUser: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const OutlineItemSchema = new mongoose.Schema(
  {
    sectionId: { type: String, required: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    order: { type: Number, required: true },
    arguments: { type: [String], default: [] },
    wordBudget: { type: Number, required: true },
    plannedRefIds: { type: [String], default: [] },
  },
  { _id: false },
);

const SectionSchema = new mongoose.Schema(
  {
    sectionId: { type: String, required: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    order: { type: Number, required: true },
    contentJson: { type: mongoose.Schema.Types.Mixed },
    plainText: { type: String, default: "" },
    targetWords: { type: Number, required: true },
    actualWords: { type: Number, default: 0 },
    citedRefIds: { type: [String], default: [] },
    citationHtml: { type: String, default: "" },
    generationStatus: { type: String, default: "pending" },
    generationAttempts: { type: Number, default: 0 },
    lastGeneratedAt: { type: Date },
    lastEditedAt: { type: Date },
    validationWarnings: { type: [String], default: [] },
    // Long sections are written in parts. No defaults on purpose: a missing
    // value means a single-part section, which keeps older papers complete.
    partsTotal: { type: Number },
    partsDone: { type: Number },
    checksum: { type: String },
  },
  { _id: false },
);

const PaperSchema = new mongoose.Schema(
  {
    publicId: { type: String, required: true, unique: true, index: true },
    customerEmail: { type: String, required: true },
    accessTokenHash: { type: String, required: true },
    title: { type: String, required: true, minlength: 10, maxlength: 300 },
    focus: { type: String, required: true, default: "" },
    paperType: { type: String, required: true, enum: PAPER_TYPES },
    authors: { type: [AuthorSchema], required: true, minlength: 1 },
    citationStyle: { type: String, required: true, enum: CITATION_STYLE_IDS },
    requestedPages: { type: Number, required: true, min: 1 },
    targetWords: { type: Number, required: true, min: 1 },
    allowAdditionalSources: { type: Boolean, required: true, default: false },
    researchNotes: { type: String },
    actualMethodology: { type: String },
    actualFindings: { type: String },
    references: { type: [ReferenceSchema], default: [] },
    outline: { type: [OutlineItemSchema], default: [] },
    sections: { type: [SectionSchema], default: [] },
    editorDocument: { type: mongoose.Schema.Types.Mixed },
    status: {
      type: String,
      required: true,
      enum: PAPER_STATUSES,
      default: "draft",
    },
    generation: {
      currentStep: { type: String },
      lockOwner: { type: String },
      completedSteps: { type: [String], default: [] },
      lockUntil: { type: Date },
      lastError: { type: String },
      attempts: { type: Number, default: 0 },
      totalInputTokens: { type: Number, default: 0 },
      totalOutputTokens: { type: Number, default: 0 },
      version: { type: Number, default: 0 },
      bibliography: { type: [String], default: [] },
    },
    regeneration: {
      used: { type: Number, default: 0 },
      limit: { type: Number, default: 3 },
      // A long-section regeneration in progress, built up part by part and
      // committed (and counted against the quota) only when every part is done.
      pending: { type: mongoose.Schema.Types.Mixed },
    },
    editorVersion: { type: Number, default: 0 },
    completedAt: { type: Date },
  },
  { timestamps: true },
);

export type PaperData = InferSchemaType<typeof PaperSchema>;
export type PaperDocument = HydratedDocument<PaperData>;

export const Paper: Model<PaperDocument> =
  (mongoose.models.Paper as Model<PaperDocument> | undefined) ??
  mongoose.model<PaperDocument>("Paper", PaperSchema);
