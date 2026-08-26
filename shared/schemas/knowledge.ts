import { z } from "zod";
import { IdSchema, MetadataSchema, TimestampSchema } from "./common";

export const KnowledgeKindEnum = z.enum([
  "creative_vision",
  "synopsis",
  "theme",
  "outline",
  "character",
  "location",
  "timeline",
  "motif",
  "voice_reference",
  "world_rule",
  "research_note",
  "reference_document",
  "image_reference",
  "audio_reference",
  "video_reference",
  "agent_derived",
  "custom",
]);
export type KnowledgeKind = z.infer<typeof KnowledgeKindEnum>;

export const KnowledgeAuthorityEnum = z.enum([
  "user_authored_locked",
  "user_corrected",
  "imported_primary",
  "agent_approved",
  "agent_unreviewed",
]);
export type KnowledgeAuthority = z.infer<typeof KnowledgeAuthorityEnum>;

export const KnowledgeStatusEnum = z.enum(["active", "archived", "draft"]);
export type KnowledgeStatus = z.infer<typeof KnowledgeStatusEnum>;

export const KnowledgeArtifactLayerEnum = z.enum(["extraction", "structure", "summary", "index"]);
export type KnowledgeArtifactLayer = z.infer<typeof KnowledgeArtifactLayerEnum>;

export const KnowledgeRelationTypeEnum = z.enum([
  "references",
  "conflicts_with",
  "explains",
  "character_in_scene",
  "motif_in_scene",
  "location_of_scene",
  "custom",
]);
export type KnowledgeRelationType = z.infer<typeof KnowledgeRelationTypeEnum>;

export const MediaSegmentTypeEnum = z.enum([
  "video_scene",
  "audio_utterance",
  "page_image",
  "keyframe",
]);
export type MediaSegmentType = z.infer<typeof MediaSegmentTypeEnum>;

export const IngestionJobTypeEnum = z.enum([
  "extract_text",
  "transcribe_audio",
  "analyze_video",
  "generate_summary",
  "generate_embeddings",
]);
export type IngestionJobType = z.infer<typeof IngestionJobTypeEnum>;

export const IngestionJobStatusEnum = z.enum([
  "pending",
  "processing",
  "completed",
  "failed",
  "cancelled",
]);
export type IngestionJobStatus = z.infer<typeof IngestionJobStatusEnum>;

// Knowledge Node
export const KnowledgeNodeSchema = z.object({
  id: IdSchema,
  projectId: IdSchema,
  manuscriptId: IdSchema.nullable().optional(),
  sceneId: IdSchema.nullable().optional(),
  parentId: IdSchema.nullable().optional(),
  kind: KnowledgeKindEnum,
  title: z.string().min(1),
  content: z.string().default(""),
  summary: z.string().nullable().optional(),
  authority: KnowledgeAuthorityEnum.default("user_authored_locked"),
  status: KnowledgeStatusEnum.default("active"),
  isPinned: z.boolean().default(false),
  language: z.string().default("zh-CN"),
  metadata: MetadataSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
export type KnowledgeNode = z.infer<typeof KnowledgeNodeSchema>;

export const CreateKnowledgeNodeSchema = z.object({
  id: IdSchema.optional(),
  projectId: IdSchema,
  manuscriptId: IdSchema.optional(),
  sceneId: IdSchema.optional(),
  parentId: IdSchema.optional(),
  kind: KnowledgeKindEnum,
  title: z.string().min(1),
  content: z.string().optional(),
  summary: z.string().optional(),
  authority: KnowledgeAuthorityEnum.optional(),
  status: KnowledgeStatusEnum.optional(),
  isPinned: z.boolean().optional(),
  language: z.string().optional(),
  metadata: MetadataSchema.optional(),
});
export type CreateKnowledgeNodeInput = z.infer<typeof CreateKnowledgeNodeSchema>;

export const UpdateKnowledgeNodeSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().optional(),
  summary: z.string().nullable().optional(),
  authority: KnowledgeAuthorityEnum.optional(),
  status: KnowledgeStatusEnum.optional(),
  isPinned: z.boolean().optional(),
  language: z.string().optional(),
  parentId: IdSchema.nullable().optional(),
  metadata: MetadataSchema.optional(),
});
export type UpdateKnowledgeNodeInput = z.infer<typeof UpdateKnowledgeNodeSchema>;

// Knowledge Asset
export const KnowledgeAssetSchema = z.object({
  id: IdSchema,
  projectId: IdSchema,
  nodeId: IdSchema.nullable().optional(),
  sha256: z.string().min(64).max(64),
  storagePath: z.string().min(1),
  originalFileName: z.string().min(1),
  mimeType: z.string().min(1),
  byteSize: z.number().int().nonnegative(),
  metadata: MetadataSchema,
  createdAt: TimestampSchema,
});
export type KnowledgeAsset = z.infer<typeof KnowledgeAssetSchema>;

export const CreateKnowledgeAssetSchema = z.object({
  id: IdSchema.optional(),
  projectId: IdSchema,
  nodeId: IdSchema.optional(),
  sha256: z.string().min(64).max(64),
  storagePath: z.string().min(1),
  originalFileName: z.string().min(1),
  mimeType: z.string().min(1),
  byteSize: z.number().int().nonnegative(),
  metadata: MetadataSchema.optional(),
});
export type CreateKnowledgeAssetInput = z.infer<typeof CreateKnowledgeAssetSchema>;

// Knowledge Artifact
export const KnowledgeArtifactSchema = z.object({
  id: IdSchema,
  projectId: IdSchema,
  nodeId: IdSchema,
  assetId: IdSchema.nullable().optional(),
  layer: KnowledgeArtifactLayerEnum,
  generatorType: z.string().min(1),
  generatorModel: z.string().nullable().optional(),
  generatorVersion: z.string().nullable().optional(),
  content: z.string(),
  structuredData: MetadataSchema,
  confidence: z.number().nullable().optional(),
  isUserCorrected: z.boolean().default(false),
  metadata: MetadataSchema,
  createdAt: TimestampSchema,
});
export type KnowledgeArtifact = z.infer<typeof KnowledgeArtifactSchema>;

export const CreateKnowledgeArtifactSchema = z.object({
  id: IdSchema.optional(),
  projectId: IdSchema,
  nodeId: IdSchema,
  assetId: IdSchema.optional(),
  layer: KnowledgeArtifactLayerEnum,
  generatorType: z.string().min(1),
  generatorModel: z.string().optional(),
  generatorVersion: z.string().optional(),
  content: z.string(),
  structuredData: MetadataSchema.optional(),
  confidence: z.number().optional(),
  isUserCorrected: z.boolean().optional(),
  metadata: MetadataSchema.optional(),
});
export type CreateKnowledgeArtifactInput = z.infer<typeof CreateKnowledgeArtifactSchema>;

// Knowledge Chunk
export const KnowledgeChunkSchema = z.object({
  id: IdSchema,
  projectId: IdSchema,
  nodeId: IdSchema,
  artifactId: IdSchema.nullable().optional(),
  chunkIndex: z.number().int().nonnegative(),
  content: z.string().min(1),
  embedding: z.array(z.number()).nullable().optional(),
  sourceLocator: MetadataSchema,
  metadata: MetadataSchema,
  createdAt: TimestampSchema,
});
export type KnowledgeChunk = z.infer<typeof KnowledgeChunkSchema>;

export const CreateKnowledgeChunkSchema = z.object({
  id: IdSchema.optional(),
  projectId: IdSchema,
  nodeId: IdSchema,
  artifactId: IdSchema.optional(),
  chunkIndex: z.number().int().nonnegative(),
  content: z.string().min(1),
  embedding: z.array(z.number()).optional(),
  sourceLocator: MetadataSchema.optional(),
  metadata: MetadataSchema.optional(),
});
export type CreateKnowledgeChunkInput = z.infer<typeof CreateKnowledgeChunkSchema>;

// Knowledge Relation
export const KnowledgeRelationSchema = z.object({
  id: IdSchema,
  projectId: IdSchema,
  sourceNodeId: IdSchema,
  targetNodeId: IdSchema,
  relationType: KnowledgeRelationTypeEnum,
  description: z.string().nullable().optional(),
  confidence: z.number().nullable().optional(),
  isUserConfirmed: z.boolean().default(false),
  metadata: MetadataSchema,
  createdAt: TimestampSchema,
});
export type KnowledgeRelation = z.infer<typeof KnowledgeRelationSchema>;

export const CreateKnowledgeRelationSchema = z.object({
  id: IdSchema.optional(),
  projectId: IdSchema,
  sourceNodeId: IdSchema,
  targetNodeId: IdSchema,
  relationType: KnowledgeRelationTypeEnum,
  description: z.string().optional(),
  confidence: z.number().optional(),
  isUserConfirmed: z.boolean().optional(),
  metadata: MetadataSchema.optional(),
});
export type CreateKnowledgeRelationInput = z.infer<typeof CreateKnowledgeRelationSchema>;

// Knowledge Revision
export const KnowledgeRevisionSchema = z.object({
  id: IdSchema,
  nodeId: IdSchema,
  projectId: IdSchema,
  revisionNumber: z.number().int().positive(),
  title: z.string(),
  content: z.string(),
  summary: z.string().nullable().optional(),
  changeType: z.enum(["manual_edit", "agent_proposal", "revert", "initial"]),
  metadata: MetadataSchema,
  createdAt: TimestampSchema,
});
export type KnowledgeRevision = z.infer<typeof KnowledgeRevisionSchema>;

export const CreateKnowledgeRevisionSchema = z.object({
  id: IdSchema.optional(),
  nodeId: IdSchema,
  projectId: IdSchema,
  revisionNumber: z.number().int().positive().optional(),
  title: z.string(),
  content: z.string(),
  summary: z.string().optional(),
  changeType: z.enum(["manual_edit", "agent_proposal", "revert", "initial"]),
  metadata: MetadataSchema.optional(),
});
export type CreateKnowledgeRevisionInput = z.infer<typeof CreateKnowledgeRevisionSchema>;

// Media Segment
export const MediaSegmentSchema = z.object({
  id: IdSchema,
  assetId: IdSchema,
  projectId: IdSchema,
  segmentType: MediaSegmentTypeEnum,
  startTimeMs: z.number().int().nullable().optional(),
  endTimeMs: z.number().int().nullable().optional(),
  pageNumber: z.number().int().nullable().optional(),
  storagePath: z.string().nullable().optional(),
  transcript: z.string().nullable().optional(),
  visualDescription: z.string().nullable().optional(),
  speakers: z.array(z.string()).default([]),
  metadata: MetadataSchema,
  createdAt: TimestampSchema,
});
export type MediaSegment = z.infer<typeof MediaSegmentSchema>;

export const CreateMediaSegmentSchema = z.object({
  id: IdSchema.optional(),
  assetId: IdSchema,
  projectId: IdSchema,
  segmentType: MediaSegmentTypeEnum,
  startTimeMs: z.number().int().optional(),
  endTimeMs: z.number().int().optional(),
  pageNumber: z.number().int().optional(),
  storagePath: z.string().optional(),
  transcript: z.string().optional(),
  visualDescription: z.string().optional(),
  speakers: z.array(z.string()).optional(),
  metadata: MetadataSchema.optional(),
});
export type CreateMediaSegmentInput = z.infer<typeof CreateMediaSegmentSchema>;

// Ingestion Job
export const IngestionJobSchema = z.object({
  id: IdSchema,
  projectId: IdSchema,
  assetId: IdSchema,
  nodeId: IdSchema.nullable().optional(),
  jobType: IngestionJobTypeEnum,
  status: IngestionJobStatusEnum.default("pending"),
  pgBossJobId: z.string().nullable().optional(),
  progress: z.number().int().min(0).max(100).default(0),
  error: z.string().nullable().optional(),
  startedAt: TimestampSchema.nullable().optional(),
  completedAt: TimestampSchema.nullable().optional(),
  metadata: MetadataSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
export type IngestionJob = z.infer<typeof IngestionJobSchema>;

export const CreateIngestionJobSchema = z.object({
  id: IdSchema.optional(),
  projectId: IdSchema,
  assetId: IdSchema,
  nodeId: IdSchema.optional(),
  jobType: IngestionJobTypeEnum,
  status: IngestionJobStatusEnum.optional(),
  pgBossJobId: z.string().optional(),
  metadata: MetadataSchema.optional(),
});
export type CreateIngestionJobInput = z.infer<typeof CreateIngestionJobSchema>;

export const UpdateIngestionJobSchema = z.object({
  status: IngestionJobStatusEnum.optional(),
  progress: z.number().int().min(0).max(100).optional(),
  error: z.string().nullable().optional(),
  startedAt: TimestampSchema.nullable().optional(),
  completedAt: TimestampSchema.nullable().optional(),
  metadata: MetadataSchema.optional(),
});
export type UpdateIngestionJobInput = z.infer<typeof UpdateIngestionJobSchema>;

