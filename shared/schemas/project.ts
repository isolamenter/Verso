import { z } from "zod";
import { IdSchema, MetadataSchema, TimestampSchema } from "./common";

export const ManuscriptGenreEnum = z.enum([
  "novel",
  "novella",
  "short_story",
  "essay",
  "poetry",
  "other",
]);
export type ManuscriptGenre = z.infer<typeof ManuscriptGenreEnum>;

export const ManuscriptStatusEnum = z.enum(["active", "archived", "draft"]);
export type ManuscriptStatus = z.infer<typeof ManuscriptStatusEnum>;

export const SceneRevisionChangeTypeEnum = z.enum([
  "manual_edit",
  "ai_accepted",
  "cut",
  "checkpoint",
  "rollback",
  "pre_apply",
  "initial",
]);
export type SceneRevisionChangeType = z.infer<typeof SceneRevisionChangeTypeEnum>;

// Workspace Settings
export const WorkspaceSettingsSchema = z.object({
  id: IdSchema.default("default"),
  defaultLocale: z.string().default("zh-CN"),
  theme: z.string().default("system"),
  activeProjectId: IdSchema.nullable().optional(),
  metadata: MetadataSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
export type WorkspaceSettings = z.infer<typeof WorkspaceSettingsSchema>;

// Project
export const ProjectSchema = z.object({
  id: IdSchema,
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  archived: z.boolean().default(false),
  pinned: z.boolean().default(false),
  metadata: MetadataSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
export type Project = z.infer<typeof ProjectSchema>;

export const ProjectSummarySchema = ProjectSchema.extend({
  manuscriptCount: z.number().int().default(0),
  sceneCount: z.number().int().default(0),
  unresolvedChangesCount: z.number().int().default(0),
  latestManuscriptTitle: z.string().nullable().optional(),
});
export type ProjectSummary = z.infer<typeof ProjectSummarySchema>;

export const CreateProjectSchema = z.object({
  id: IdSchema.optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  pinned: z.boolean().optional(),
  metadata: MetadataSchema.optional(),
});
export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;

export const UpdateProjectSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  archived: z.boolean().optional(),
  pinned: z.boolean().optional(),
  metadata: MetadataSchema.optional(),
});
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;

// Project Settings
export const ProjectSettingsSchema = z.object({
  id: IdSchema,
  projectId: IdSchema,
  locale: z.string().nullable().optional(),
  contextBudget: z.number().int().positive().nullable().optional(),
  tonePreferences: MetadataSchema,
  rules: z.array(z.unknown()).default([]),
  metadata: MetadataSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
export type ProjectSettings = z.infer<typeof ProjectSettingsSchema>;

// Manuscript
export const ManuscriptSchema = z.object({
  id: IdSchema,
  projectId: IdSchema,
  title: z.string().min(1),
  genre: ManuscriptGenreEnum.default("novel"),
  order: z.number().int().default(0),
  status: ManuscriptStatusEnum.default("active"),
  metadata: MetadataSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
export type Manuscript = z.infer<typeof ManuscriptSchema>;

export const CreateManuscriptSchema = z.object({
  id: IdSchema.optional(),
  projectId: IdSchema,
  title: z.string().min(1),
  genre: ManuscriptGenreEnum.optional(),
  order: z.number().int().optional(),
  status: ManuscriptStatusEnum.optional(),
  metadata: MetadataSchema.optional(),
});
export type CreateManuscriptInput = z.infer<typeof CreateManuscriptSchema>;

export const UpdateManuscriptSchema = z.object({
  title: z.string().min(1).optional(),
  genre: ManuscriptGenreEnum.optional(),
  order: z.number().int().optional(),
  status: ManuscriptStatusEnum.optional(),
  metadata: MetadataSchema.optional(),
});
export type UpdateManuscriptInput = z.infer<typeof UpdateManuscriptSchema>;

// Scene
export const SceneSchema = z.object({
  id: IdSchema,
  manuscriptId: IdSchema,
  projectId: IdSchema,
  title: z.string().min(1),
  order: z.number().int().default(0),
  content: z.string().default(""),
  pov: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  timeframe: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  characterCount: z.number().int().default(0),
  currentRevisionId: IdSchema.nullable().optional(),
  metadata: MetadataSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
export type Scene = z.infer<typeof SceneSchema>;

export const CreateSceneSchema = z.object({
  id: IdSchema.optional(),
  manuscriptId: IdSchema,
  projectId: IdSchema,
  title: z.string().min(1),
  order: z.number().int().optional(),
  content: z.string().optional(),
  pov: z.string().optional(),
  location: z.string().optional(),
  timeframe: z.string().optional(),
  summary: z.string().optional(),
  metadata: MetadataSchema.optional(),
});
export type CreateSceneInput = z.infer<typeof CreateSceneSchema>;

export const UpdateSceneSchema = z.object({
  title: z.string().min(1).optional(),
  order: z.number().int().optional(),
  content: z.string().optional(),
  pov: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  timeframe: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  characterCount: z.number().int().optional(),
  currentRevisionId: IdSchema.nullable().optional(),
  metadata: MetadataSchema.optional(),
});
export type UpdateSceneInput = z.infer<typeof UpdateSceneSchema>;

// Scene Revision
export const SceneRevisionSchema = z.object({
  id: IdSchema,
  sceneId: IdSchema,
  projectId: IdSchema,
  revisionNumber: z.number().int().positive(),
  changeType: SceneRevisionChangeTypeEnum,
  description: z.string(),
  content: z.string(),
  diffSummary: z.string().nullable().optional(),
  characterCount: z.number().int().default(0),
  rollbackSourceRevId: IdSchema.nullable().optional(),
  appliedChangeSetId: IdSchema.nullable().optional(),
  metadata: MetadataSchema,
  createdAt: TimestampSchema,
});
export type SceneRevision = z.infer<typeof SceneRevisionSchema>;

export const CreateSceneRevisionSchema = z.object({
  id: IdSchema.optional(),
  sceneId: IdSchema,
  projectId: IdSchema,
  revisionNumber: z.number().int().positive().optional(),
  changeType: SceneRevisionChangeTypeEnum,
  description: z.string(),
  content: z.string(),
  diffSummary: z.string().optional(),
  rollbackSourceRevId: IdSchema.optional(),
  appliedChangeSetId: IdSchema.optional(),
  metadata: MetadataSchema.optional(),
});
export type CreateSceneRevisionInput = z.infer<typeof CreateSceneRevisionSchema>;

