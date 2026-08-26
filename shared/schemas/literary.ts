import { z } from "zod";
import { IdSchema, MetadataSchema, TimestampSchema } from "./common";

export const LiteraryAnnotationSchema = z.object({
  id: IdSchema,
  sceneId: IdSchema,
  projectId: IdSchema,
  category: z.string().min(1),
  severity: z.string().min(1),
  rangeFrom: z.number().int().nullable().optional(),
  rangeTo: z.number().int().nullable().optional(),
  quote: z.string(),
  diagnosis: z.string(),
  literaryTradeoff: z.string().nullable().optional(),
  suggestion: z.string().nullable().optional(),
  replacement: MetadataSchema.nullable().optional(),
  appliedReplacementType: z.string().nullable().optional(),
  status: z.enum(["pending", "accepted", "rejected"]).default("pending"),
  isStale: z.boolean().default(false),
  metadata: MetadataSchema,
  createdAt: TimestampSchema,
});
export type LiteraryAnnotation = z.infer<typeof LiteraryAnnotationSchema>;

export const CreateLiteraryAnnotationSchema = z.object({
  id: IdSchema.optional(),
  sceneId: IdSchema,
  projectId: IdSchema,
  category: z.string().min(1),
  severity: z.string().min(1),
  rangeFrom: z.number().int().optional(),
  rangeTo: z.number().int().optional(),
  quote: z.string(),
  diagnosis: z.string(),
  literaryTradeoff: z.string().optional(),
  suggestion: z.string().optional(),
  replacement: MetadataSchema.optional(),
  appliedReplacementType: z.string().optional(),
  status: z.enum(["pending", "accepted", "rejected"]).optional(),
  isStale: z.boolean().optional(),
  metadata: MetadataSchema.optional(),
});
export type CreateLiteraryAnnotationInput = z.infer<typeof CreateLiteraryAnnotationSchema>;

export const MarginNoteSchema = z.object({
  id: IdSchema,
  sceneId: IdSchema,
  projectId: IdSchema,
  author: z.enum(["human", "ai"]),
  rangeFrom: z.number().int(),
  rangeTo: z.number().int(),
  quote: z.string(),
  content: z.string(),
  resolved: z.boolean().default(false),
  metadata: MetadataSchema,
  createdAt: TimestampSchema,
});
export type MarginNote = z.infer<typeof MarginNoteSchema>;

export const CreateMarginNoteSchema = z.object({
  id: IdSchema.optional(),
  sceneId: IdSchema,
  projectId: IdSchema,
  author: z.enum(["human", "ai"]),
  rangeFrom: z.number().int(),
  rangeTo: z.number().int(),
  quote: z.string(),
  content: z.string(),
  resolved: z.boolean().optional(),
  metadata: MetadataSchema.optional(),
});
export type CreateMarginNoteInput = z.infer<typeof CreateMarginNoteSchema>;

export const ImportJobSchema = z.object({
  id: IdSchema,
  projectId: IdSchema.nullable().optional(),
  sourceType: z.enum(["indexeddb_verso_v2", "docx", "markdown", "backup_tar"]),
  status: z.enum(["pending", "processing", "completed", "failed"]).default("pending"),
  importedCounts: MetadataSchema,
  error: z.string().nullable().optional(),
  metadata: MetadataSchema,
  createdAt: TimestampSchema,
  completedAt: TimestampSchema.nullable().optional(),
});
export type ImportJob = z.infer<typeof ImportJobSchema>;

export const CreateImportJobSchema = z.object({
  id: IdSchema.optional(),
  projectId: IdSchema.optional(),
  sourceType: z.enum(["indexeddb_verso_v2", "docx", "markdown", "backup_tar"]),
  status: z.enum(["pending", "processing", "completed", "failed"]).optional(),
  importedCounts: MetadataSchema.optional(),
  metadata: MetadataSchema.optional(),
});
export type CreateImportJobInput = z.infer<typeof CreateImportJobSchema>;

