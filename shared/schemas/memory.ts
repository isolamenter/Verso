import { z } from "zod";
import { IdSchema, MetadataSchema, TimestampSchema } from "./common";

export const MemoryScopeEnum = z.enum(["workspace", "project", "manuscript"]);
export type MemoryScope = z.infer<typeof MemoryScopeEnum>;

export const MemoryLayerEnum = z.enum([
  "explicit_profile",
  "taste_profile",
  "procedural",
  "project_convention",
  "episodic_evidence",
  "session_context",
]);
export type MemoryLayer = z.infer<typeof MemoryLayerEnum>;

export const MemoryStatusEnum = z.enum([
  "candidate",
  "active",
  "contested",
  "superseded",
  "disabled",
]);
export type MemoryStatus = z.infer<typeof MemoryStatusEnum>;

export const TasteStatusEnum = z.enum([
  "candidate",
  "active",
  "contested",
  "superseded",
  "disabled",
]);
export type TasteStatus = z.infer<typeof TasteStatusEnum>;

export const TasteExplicitnessEnum = z.enum(["explicit", "inferred"]);
export type TasteExplicitness = z.infer<typeof TasteExplicitnessEnum>;

export const EvidenceSourceTypeEnum = z.enum([
  "explicit_statement",
  "change_review",
  "manual_edit_after_agent",
  "user_correction",
  "conversation",
]);
export type EvidenceSourceType = z.infer<typeof EvidenceSourceTypeEnum>;

// Memory Entry
export const MemoryEntrySchema = z.object({
  id: IdSchema,
  projectId: IdSchema.nullable().optional(),
  scope: MemoryScopeEnum,
  scopeId: z.string().nullable().optional(),
  layer: MemoryLayerEnum,
  key: z.string().min(1),
  content: z.string().min(1),
  embedding: z.array(z.number()).nullable().optional(),
  confidence: z.number().min(0).max(1).default(1.0),
  status: MemoryStatusEnum.default("active"),
  metadata: MetadataSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
export type MemoryEntry = z.infer<typeof MemoryEntrySchema>;

export const CreateMemoryEntrySchema = z.object({
  id: IdSchema.optional(),
  projectId: IdSchema.optional(),
  scope: MemoryScopeEnum,
  scopeId: z.string().optional(),
  layer: MemoryLayerEnum,
  key: z.string().min(1),
  content: z.string().min(1),
  embedding: z.array(z.number()).optional(),
  confidence: z.number().min(0).max(1).optional(),
  status: MemoryStatusEnum.optional(),
  metadata: MetadataSchema.optional(),
});
export type CreateMemoryEntryInput = z.infer<typeof CreateMemoryEntrySchema>;

export const UpdateMemoryEntrySchema = z.object({
  content: z.string().min(1).optional(),
  confidence: z.number().min(0).max(1).optional(),
  status: MemoryStatusEnum.optional(),
  metadata: MetadataSchema.optional(),
});
export type UpdateMemoryEntryInput = z.infer<typeof UpdateMemoryEntrySchema>;

// Memory Evidence
export const MemoryEvidenceSchema = z.object({
  id: IdSchema,
  memoryEntryId: IdSchema,
  projectId: IdSchema.nullable().optional(),
  sourceType: EvidenceSourceTypeEnum,
  sourceId: z.string().nullable().optional(),
  quote: z.string().nullable().optional(),
  weight: z.number().default(1.0),
  metadata: MetadataSchema,
  createdAt: TimestampSchema,
});
export type MemoryEvidence = z.infer<typeof MemoryEvidenceSchema>;

export const CreateMemoryEvidenceSchema = z.object({
  id: IdSchema.optional(),
  memoryEntryId: IdSchema,
  projectId: IdSchema.optional(),
  sourceType: EvidenceSourceTypeEnum,
  sourceId: z.string().optional(),
  quote: z.string().optional(),
  weight: z.number().optional(),
  metadata: MetadataSchema.optional(),
});
export type CreateMemoryEvidenceInput = z.infer<typeof CreateMemoryEvidenceSchema>;

// Taste Entry
export const TasteEntrySchema = z.object({
  id: IdSchema,
  scope: MemoryScopeEnum.default("workspace"),
  scopeId: z.string().nullable().optional(),
  dimension: z.string().min(1),
  preference: z.string().min(1),
  conditions: z.array(z.string()).default([]),
  antiPreferences: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1).default(0.5),
  status: TasteStatusEnum.default("active"),
  explicitness: TasteExplicitnessEnum.default("inferred"),
  firstObservedAt: TimestampSchema,
  lastObservedAt: TimestampSchema,
  lastConfirmedAt: TimestampSchema.nullable().optional(),
  supersedesId: IdSchema.nullable().optional(),
  metadata: MetadataSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
export type TasteEntry = z.infer<typeof TasteEntrySchema>;

export const CreateTasteEntrySchema = z.object({
  id: IdSchema.optional(),
  scope: MemoryScopeEnum.optional(),
  scopeId: z.string().optional(),
  dimension: z.string().min(1),
  preference: z.string().min(1),
  conditions: z.array(z.string()).optional(),
  antiPreferences: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1).optional(),
  status: TasteStatusEnum.optional(),
  explicitness: TasteExplicitnessEnum.optional(),
  supersedesId: IdSchema.optional(),
  metadata: MetadataSchema.optional(),
});
export type CreateTasteEntryInput = z.infer<typeof CreateTasteEntrySchema>;

export const UpdateTasteEntrySchema = z.object({
  preference: z.string().min(1).optional(),
  conditions: z.array(z.string()).optional(),
  antiPreferences: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1).optional(),
  status: TasteStatusEnum.optional(),
  lastConfirmedAt: TimestampSchema.nullable().optional(),
  supersedesId: IdSchema.nullable().optional(),
  metadata: MetadataSchema.optional(),
});
export type UpdateTasteEntryInput = z.infer<typeof UpdateTasteEntrySchema>;

// Taste Entry Evidence
export const TasteEntryEvidenceSchema = z.object({
  id: IdSchema,
  tasteEntryId: IdSchema,
  sourceType: EvidenceSourceTypeEnum,
  sourceId: z.string().nullable().optional(),
  quote: z.string().nullable().optional(),
  weight: z.number().default(1.0),
  metadata: MetadataSchema,
  createdAt: TimestampSchema,
});
export type TasteEntryEvidence = z.infer<typeof TasteEntryEvidenceSchema>;

export const CreateTasteEntryEvidenceSchema = z.object({
  id: IdSchema.optional(),
  tasteEntryId: IdSchema,
  sourceType: EvidenceSourceTypeEnum,
  sourceId: z.string().optional(),
  quote: z.string().optional(),
  weight: z.number().optional(),
  metadata: MetadataSchema.optional(),
});
export type CreateTasteEntryEvidenceInput = z.infer<typeof CreateTasteEntryEvidenceSchema>;

// Memory Revision
export const MemoryRevisionSchema = z.object({
  id: IdSchema,
  memoryEntryId: IdSchema.nullable().optional(),
  tasteEntryId: IdSchema.nullable().optional(),
  revisionNumber: z.number().int().positive(),
  previousState: MetadataSchema,
  newState: MetadataSchema,
  changeReason: z.string().nullable().optional(),
  createdAt: TimestampSchema,
});
export type MemoryRevision = z.infer<typeof MemoryRevisionSchema>;

export const CreateMemoryRevisionSchema = z.object({
  id: IdSchema.optional(),
  memoryEntryId: IdSchema.optional(),
  tasteEntryId: IdSchema.optional(),
  revisionNumber: z.number().int().positive().optional(),
  previousState: MetadataSchema,
  newState: MetadataSchema,
  changeReason: z.string().optional(),
});
export type CreateMemoryRevisionInput = z.infer<typeof CreateMemoryRevisionSchema>;

