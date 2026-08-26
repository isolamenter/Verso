import {
  pgTable,
  text,
  timestamp,
  doublePrecision,
  integer,
  jsonb,
  vector,
  index,
} from "drizzle-orm/pg-core";
import { projects } from "./workspace";

// Memory Entries (hierarchical memory with vector embeddings)
export const memoryEntries = pgTable(
  "memory_entries",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }), // null = workspace-wide
    scope: text("scope").notNull(), // 'workspace' | 'project' | 'manuscript'
    scopeId: text("scope_id"),
    layer: text("layer").notNull(), // 'explicit_profile' | 'taste_profile' | 'procedural' | 'project_convention' | 'episodic_evidence' | 'session_context'
    key: text("key").notNull(),
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: 1536 }),
    confidence: doublePrecision("confidence").notNull().default(1.0),
    status: text("status").notNull().default("active"), // 'candidate' | 'active' | 'contested' | 'superseded' | 'disabled'
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("memory_entries_project_id_idx").on(table.projectId),
    index("memory_entries_scope_layer_idx").on(table.scope, table.layer),
    index("memory_entries_status_idx").on(table.status),
  ]
);

// Memory Evidence (links episodic evidence to memory entries)
export const memoryEvidence = pgTable(
  "memory_evidence",
  {
    id: text("id").primaryKey(),
    memoryEntryId: text("memory_entry_id")
      .notNull()
      .references(() => memoryEntries.id, { onDelete: "cascade" }),
    projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }),
    sourceType: text("source_type").notNull(), // 'explicit_statement' | 'change_review' | 'manual_edit_after_agent' | 'user_correction' | 'conversation'
    sourceId: text("source_id"),
    quote: text("quote"),
    weight: doublePrecision("weight").notNull().default(1.0),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("memory_evidence_entry_id_idx").on(table.memoryEntryId),
    index("memory_evidence_project_id_idx").on(table.projectId),
  ]
);

// Taste Entries (evidence-backed literary preference model)
export const tasteEntries = pgTable(
  "taste_entries",
  {
    id: text("id").primaryKey(),
    scope: text("scope").notNull().default("workspace"), // 'workspace' | 'project' | 'manuscript'
    scopeId: text("scope_id"),
    dimension: text("dimension").notNull(), // e.g. "intervention_strength", "explicitness", "narrative_distance", etc.
    preference: text("preference").notNull(),
    conditions: jsonb("conditions").$type<string[]>().notNull().default([]),
    antiPreferences: jsonb("anti_preferences").$type<string[]>().notNull().default([]),
    confidence: doublePrecision("confidence").notNull().default(0.5),
    status: text("status").notNull().default("active"), // 'candidate' | 'active' | 'contested' | 'superseded' | 'disabled'
    explicitness: text("explicitness").notNull().default("inferred"), // 'explicit' | 'inferred'
    firstObservedAt: timestamp("first_observed_at", { withTimezone: true }).defaultNow().notNull(),
    lastObservedAt: timestamp("last_observed_at", { withTimezone: true }).defaultNow().notNull(),
    lastConfirmedAt: timestamp("last_confirmed_at", { withTimezone: true }),
    supersedesId: text("supersedes_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("taste_entries_scope_idx").on(table.scope, table.scopeId),
    index("taste_entries_dimension_idx").on(table.dimension),
    index("taste_entries_status_idx").on(table.status),
  ]
);

// Taste Entry Evidence
export const tasteEntryEvidence = pgTable(
  "taste_entry_evidence",
  {
    id: text("id").primaryKey(),
    tasteEntryId: text("taste_entry_id")
      .notNull()
      .references(() => tasteEntries.id, { onDelete: "cascade" }),
    sourceType: text("source_type").notNull(), // 'explicit_statement' | 'change_review' | 'manual_edit_after_agent' | 'user_correction' | 'conversation'
    sourceId: text("source_id"),
    quote: text("quote"),
    weight: doublePrecision("weight").notNull().default(1.0),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("taste_entry_evidence_taste_entry_id_idx").on(table.tasteEntryId),
  ]
);

// Memory & Taste Revisions (audit history of learned memory/taste changes)
export const memoryRevisions = pgTable(
  "memory_revisions",
  {
    id: text("id").primaryKey(),
    memoryEntryId: text("memory_entry_id").references(() => memoryEntries.id, { onDelete: "cascade" }),
    tasteEntryId: text("taste_entry_id").references(() => tasteEntries.id, { onDelete: "cascade" }),
    revisionNumber: integer("revision_number").notNull(),
    previousState: jsonb("previous_state").$type<Record<string, unknown>>().notNull().default({}),
    newState: jsonb("new_state").$type<Record<string, unknown>>().notNull().default({}),
    changeReason: text("change_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("memory_revisions_memory_entry_idx").on(table.memoryEntryId),
    index("memory_revisions_taste_entry_idx").on(table.tasteEntryId),
  ]
);

export type MemoryEntryTable = typeof memoryEntries.$inferSelect;
export type InsertMemoryEntry = typeof memoryEntries.$inferInsert;

export type MemoryEvidenceTable = typeof memoryEvidence.$inferSelect;
export type InsertMemoryEvidence = typeof memoryEvidence.$inferInsert;

export type TasteEntryTable = typeof tasteEntries.$inferSelect;
export type InsertTasteEntry = typeof tasteEntries.$inferInsert;

export type TasteEntryEvidenceTable = typeof tasteEntryEvidence.$inferSelect;
export type InsertTasteEntryEvidence = typeof tasteEntryEvidence.$inferInsert;

export type MemoryRevisionTable = typeof memoryRevisions.$inferSelect;
export type InsertMemoryRevision = typeof memoryRevisions.$inferInsert;

