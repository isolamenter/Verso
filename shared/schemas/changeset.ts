import { z } from "zod";
import { IdSchema, MetadataSchema, TimestampSchema } from "./common";

export const ChangeSetStatusEnum = z.enum([
  "draft",
  "proposed",
  "partially_approved",
  "approved",
  "applying",
  "applied",
  "rejected",
  "superseded",
  "needs_rebase",
  "failed",
]);
export type ChangeSetStatus = z.infer<typeof ChangeSetStatusEnum>;

export const ChangeOperationTypeEnum = z.enum([
  "replace_text_range",
  "insert_text",
  "delete_text_range",
  "replace_scene",
  "append_to_scene",
  "create_scene",
  "update_scene_metadata",
  "reorder_scenes",
  "create_knowledge",
  "update_knowledge",
  "archive_knowledge",
  "link_knowledge",
]);
export type ChangeOperationType = z.infer<typeof ChangeOperationTypeEnum>;

export const ChangeOperationStatusEnum = z.enum([
  "proposed",
  "approved",
  "rejected",
  "applied",
  "failed",
  "conflict",
]);
export type ChangeOperationStatus = z.infer<typeof ChangeOperationStatusEnum>;

export const ChangeReviewDecisionEnum = z.enum(["approved", "rejected", "revised"]);
export type ChangeReviewDecision = z.infer<typeof ChangeReviewDecisionEnum>;

export const ChangeApplyStatusEnum = z.enum(["success", "conflict", "failed", "rolled_back"]);
export type ChangeApplyStatus = z.infer<typeof ChangeApplyStatusEnum>;

// Change Set
export const ChangeSetSchema = z.object({
  id: IdSchema,
  projectId: IdSchema,
  threadId: IdSchema.nullable().optional(),
  runId: IdSchema.nullable().optional(),
  title: z.string().min(1),
  objective: z.string().min(1),
  rationale: z.string().nullable().optional(),
  status: ChangeSetStatusEnum.default("draft"),
  baseRevisionMap: z.record(z.string(), z.string()).default({}),
  contextReceiptId: IdSchema.nullable().optional(),
  skillInvocationIds: z.array(z.string()).default([]),
  appliedAt: TimestampSchema.nullable().optional(),
  metadata: MetadataSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
export type ChangeSet = z.infer<typeof ChangeSetSchema>;

export const CreateChangeSetSchema = z.object({
  id: IdSchema.optional(),
  projectId: IdSchema,
  threadId: IdSchema.optional(),
  runId: IdSchema.optional(),
  title: z.string().min(1),
  objective: z.string().min(1),
  rationale: z.string().optional(),
  status: ChangeSetStatusEnum.optional(),
  baseRevisionMap: z.record(z.string(), z.string()).optional(),
  contextReceiptId: IdSchema.optional(),
  skillInvocationIds: z.array(z.string()).optional(),
  metadata: MetadataSchema.optional(),
});
export type CreateChangeSetInput = z.infer<typeof CreateChangeSetSchema>;

export const UpdateChangeSetSchema = z.object({
  title: z.string().min(1).optional(),
  objective: z.string().min(1).optional(),
  rationale: z.string().nullable().optional(),
  status: ChangeSetStatusEnum.optional(),
  baseRevisionMap: z.record(z.string(), z.string()).optional(),
  appliedAt: TimestampSchema.nullable().optional(),
  metadata: MetadataSchema.optional(),
});
export type UpdateChangeSetInput = z.infer<typeof UpdateChangeSetSchema>;

// Change Operation
export const ChangeOperationSchema = z.object({
  id: IdSchema,
  changeSetId: IdSchema,
  projectId: IdSchema,
  sequenceNumber: z.number().int().positive(),
  targetType: z.enum(["scene", "knowledge_node", "manuscript"]),
  targetId: z.string(),
  baseRevisionId: z.string().nullable().optional(),
  operationType: ChangeOperationTypeEnum,
  status: ChangeOperationStatusEnum.default("proposed"),
  quote: z.string().nullable().optional(),
  prefixAnchor: z.string().nullable().optional(),
  suffixAnchor: z.string().nullable().optional(),
  originalChecksum: z.string().nullable().optional(),
  rangeFrom: z.number().int().nullable().optional(),
  rangeTo: z.number().int().nullable().optional(),
  replacementContent: z.string().nullable().optional(),
  literaryTradeoff: z.string().nullable().optional(),
  structuredPayload: MetadataSchema,
  validationResult: MetadataSchema.nullable().optional(),
  metadata: MetadataSchema,
  createdAt: TimestampSchema,
});
export type ChangeOperation = z.infer<typeof ChangeOperationSchema>;

export const CreateChangeOperationSchema = z.object({
  id: IdSchema.optional(),
  changeSetId: IdSchema,
  projectId: IdSchema,
  sequenceNumber: z.number().int().positive().optional(),
  targetType: z.enum(["scene", "knowledge_node", "manuscript"]),
  targetId: z.string(),
  baseRevisionId: z.string().optional(),
  operationType: ChangeOperationTypeEnum,
  status: ChangeOperationStatusEnum.optional(),
  quote: z.string().optional(),
  prefixAnchor: z.string().optional(),
  suffixAnchor: z.string().optional(),
  originalChecksum: z.string().optional(),
  rangeFrom: z.number().int().optional(),
  rangeTo: z.number().int().optional(),
  replacementContent: z.string().optional(),
  literaryTradeoff: z.string().optional(),
  structuredPayload: MetadataSchema.optional(),
  validationResult: MetadataSchema.optional(),
  metadata: MetadataSchema.optional(),
});
export type CreateChangeOperationInput = z.infer<typeof CreateChangeOperationSchema>;

export const UpdateChangeOperationSchema = z.object({
  status: ChangeOperationStatusEnum.optional(),
  validationResult: MetadataSchema.nullable().optional(),
  metadata: MetadataSchema.optional(),
});
export type UpdateChangeOperationInput = z.infer<typeof UpdateChangeOperationSchema>;

// Change Review
export const ChangeReviewSchema = z.object({
  id: IdSchema,
  changeSetId: IdSchema,
  projectId: IdSchema,
  operationId: IdSchema.nullable().optional(),
  decision: ChangeReviewDecisionEnum,
  userFeedback: z.string().nullable().optional(),
  createdAt: TimestampSchema,
});
export type ChangeReview = z.infer<typeof ChangeReviewSchema>;

export const CreateChangeReviewSchema = z.object({
  id: IdSchema.optional(),
  changeSetId: IdSchema,
  projectId: IdSchema,
  operationId: IdSchema.optional(),
  decision: ChangeReviewDecisionEnum,
  userFeedback: z.string().optional(),
});
export type CreateChangeReviewInput = z.infer<typeof CreateChangeReviewSchema>;

// Change Apply Attempt
export const ChangeApplyAttemptSchema = z.object({
  id: IdSchema,
  changeSetId: IdSchema,
  projectId: IdSchema,
  status: ChangeApplyStatusEnum,
  resultingRevisionMap: z.record(z.string(), z.string()).default({}),
  error: z.string().nullable().optional(),
  attemptedAt: TimestampSchema,
});
export type ChangeApplyAttempt = z.infer<typeof ChangeApplyAttemptSchema>;

export const CreateChangeApplyAttemptSchema = z.object({
  id: IdSchema.optional(),
  changeSetId: IdSchema,
  projectId: IdSchema,
  status: ChangeApplyStatusEnum,
  resultingRevisionMap: z.record(z.string(), z.string()).optional(),
  error: z.string().optional(),
});
export type CreateChangeApplyAttemptInput = z.infer<typeof CreateChangeApplyAttemptSchema>;

