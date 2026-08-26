import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// Workspace Settings (singleton)
export const workspaceSettings = pgTable("workspace_settings", {
  id: text("id").primaryKey().default("default"),
  defaultLocale: text("default_locale").notNull().default("zh-CN"),
  theme: text("theme").notNull().default("system"),
  activeProjectId: text("active_project_id"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Projects
export const projects = pgTable(
  "projects",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    archived: boolean("archived").notNull().default(false),
    pinned: boolean("pinned").notNull().default(false),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("projects_archived_idx").on(table.archived),
    index("projects_updated_at_idx").on(table.updatedAt),
  ]
);

// Project Settings
export const projectSettings = pgTable(
  "project_settings",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    locale: text("locale"),
    contextBudget: integer("context_budget"),
    tonePreferences: jsonb("tone_preferences").$type<Record<string, unknown>>().notNull().default({}),
    rules: jsonb("rules").$type<unknown[]>().notNull().default([]),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("project_settings_project_id_unique").on(table.projectId),
  ]
);

// Manuscripts
export const manuscripts = pgTable(
  "manuscripts",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    genre: text("genre").notNull().default("novel"),
    order: integer("order").notNull().default(0),
    status: text("status").notNull().default("active"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("manuscripts_project_id_idx").on(table.projectId),
    index("manuscripts_order_idx").on(table.projectId, table.order),
  ]
);

// Scenes
export const scenes = pgTable(
  "scenes",
  {
    id: text("id").primaryKey(),
    manuscriptId: text("manuscriptId")
      .notNull()
      .references(() => manuscripts.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    order: integer("order").notNull().default(0),
    content: text("content").notNull().default(""),
    pov: text("pov"),
    location: text("location"),
    timeframe: text("timeframe"),
    summary: text("summary"),
    characterCount: integer("character_count").notNull().default(0),
    currentRevisionId: text("current_revision_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("scenes_manuscript_id_idx").on(table.manuscriptId),
    index("scenes_project_id_idx").on(table.projectId),
    index("scenes_order_idx").on(table.manuscriptId, table.order),
  ]
);

// Scene Revisions
export const sceneRevisions = pgTable(
  "scene_revisions",
  {
    id: text("id").primaryKey(),
    sceneId: text("scene_id")
      .notNull()
      .references(() => scenes.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    revisionNumber: integer("revision_number").notNull(),
    changeType: text("change_type").notNull(), // 'manual_edit' | 'ai_accepted' | 'cut' | 'checkpoint' | 'rollback' | 'pre_apply' | 'initial'
    description: text("description").notNull(),
    content: text("content").notNull(),
    diffSummary: text("diff_summary"),
    characterCount: integer("character_count").notNull().default(0),
    rollbackSourceRevId: text("rollback_source_rev_id"),
    appliedChangeSetId: text("applied_change_set_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("scene_revisions_scene_id_idx").on(table.sceneId),
    index("scene_revisions_project_id_idx").on(table.projectId),
    uniqueIndex("scene_revisions_scene_number_unique").on(table.sceneId, table.revisionNumber),
  ]
);

export type WorkspaceSettingsTable = typeof workspaceSettings.$inferSelect;
export type InsertWorkspaceSettings = typeof workspaceSettings.$inferInsert;

export type ProjectTable = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

export type ProjectSettingsTable = typeof projectSettings.$inferSelect;
export type InsertProjectSettings = typeof projectSettings.$inferInsert;

export type ManuscriptTable = typeof manuscripts.$inferSelect;
export type InsertManuscript = typeof manuscripts.$inferInsert;

export type SceneTable = typeof scenes.$inferSelect;
export type InsertScene = typeof scenes.$inferInsert;

export type SceneRevisionTable = typeof sceneRevisions.$inferSelect;
export type InsertSceneRevision = typeof sceneRevisions.$inferInsert;

