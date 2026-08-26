import { z } from "zod";
import { IdSchema } from "./common";

// 1. list_resources
export const ListResourcesInputSchema = z.object({
  type: z.enum(["all", "scene", "knowledge", "memory"]).default("all"),
  limit: z.number().int().min(1).max(100).default(50),
});
export type ListResourcesInput = z.infer<typeof ListResourcesInputSchema>;

export const ResourceSummaryItemSchema = z.object({
  id: IdSchema,
  type: z.enum(["scene", "knowledge", "memory", "manuscript"]),
  title: z.string(),
  characterCount: z.number().int().optional(),
  updatedAt: z.string(),
});
export type ResourceSummaryItem = z.infer<typeof ResourceSummaryItemSchema>;

// 2. read_resource
export const ReadResourceInputSchema = z.object({
  type: z.enum(["scene", "knowledge", "memory", "manuscript"]),
  id: IdSchema,
  maxLength: z.number().int().positive().max(50000).optional(),
});
export type ReadResourceInput = z.infer<typeof ReadResourceInputSchema>;

// 3. search_manuscript
export const SearchManuscriptInputSchema = z.object({
  query: z.string().min(1),
  manuscriptId: IdSchema.optional(),
  limit: z.number().int().min(1).max(20).default(10),
});
export type SearchManuscriptInput = z.infer<typeof SearchManuscriptInputSchema>;

export const ManuscriptSearchResultItemSchema = z.object({
  sceneId: IdSchema,
  sceneTitle: z.string(),
  manuscriptId: IdSchema,
  matchSnippet: z.string(),
  charOffset: z.number().int(),
});
export type ManuscriptSearchResultItem = z.infer<typeof ManuscriptSearchResultItemSchema>;

// 4. search_knowledge
export const SearchKnowledgeInputSchema = z.object({
  query: z.string().min(1),
  category: z.string().optional(),
  limit: z.number().int().min(1).max(20).default(10),
});
export type SearchKnowledgeInput = z.infer<typeof SearchKnowledgeInputSchema>;

export const KnowledgeSearchResultItemSchema = z.object({
  nodeId: IdSchema,
  title: z.string(),
  category: z.string(),
  matchSnippet: z.string(),
});
export type KnowledgeSearchResultItem = z.infer<typeof KnowledgeSearchResultItemSchema>;

// 5. read_knowledge_source
export const ReadKnowledgeSourceInputSchema = z.object({
  nodeId: IdSchema,
});
export type ReadKnowledgeSourceInput = z.infer<typeof ReadKnowledgeSourceInputSchema>;

// 6. inspect_media_segment
export const InspectMediaSegmentInputSchema = z.object({
  segmentId: IdSchema,
});
export type InspectMediaSegmentInput = z.infer<typeof InspectMediaSegmentInputSchema>;

// 7. get_revision
export const GetRevisionInputSchema = z.object({
  sceneId: IdSchema,
  revisionNumber: z.number().int().positive().optional(),
  revisionId: IdSchema.optional(),
});
export type GetRevisionInput = z.infer<typeof GetRevisionInputSchema>;

// 8. compare_revisions
export const CompareRevisionsInputSchema = z.object({
  sceneId: IdSchema,
  baseRevisionNumber: z.number().int().positive(),
  targetRevisionNumber: z.number().int().positive(),
});
export type CompareRevisionsInput = z.infer<typeof CompareRevisionsInputSchema>;

// 9. query_memory
export const QueryMemoryInputSchema = z.object({
  query: z.string().optional(),
  scope: z.enum(["all", "taste", "rules", "profile"]).default("all"),
  limit: z.number().int().min(1).max(20).default(10),
});
export type QueryMemoryInput = z.infer<typeof QueryMemoryInputSchema>;

