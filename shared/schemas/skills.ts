import { z } from "zod";
import { IdSchema, MetadataSchema, TimestampSchema } from "./common";

export const SkillCategoryEnum = z.enum([
  "critique",
  "analysis",
  "drafting",
  "profiling",
  "custom",
]);
export type SkillCategory = z.infer<typeof SkillCategoryEnum>;

export const SkillInvocationModeEnum = z.enum(["explicit", "automatic", "suggested"]);
export type SkillInvocationMode = z.infer<typeof SkillInvocationModeEnum>;

// Skill Definition
export const SkillDefinitionSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  description: z.string(),
  category: SkillCategoryEnum,
  isBuiltIn: z.boolean().default(true),
  metadata: MetadataSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
export type SkillDefinition = z.infer<typeof SkillDefinitionSchema>;

export const CreateSkillDefinitionSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  description: z.string(),
  category: SkillCategoryEnum,
  isBuiltIn: z.boolean().optional(),
  metadata: MetadataSchema.optional(),
});
export type CreateSkillDefinitionInput = z.infer<typeof CreateSkillDefinitionSchema>;

// Skill Version
export const SkillVersionSchema = z.object({
  id: IdSchema,
  skillId: IdSchema,
  version: z.string().min(1),
  manifest: MetadataSchema,
  instructions: z.string(),
  outputSchema: MetadataSchema,
  contextPolicy: MetadataSchema,
  metadata: MetadataSchema,
  createdAt: TimestampSchema,
});
export type SkillVersion = z.infer<typeof SkillVersionSchema>;

export const CreateSkillVersionSchema = z.object({
  id: IdSchema.optional(),
  skillId: IdSchema,
  version: z.string().min(1),
  manifest: MetadataSchema.optional(),
  instructions: z.string(),
  outputSchema: MetadataSchema.optional(),
  contextPolicy: MetadataSchema.optional(),
  metadata: MetadataSchema.optional(),
});
export type CreateSkillVersionInput = z.infer<typeof CreateSkillVersionSchema>;

// Skill Overlay
export const SkillOverlaySchema = z.object({
  id: IdSchema,
  skillId: IdSchema,
  projectId: IdSchema.nullable().optional(),
  customName: z.string().nullable().optional(),
  focusAreas: z.array(z.string()).default([]),
  avoidAreas: z.array(z.string()).default([]),
  preferredStrength: z.string().nullable().optional(),
  customInstructions: z.string().nullable().optional(),
  isEnabled: z.boolean().default(true),
  metadata: MetadataSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
export type SkillOverlay = z.infer<typeof SkillOverlaySchema>;

export const CreateSkillOverlaySchema = z.object({
  id: IdSchema.optional(),
  skillId: IdSchema,
  projectId: IdSchema.optional(),
  customName: z.string().optional(),
  focusAreas: z.array(z.string()).optional(),
  avoidAreas: z.array(z.string()).optional(),
  preferredStrength: z.string().optional(),
  customInstructions: z.string().optional(),
  isEnabled: z.boolean().optional(),
  metadata: MetadataSchema.optional(),
});
export type CreateSkillOverlayInput = z.infer<typeof CreateSkillOverlaySchema>;

export const UpdateSkillOverlaySchema = z.object({
  customName: z.string().nullable().optional(),
  focusAreas: z.array(z.string()).optional(),
  avoidAreas: z.array(z.string()).optional(),
  preferredStrength: z.string().nullable().optional(),
  customInstructions: z.string().nullable().optional(),
  isEnabled: z.boolean().optional(),
  metadata: MetadataSchema.optional(),
});
export type UpdateSkillOverlayInput = z.infer<typeof UpdateSkillOverlaySchema>;

// Skill Invocation
export const SkillInvocationSchema = z.object({
  id: IdSchema,
  runId: IdSchema,
  skillId: IdSchema,
  skillVersionId: IdSchema.nullable().optional(),
  overlayId: IdSchema.nullable().optional(),
  invocationMode: SkillInvocationModeEnum,
  resolvedParameters: MetadataSchema,
  createdAt: TimestampSchema,
});
export type SkillInvocation = z.infer<typeof SkillInvocationSchema>;

export const CreateSkillInvocationSchema = z.object({
  id: IdSchema.optional(),
  runId: IdSchema,
  skillId: IdSchema,
  skillVersionId: IdSchema.optional(),
  overlayId: IdSchema.optional(),
  invocationMode: SkillInvocationModeEnum,
  resolvedParameters: MetadataSchema.optional(),
});
export type CreateSkillInvocationInput = z.infer<typeof CreateSkillInvocationSchema>;

