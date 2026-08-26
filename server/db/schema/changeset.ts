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
import { agentThreads, agentRuns } from "./agent";

// Change Sets
export const changeSets = pgTable(
  "change_sets",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    threadId: text("thread_id").references(() => agentThreads.id, { onDelete: "set null" }),
    runId: text("run_id").references(() => agentRuns.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    objective: text("objective").notNull(),
    rationale: text("rationale"),
    status: text("status").notNull().default("draft"), // 'draft' | 'proposed' | 'partially_approved' | 'approved' | 'applying' | 'applied' | 'rejected' | 'superseded' | 'needs_rebase' | 'failed'
    baseRevisionMap: jsonb("base_revision_map").$type<Record<string, string>>().notNull().default({}),
    contextReceiptId: text("context_receipt_id"),
    skillInvocationIds: jsonb("skill_invocation_ids").$type<string[]>().notNull().default([]),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("change_sets_project_id_idx").on(table.projectId),
    index("change_sets_status_idx").on(table.status),
    index("change_sets_thread_id_idx").on(table.threadId),
  ]
);

// Change Operations
export const changeOperations = pgTable(
  "change_operations",
  {
    id: text("id").primaryKey(),
    changeSetId: text("change_set_id")
      .notNull()
      .references(() => changeSets.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    sequenceNumber: integer("sequence_number").notNull(),
    targetType: text("target_type").notNull(), // 'scene' | 'knowledge_node' | 'manuscript'
    targetId: text("target_id").notNull(),
    baseRevisionId: text("base_revision_id"),
    operationType: text("operation_type").notNull(), // 'replace_text_range' | 'insert_text' | 'delete_text_range' | 'replace_scene' | 'append_to_scene' | 'create_scene' | 'update_scene_metadata' | 'reorder_scenes' | 'create_knowledge' | 'update_knowledge' | 'archive_knowledge' | 'link_knowledge'
    status: text("status").notNull().default("proposed"), // 'proposed' | 'approved' | 'rejected' | 'applied' | 'failed' | 'conflict'
    quote: text("quote"),
    prefixAnchor: text("prefix_anchor"),
    suffixAnchor: text("suffix_anchor"),
    originalChecksum: text("original_checksum"),
    rangeFrom: integer("range_from"),
    rangeTo: integer("range_to"),
    replacementContent: text("replacement_content"),
    literaryTradeoff: text("literary_tradeoff"),
    structuredPayload: jsonb("structured_payload").$type<Record<string, unknown>>().notNull().default({}),
    validationResult: jsonb("validation_result").$type<Record<string, unknown>>(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("change_operations_change_set_id_idx").on(table.changeSetId),
    index("change_operations_project_id_idx").on(table.projectId),
    uniqueIndex("change_operations_set_seq_unique").on(table.changeSetId, table.sequenceNumber),
  ]
);

// Change Reviews
export const changeReviews = pgTable(
  "change_reviews",
  {
    id: text("id").primaryKey(),
    changeSetId: text("change_set_id")
      .notNull()
      .references(() => changeSets.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    operationId: text("operation_id").references(() => changeOperations.id, { onDelete: "cascade" }),
    decision: text("decision").notNull(), // 'approved' | 'rejected' | 'revised'
    userFeedback: text("user_feedback"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("change_reviews_change_set_id_idx").on(table.changeSetId),
    index("change_reviews_project_id_idx").on(table.projectId),
  ]
);

// Change Apply Attempts
export const changeApplyAttempts = pgTable(
  "change_apply_attempts",
  {
    id: text("id").primaryKey(),
    changeSetId: text("change_set_id")
      .notNull()
      .references(() => changeSets.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    status: text("status").notNull(), // 'success' | 'conflict' | 'failed' | 'rolled_back'
    resultingRevisionMap: jsonb("resulting_revision_map").$type<Record<string, string>>().notNull().default({}),
    error: text("error"),
    attemptedAt: timestamp("attempted_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("change_apply_attempts_change_set_id_idx").on(table.changeSetId),
    index("change_apply_attempts_project_id_idx").on(table.projectId),
  ]
);

export type ChangeSetTable = typeof changeSets.$inferSelect;
export type InsertChangeSet = typeof changeSets.$inferInsert;

export type ChangeOperationTable = typeof changeOperations.$inferSelect;
export type InsertChangeOperation = typeof changeOperations.$inferInsert;

export type ChangeReviewTable = typeof changeReviews.$inferSelect;
export type InsertChangeReview = typeof changeReviews.$inferInsert;

export type ChangeApplyAttemptTable = typeof changeApplyAttempts.$inferSelect;
export type InsertChangeApplyAttempt = typeof changeApplyAttempts.$inferInsert;

