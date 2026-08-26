import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  doublePrecision,
  jsonb,
  vector,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { projects, manuscripts, scenes } from "./workspace";

// Knowledge Nodes
export const knowledgeNodes = pgTable(
  "knowledge_nodes",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    manuscriptId: text("manuscript_id").references(() => manuscripts.id, { onDelete: "cascade" }),
    sceneId: text("scene_id").references(() => scenes.id, { onDelete: "cascade" }),
    parentId: text("parent_id"),
    kind: text("kind").notNull(), // 'creative_vision' | 'synopsis' | 'theme' | 'outline' | 'character' | 'location' | 'timeline' | 'motif' | 'voice_reference' | 'world_rule' | 'research_note' | 'reference_document' | 'image_reference' | 'audio_reference' | 'video_reference' | 'agent_derived' | 'custom'
    title: text("title").notNull(),
    content: text("content").notNull().default(""),
    summary: text("summary"),
    authority: text("authority").notNull().default("user_authored_locked"), // 'user_authored_locked' | 'user_corrected' | 'imported_primary' | 'agent_approved' | 'agent_unreviewed'
    status: text("status").notNull().default("active"), // 'active' | 'archived' | 'draft'
    isPinned: boolean("is_pinned").notNull().default(false),
    language: text("language").notNull().default("zh-CN"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("knowledge_nodes_project_id_idx").on(table.projectId),
    index("knowledge_nodes_kind_idx").on(table.projectId, table.kind),
    index("knowledge_nodes_parent_id_idx").on(table.parentId),
  ]
);

// Knowledge Assets
export const knowledgeAssets = pgTable(
  "knowledge_assets",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    nodeId: text("node_id").references(() => knowledgeNodes.id, { onDelete: "set null" }),
    sha256: text("sha256").notNull(),
    storagePath: text("storage_path").notNull(),
    originalFileName: text("original_file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("knowledge_assets_project_id_idx").on(table.projectId),
    index("knowledge_assets_sha256_idx").on(table.sha256),
  ]
);

// Knowledge Artifacts (extracted layers: OCR, transcript, structure, summary)
export const knowledgeArtifacts = pgTable(
  "knowledge_artifacts",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    nodeId: text("node_id")
      .notNull()
      .references(() => knowledgeNodes.id, { onDelete: "cascade" }),
    assetId: text("asset_id").references(() => knowledgeAssets.id, { onDelete: "set null" }),
    layer: text("layer").notNull(), // 'extraction' | 'structure' | 'summary' | 'index'
    generatorType: text("generator_type").notNull(),
    generatorModel: text("generator_model"),
    generatorVersion: text("generator_version"),
    content: text("content").notNull(),
    structuredData: jsonb("structured_data").$type<Record<string, unknown>>().notNull().default({}),
    confidence: doublePrecision("confidence"),
    isUserCorrected: boolean("is_user_corrected").notNull().default(false),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("knowledge_artifacts_node_id_idx").on(table.nodeId),
    index("knowledge_artifacts_layer_idx").on(table.layer),
  ]
);

// Knowledge Chunks (with pgvector for semantic retrieval)
export const knowledgeChunks = pgTable(
  "knowledge_chunks",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    nodeId: text("node_id")
      .notNull()
      .references(() => knowledgeNodes.id, { onDelete: "cascade" }),
    artifactId: text("artifact_id").references(() => knowledgeArtifacts.id, { onDelete: "set null" }),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: 1536 }),
    sourceLocator: jsonb("source_locator").$type<Record<string, unknown>>().notNull().default({}),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("knowledge_chunks_node_id_idx").on(table.nodeId),
    index("knowledge_chunks_project_id_idx").on(table.projectId),
    uniqueIndex("knowledge_chunks_node_idx_unique").on(table.nodeId, table.chunkIndex),
  ]
);

// Knowledge Relations
export const knowledgeRelations = pgTable(
  "knowledge_relations",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    sourceNodeId: text("source_node_id")
      .notNull()
      .references(() => knowledgeNodes.id, { onDelete: "cascade" }),
    targetNodeId: text("target_node_id")
      .notNull()
      .references(() => knowledgeNodes.id, { onDelete: "cascade" }),
    relationType: text("relation_type").notNull(), // 'references' | 'conflicts_with' | 'explains' | 'character_in_scene' | 'motif_in_scene' | 'location_of_scene' | 'custom'
    description: text("description"),
    confidence: doublePrecision("confidence"),
    isUserConfirmed: boolean("is_user_confirmed").notNull().default(false),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("knowledge_relations_source_idx").on(table.sourceNodeId),
    index("knowledge_relations_target_idx").on(table.targetNodeId),
    index("knowledge_relations_project_id_idx").on(table.projectId),
  ]
);

// Knowledge Revisions
export const knowledgeRevisions = pgTable(
  "knowledge_revisions",
  {
    id: text("id").primaryKey(),
    nodeId: text("node_id")
      .notNull()
      .references(() => knowledgeNodes.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    revisionNumber: integer("revision_number").notNull(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    summary: text("summary"),
    changeType: text("change_type").notNull(), // 'manual_edit' | 'agent_proposal' | 'revert' | 'initial'
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("knowledge_revisions_node_id_idx").on(table.nodeId),
    uniqueIndex("knowledge_revisions_node_number_unique").on(table.nodeId, table.revisionNumber),
  ]
);

// Media Segments
export const mediaSegments = pgTable(
  "media_segments",
  {
    id: text("id").primaryKey(),
    assetId: text("asset_id")
      .notNull()
      .references(() => knowledgeAssets.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    segmentType: text("segment_type").notNull(), // 'video_scene' | 'audio_utterance' | 'page_image' | 'keyframe'
    startTimeMs: integer("start_time_ms"),
    endTimeMs: integer("end_time_ms"),
    pageNumber: integer("page_number"),
    storagePath: text("storage_path"),
    transcript: text("transcript"),
    visualDescription: text("visual_description"),
    speakers: jsonb("speakers").$type<string[]>().notNull().default([]),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("media_segments_asset_id_idx").on(table.assetId),
    index("media_segments_project_id_idx").on(table.projectId),
  ]
);

// Ingestion Jobs
export const ingestionJobs = pgTable(
  "ingestion_jobs",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    assetId: text("asset_id")
      .notNull()
      .references(() => knowledgeAssets.id, { onDelete: "cascade" }),
    nodeId: text("node_id").references(() => knowledgeNodes.id, { onDelete: "set null" }),
    jobType: text("job_type").notNull(), // 'extract_text' | 'transcribe_audio' | 'analyze_video' | 'generate_summary' | 'generate_embeddings'
    status: text("status").notNull().default("pending"), // 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
    pgBossJobId: text("pg_boss_job_id"),
    progress: integer("progress").notNull().default(0),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("ingestion_jobs_project_id_idx").on(table.projectId),
    index("ingestion_jobs_status_idx").on(table.status),
    index("ingestion_jobs_asset_id_idx").on(table.assetId),
  ]
);

export type KnowledgeNodeTable = typeof knowledgeNodes.$inferSelect;
export type InsertKnowledgeNode = typeof knowledgeNodes.$inferInsert;

export type KnowledgeAssetTable = typeof knowledgeAssets.$inferSelect;
export type InsertKnowledgeAsset = typeof knowledgeAssets.$inferInsert;

export type KnowledgeArtifactTable = typeof knowledgeArtifacts.$inferSelect;
export type InsertKnowledgeArtifact = typeof knowledgeArtifacts.$inferInsert;

export type KnowledgeChunkTable = typeof knowledgeChunks.$inferSelect;
export type InsertKnowledgeChunk = typeof knowledgeChunks.$inferInsert;

export type KnowledgeRelationTable = typeof knowledgeRelations.$inferSelect;
export type InsertKnowledgeRelation = typeof knowledgeRelations.$inferInsert;

export type KnowledgeRevisionTable = typeof knowledgeRevisions.$inferSelect;
export type InsertKnowledgeRevision = typeof knowledgeRevisions.$inferInsert;

export type MediaSegmentTable = typeof mediaSegments.$inferSelect;
export type InsertMediaSegment = typeof mediaSegments.$inferInsert;

export type IngestionJobTable = typeof ingestionJobs.$inferSelect;
export type InsertIngestionJob = typeof ingestionJobs.$inferInsert;

