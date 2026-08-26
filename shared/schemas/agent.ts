import { z } from "zod";
import { IdSchema, MetadataSchema, TimestampSchema } from "./common";

export const AgentThreadStatusEnum = z.enum(["active", "archived", "pinned"]);
export type AgentThreadStatus = z.infer<typeof AgentThreadStatusEnum>;

export const AgentMessageRoleEnum = z.enum(["user", "assistant", "system", "tool"]);
export type AgentMessageRole = z.infer<typeof AgentMessageRoleEnum>;

export const AgentRunStatusEnum = z.enum([
  "queued",
  "planning",
  "resolving_context",
  "executing",
  "awaiting_user",
  "proposing_changes",
  "completed",
  "cancelled",
  "failed",
]);
export type AgentRunStatus = z.infer<typeof AgentRunStatusEnum>;

export const AgentRunEventTypeEnum = z.enum([
  "status_change",
  "text_delta",
  "thought_delta",
  "tool_call",
  "tool_result",
  "artifact",
  "receipt",
  "change_set",
  "error",
]);
export type AgentRunEventType = z.infer<typeof AgentRunEventTypeEnum>;

export const AgentArtifactTypeEnum = z.enum([
  "critique_report",
  "cold_reader_report",
  "intent_evaluation",
  "version_compare",
  "scene_draft",
  "profiling_summary",
  "custom",
]);
export type AgentArtifactType = z.infer<typeof AgentArtifactTypeEnum>;

export const ContextReceiptResourceTypeEnum = z.enum([
  "scene",
  "knowledge_node",
  "memory_entry",
  "taste_entry",
  "media_segment",
  "skill_instruction",
  "project_convention",
]);
export type ContextReceiptResourceType = z.infer<typeof ContextReceiptResourceTypeEnum>;

export const ContextReceiptInclusionModeEnum = z.enum([
  "full",
  "summary",
  "excerpt",
  "locator_only",
  "excluded",
]);
export type ContextReceiptInclusionMode = z.infer<typeof ContextReceiptInclusionModeEnum>;

// Agent Thread
export const AgentThreadSchema = z.object({
  id: IdSchema,
  projectId: IdSchema,
  title: z.string().min(1),
  status: AgentThreadStatusEnum.default("active"),
  currentSceneId: IdSchema.nullable().optional(),
  activeSkillId: z.string().nullable().optional(),
  metadata: MetadataSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
export type AgentThread = z.infer<typeof AgentThreadSchema>;

export const CreateAgentThreadSchema = z.object({
  id: IdSchema.optional(),
  projectId: IdSchema,
  title: z.string().min(1),
  status: AgentThreadStatusEnum.optional(),
  currentSceneId: IdSchema.optional(),
  activeSkillId: z.string().optional(),
  metadata: MetadataSchema.optional(),
});
export type CreateAgentThreadInput = z.infer<typeof CreateAgentThreadSchema>;

export const UpdateAgentThreadSchema = z.object({
  title: z.string().min(1).optional(),
  status: AgentThreadStatusEnum.optional(),
  currentSceneId: IdSchema.nullable().optional(),
  activeSkillId: z.string().nullable().optional(),
  metadata: MetadataSchema.optional(),
});
export type UpdateAgentThreadInput = z.infer<typeof UpdateAgentThreadSchema>;

// Agent Message
export const AgentMessageSchema = z.object({
  id: IdSchema,
  threadId: IdSchema,
  projectId: IdSchema,
  role: AgentMessageRoleEnum,
  content: z.string().default(""),
  sequenceNumber: z.number().int().positive(),
  runId: IdSchema.nullable().optional(),
  skillId: z.string().nullable().optional(),
  targetSceneId: IdSchema.nullable().optional(),
  targetRevisionId: IdSchema.nullable().optional(),
  attachments: z.array(z.unknown()).default([]),
  metadata: MetadataSchema,
  createdAt: TimestampSchema,
});
export type AgentMessage = z.infer<typeof AgentMessageSchema>;

export const CreateAgentMessageSchema = z.object({
  id: IdSchema.optional(),
  threadId: IdSchema,
  projectId: IdSchema,
  role: AgentMessageRoleEnum,
  content: z.string(),
  sequenceNumber: z.number().int().positive().optional(),
  runId: IdSchema.optional(),
  skillId: z.string().optional(),
  targetSceneId: IdSchema.optional(),
  targetRevisionId: IdSchema.optional(),
  attachments: z.array(z.unknown()).optional(),
  metadata: MetadataSchema.optional(),
});
export type CreateAgentMessageInput = z.infer<typeof CreateAgentMessageSchema>;

// Agent Run
export const AgentRunSchema = z.object({
  id: IdSchema,
  threadId: IdSchema,
  projectId: IdSchema,
  skillId: z.string().nullable().optional(),
  skillVersion: z.string().nullable().optional(),
  status: AgentRunStatusEnum.default("queued"),
  modelRole: z.string().nullable().optional(),
  modelId: z.string().nullable().optional(),
  targetResource: z.record(z.string(), z.unknown()).nullable().optional(),
  contextReceiptId: IdSchema.nullable().optional(),
  error: z.string().nullable().optional(),
  startedAt: TimestampSchema.nullable().optional(),
  completedAt: TimestampSchema.nullable().optional(),
  metadata: MetadataSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
export type AgentRun = z.infer<typeof AgentRunSchema>;

export const CreateAgentRunSchema = z.object({
  id: IdSchema.optional(),
  threadId: IdSchema,
  projectId: IdSchema,
  skillId: z.string().optional(),
  skillVersion: z.string().optional(),
  status: AgentRunStatusEnum.optional(),
  modelRole: z.string().optional(),
  modelId: z.string().optional(),
  targetResource: z.record(z.string(), z.unknown()).optional(),
  metadata: MetadataSchema.optional(),
});
export type CreateAgentRunInput = z.infer<typeof CreateAgentRunSchema>;

export const UpdateAgentRunSchema = z.object({
  status: AgentRunStatusEnum.optional(),
  contextReceiptId: IdSchema.nullable().optional(),
  error: z.string().nullable().optional(),
  startedAt: TimestampSchema.nullable().optional(),
  completedAt: TimestampSchema.nullable().optional(),
  metadata: MetadataSchema.optional(),
});
export type UpdateAgentRunInput = z.infer<typeof UpdateAgentRunSchema>;

// Agent Run Event
export const AgentRunEventSchema = z.object({
  id: IdSchema,
  runId: IdSchema,
  threadId: IdSchema,
  projectId: IdSchema,
  sequenceNumber: z.number().int().positive(),
  type: AgentRunEventTypeEnum,
  payload: MetadataSchema,
  createdAt: TimestampSchema,
});
export type AgentRunEvent = z.infer<typeof AgentRunEventSchema>;

export const CreateAgentRunEventSchema = z.object({
  id: IdSchema.optional(),
  runId: IdSchema,
  threadId: IdSchema,
  projectId: IdSchema,
  sequenceNumber: z.number().int().positive().optional(),
  type: AgentRunEventTypeEnum,
  payload: MetadataSchema.optional(),
});
export type CreateAgentRunEventInput = z.infer<typeof CreateAgentRunEventSchema>;

// Agent Artifact
export const AgentArtifactSchema = z.object({
  id: IdSchema,
  runId: IdSchema,
  threadId: IdSchema,
  projectId: IdSchema,
  type: AgentArtifactTypeEnum,
  title: z.string().min(1),
  content: z.string(),
  structuredData: MetadataSchema,
  locale: z.string().default("zh-CN"),
  metadata: MetadataSchema,
  createdAt: TimestampSchema,
});
export type AgentArtifact = z.infer<typeof AgentArtifactSchema>;

export const CreateAgentArtifactSchema = z.object({
  id: IdSchema.optional(),
  runId: IdSchema,
  threadId: IdSchema,
  projectId: IdSchema,
  type: AgentArtifactTypeEnum,
  title: z.string().min(1),
  content: z.string(),
  structuredData: MetadataSchema.optional(),
  locale: z.string().optional(),
  metadata: MetadataSchema.optional(),
});
export type CreateAgentArtifactInput = z.infer<typeof CreateAgentArtifactSchema>;

// Context Receipt
export const ContextReceiptSchema = z.object({
  id: IdSchema,
  runId: IdSchema,
  projectId: IdSchema,
  skillId: z.string().nullable().optional(),
  skillVersion: z.string().nullable().optional(),
  totalTokensApprox: z.number().int().nullable().optional(),
  tierBreakdown: MetadataSchema,
  metadata: MetadataSchema,
  createdAt: TimestampSchema,
});
export type ContextReceipt = z.infer<typeof ContextReceiptSchema>;

export const CreateContextReceiptSchema = z.object({
  id: IdSchema.optional(),
  runId: IdSchema,
  projectId: IdSchema,
  skillId: z.string().optional(),
  skillVersion: z.string().optional(),
  totalTokensApprox: z.number().int().optional(),
  tierBreakdown: MetadataSchema.optional(),
  metadata: MetadataSchema.optional(),
});
export type CreateContextReceiptInput = z.infer<typeof CreateContextReceiptSchema>;

// Context Receipt Item
export const ContextReceiptItemSchema = z.object({
  id: IdSchema,
  contextReceiptId: IdSchema,
  projectId: IdSchema,
  resourceType: ContextReceiptResourceTypeEnum,
  resourceId: z.string(),
  tier: z.number().int().min(0).max(3),
  inclusionMode: ContextReceiptInclusionModeEnum,
  exclusionReason: z.string().nullable().optional(),
  estimatedTokens: z.number().int().nullable().optional(),
  contentSnippet: z.string().nullable().optional(),
  metadata: MetadataSchema,
  createdAt: TimestampSchema,
});
export type ContextReceiptItem = z.infer<typeof ContextReceiptItemSchema>;

export const CreateContextReceiptItemSchema = z.object({
  id: IdSchema.optional(),
  contextReceiptId: IdSchema,
  projectId: IdSchema,
  resourceType: ContextReceiptResourceTypeEnum,
  resourceId: z.string(),
  tier: z.number().int().min(0).max(3),
  inclusionMode: ContextReceiptInclusionModeEnum,
  exclusionReason: z.string().optional(),
  estimatedTokens: z.number().int().optional(),
  contentSnippet: z.string().optional(),
  metadata: MetadataSchema.optional(),
});
export type CreateContextReceiptItemInput = z.infer<typeof CreateContextReceiptItemSchema>;

