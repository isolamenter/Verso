import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { projects, scenes } from "./workspace";

// Literary Annotations (preserves existing critique & editorial annotations)
export const literaryAnnotations = pgTable(
  "literary_annotations",
  {
    id: text("id").primaryKey(),
    sceneId: text("scene_id")
      .notNull()
      .references(() => scenes.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    severity: text("severity").notNull(),
    rangeFrom: integer("range_from"),
    rangeTo: integer("range_to"),
    quote: text("quote").notNull(),
    diagnosis: text("diagnosis").notNull(),
    literaryTradeoff: text("literary_tradeoff"),
    suggestion: text("suggestion"),
    replacement: jsonb("replacement").$type<Record<string, unknown>>(),
    appliedReplacementType: text("applied_replacement_type"),
    status: text("status").notNull().default("pending"), // 'pending' | 'accepted' | 'rejected'
    isStale: boolean("is_stale").notNull().default(false),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("literary_annotations_scene_id_idx").on(table.sceneId),
    index("literary_annotations_project_id_idx").on(table.projectId),
    index("literary_annotations_status_idx").on(table.status),
  ]
);

// Margin Notes
export const marginNotes = pgTable(
  "margin_notes",
  {
    id: text("id").primaryKey(),
    sceneId: text("scene_id")
      .notNull()
      .references(() => scenes.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    author: text("author").notNull(), // 'human' | 'ai'
    rangeFrom: integer("range_from").notNull(),
    rangeTo: integer("range_to").notNull(),
    quote: text("quote").notNull(),
    content: text("content").notNull(),
    resolved: boolean("resolved").notNull().default(false),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("margin_notes_scene_id_idx").on(table.sceneId),
    index("margin_notes_project_id_idx").on(table.projectId),
  ]
);

// Import Jobs (for one-time IndexedDB v2 or document import tracking)
export const importJobs = pgTable(
  "import_jobs",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").references(() => projects.id, { onDelete: "set null" }),
    sourceType: text("source_type").notNull(), // 'indexeddb_verso_v2' | 'docx' | 'markdown' | 'backup_tar'
    status: text("status").notNull().default("pending"), // 'pending' | 'processing' | 'completed' | 'failed'
    importedCounts: jsonb("imported_counts").$type<Record<string, unknown>>().notNull().default({}),
    error: text("error"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("import_jobs_project_id_idx").on(table.projectId),
    index("import_jobs_status_idx").on(table.status),
  ]
);

export type LiteraryAnnotationTable = typeof literaryAnnotations.$inferSelect;
export type InsertLiteraryAnnotation = typeof literaryAnnotations.$inferInsert;

export type MarginNoteTable = typeof marginNotes.$inferSelect;
export type InsertMarginNote = typeof marginNotes.$inferInsert;

export type ImportJobTable = typeof importJobs.$inferSelect;
export type InsertImportJob = typeof importJobs.$inferInsert;

