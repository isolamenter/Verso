import {
  pgTable,
  text,
  timestamp,
  boolean,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { projects } from "./workspace";
import { agentRuns } from "./agent";

// Skill Definitions (canonical registry of built-in & custom skills)
export const skillDefinitions = pgTable(
  "skill_definitions",
  {
    id: text("id").primaryKey(), // canonical ID e.g. "critique_language", "cold_reader", "draft"
    name: text("name").notNull(),
    description: text("description").notNull(),
    category: text("category").notNull(), // 'critique' | 'analysis' | 'drafting' | 'profiling' | 'custom'
    isBuiltIn: boolean("is_built_in").notNull().default(true),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("skill_definitions_category_idx").on(table.category),
  ]
);

// Skill Versions (versioned packages: instructions, context policies, output schemas)
export const skillVersions = pgTable(
  "skill_versions",
  {
    id: text("id").primaryKey(),
    skillId: text("skill_id")
      .notNull()
      .references(() => skillDefinitions.id, { onDelete: "cascade" }),
    version: text("version").notNull(), // e.g. "1.0.0"
    manifest: jsonb("manifest").$type<Record<string, unknown>>().notNull().default({}),
    instructions: text("instructions").notNull(),
    outputSchema: jsonb("output_schema").$type<Record<string, unknown>>().notNull().default({}),
    contextPolicy: jsonb("context_policy").$type<Record<string, unknown>>().notNull().default({}),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("skill_versions_skill_id_idx").on(table.skillId),
    uniqueIndex("skill_versions_skill_ver_unique").on(table.skillId, table.version),
  ]
);

// Skill Overlays (user-customized parameters overlaying a built-in skill)
export const skillOverlays = pgTable(
  "skill_overlays",
  {
    id: text("id").primaryKey(),
    skillId: text("skill_id")
      .notNull()
      .references(() => skillDefinitions.id, { onDelete: "cascade" }),
    projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }), // null = workspace-wide
    customName: text("custom_name"),
    focusAreas: jsonb("focus_areas").$type<string[]>().notNull().default([]),
    avoidAreas: jsonb("avoid_areas").$type<string[]>().notNull().default([]),
    preferredStrength: text("preferred_strength"),
    customInstructions: text("custom_instructions"),
    isEnabled: boolean("is_enabled").notNull().default(true),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("skill_overlays_skill_id_idx").on(table.skillId),
    index("skill_overlays_project_id_idx").on(table.projectId),
  ]
);

// Skill Invocations (audit link between an Agent Run and the resolved Skill & Overlay)
export const skillInvocations = pgTable(
  "skill_invocations",
  {
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => agentRuns.id, { onDelete: "cascade" }),
    skillId: text("skill_id")
      .notNull()
      .references(() => skillDefinitions.id, { onDelete: "cascade" }),
    skillVersionId: text("skill_version_id").references(() => skillVersions.id, { onDelete: "set null" }),
    overlayId: text("overlay_id").references(() => skillOverlays.id, { onDelete: "set null" }),
    invocationMode: text("invocation_mode").notNull(), // 'explicit' | 'automatic' | 'suggested'
    resolvedParameters: jsonb("resolved_parameters").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("skill_invocations_run_id_idx").on(table.runId),
    index("skill_invocations_skill_id_idx").on(table.skillId),
  ]
);

export type SkillDefinitionTable = typeof skillDefinitions.$inferSelect;
export type InsertSkillDefinition = typeof skillDefinitions.$inferInsert;

export type SkillVersionTable = typeof skillVersions.$inferSelect;
export type InsertSkillVersion = typeof skillVersions.$inferInsert;

export type SkillOverlayTable = typeof skillOverlays.$inferSelect;
export type InsertSkillOverlay = typeof skillOverlays.$inferInsert;

export type SkillInvocationTable = typeof skillInvocations.$inferSelect;
export type InsertSkillInvocation = typeof skillInvocations.$inferInsert;

