import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { projects } from "./workspace";

// Agent Threads
export const agentThreads = pgTable(
  "agent_threads",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    status: text("status").notNull().default("active"), // 'active' | 'archived' | 'pinned'
    currentSceneId: text("current_scene_id"),
    activeSkillId: text("active_skill_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("agent_threads_project_id_idx").on(table.projectId),
    index("agent_threads_updated_at_idx").on(table.updatedAt),
  ]
);

// Agent Runs
export const agentRuns = pgTable(
  "agent_runs",
  {
    id: text("id").primaryKey(),
    threadId: text("thread_id")
      .notNull()
      .references(() => agentThreads.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    skillId: text("skill_id"),
    skillVersion: text("skill_version"),
    status: text("status").notNull().default("queued"), // 'queued' | 'planning' | 'resolving_context' | 'executing' | 'awaiting_user' | 'proposing_changes' | 'completed' | 'cancelled' | 'failed'
    modelRole: text("model_role"),
    modelId: text("model_id"),
    targetResource: jsonb("target_resource").$type<Record<string, unknown>>(),
    contextReceiptId: text("context_receipt_id"),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("agent_runs_thread_id_idx").on(table.threadId),
    index("agent_runs_project_id_idx").on(table.projectId),
    index("agent_runs_status_idx").on(table.status),
  ]
);

// Agent Messages
export const agentMessages = pgTable(
  "agent_messages",
  {
    id: text("id").primaryKey(),
    threadId: text("thread_id")
      .notNull()
      .references(() => agentThreads.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    role: text("role").notNull(), // 'user' | 'assistant' | 'system' | 'tool'
    content: text("content").notNull().default(""),
    sequenceNumber: integer("sequence_number").notNull(),
    runId: text("run_id").references(() => agentRuns.id, { onDelete: "set null" }),
    skillId: text("skill_id"),
    targetSceneId: text("target_scene_id"),
    targetRevisionId: text("target_revision_id"),
    attachments: jsonb("attachments").$type<unknown[]>().notNull().default([]),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("agent_messages_thread_id_idx").on(table.threadId),
    index("agent_messages_project_id_idx").on(table.projectId),
    uniqueIndex("agent_messages_thread_seq_unique").on(table.threadId, table.sequenceNumber),
  ]
);

// Agent Run Events (for SSE streaming and resumption)
export const agentRunEvents = pgTable(
  "agent_run_events",
  {
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => agentRuns.id, { onDelete: "cascade" }),
    threadId: text("thread_id")
      .notNull()
      .references(() => agentThreads.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    sequenceNumber: integer("sequence_number").notNull(),
    type: text("type").notNull(), // 'status_change' | 'text_delta' | 'thought_delta' | 'tool_call' | 'tool_result' | 'artifact' | 'receipt' | 'change_set' | 'error'
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("agent_run_events_run_id_idx").on(table.runId),
    uniqueIndex("agent_run_events_run_seq_unique").on(table.runId, table.sequenceNumber),
  ]
);

// Agent Artifacts
export const agentArtifacts = pgTable(
  "agent_artifacts",
  {
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => agentRuns.id, { onDelete: "cascade" }),
    threadId: text("thread_id")
      .notNull()
      .references(() => agentThreads.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // 'critique_report' | 'cold_reader_report' | 'intent_evaluation' | 'version_compare' | 'scene_draft' | 'profiling_summary' | 'custom'
    title: text("title").notNull(),
    content: text("content").notNull(),
    structuredData: jsonb("structured_data").$type<Record<string, unknown>>().notNull().default({}),
    locale: text("locale").notNull().default("zh-CN"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("agent_artifacts_run_id_idx").on(table.runId),
    index("agent_artifacts_project_id_idx").on(table.projectId),
  ]
);

// Context Receipts
export const contextReceipts = pgTable(
  "context_receipts",
  {
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => agentRuns.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    skillId: text("skill_id"),
    skillVersion: text("skill_version"),
    totalTokensApprox: integer("total_tokens_approx"),
    tierBreakdown: jsonb("tier_breakdown").$type<Record<string, unknown>>().notNull().default({}),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("context_receipts_run_id_unique").on(table.runId),
    index("context_receipts_project_id_idx").on(table.projectId),
  ]
);

// Context Receipt Items
export const contextReceiptItems = pgTable(
  "context_receipt_items",
  {
    id: text("id").primaryKey(),
    contextReceiptId: text("context_receipt_id")
      .notNull()
      .references(() => contextReceipts.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    resourceType: text("resource_type").notNull(), // 'scene' | 'knowledge_node' | 'memory_entry' | 'taste_entry' | 'media_segment' | 'skill_instruction' | 'project_convention'
    resourceId: text("resource_id").notNull(),
    tier: integer("tier").notNull(), // 0, 1, 2, 3
    inclusionMode: text("inclusion_mode").notNull(), // 'full' | 'summary' | 'excerpt' | 'locator_only' | 'excluded'
    exclusionReason: text("exclusion_reason"),
    estimatedTokens: integer("estimated_tokens"),
    contentSnippet: text("content_snippet"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("context_receipt_items_receipt_id_idx").on(table.contextReceiptId),
    index("context_receipt_items_project_id_idx").on(table.projectId),
  ]
);

export type AgentThreadTable = typeof agentThreads.$inferSelect;
export type InsertAgentThread = typeof agentThreads.$inferInsert;

export type AgentRunTable = typeof agentRuns.$inferSelect;
export type InsertAgentRun = typeof agentRuns.$inferInsert;

export type AgentMessageTable = typeof agentMessages.$inferSelect;
export type InsertAgentMessage = typeof agentMessages.$inferInsert;

export type AgentRunEventTable = typeof agentRunEvents.$inferSelect;
export type InsertAgentRunEvent = typeof agentRunEvents.$inferInsert;

export type AgentArtifactTable = typeof agentArtifacts.$inferSelect;
export type InsertAgentArtifact = typeof agentArtifacts.$inferInsert;

export type ContextReceiptTable = typeof contextReceipts.$inferSelect;
export type InsertContextReceipt = typeof contextReceipts.$inferInsert;

export type ContextReceiptItemTable = typeof contextReceiptItems.$inferSelect;
export type InsertContextReceiptItem = typeof contextReceiptItems.$inferInsert;

