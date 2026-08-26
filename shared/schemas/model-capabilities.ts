import { z } from "zod";
import { MetadataSchema } from "./common";

export const ModelRoleEnum = z.enum(["reasoning", "fast", "embedding", "media"]);
export type ModelRole = z.infer<typeof ModelRoleEnum>;

export const ModelMessageRoleEnum = z.enum(["system", "user", "assistant", "tool"]);
export type ModelMessageRole = z.infer<typeof ModelMessageRoleEnum>;

export const ModelTextContentPartSchema = z.object({
  type: z.literal("text"),
  text: z.string(),
});
export type ModelTextContentPart = z.infer<typeof ModelTextContentPartSchema>;

export const ModelImageContentPartSchema = z.object({
  type: z.literal("image_url"),
  image_url: z.object({
    url: z.string(),
    detail: z.enum(["auto", "low", "high"]).optional(),
  }),
});
export type ModelImageContentPart = z.infer<typeof ModelImageContentPartSchema>;

export const ModelAudioContentPartSchema = z.object({
  type: z.literal("input_audio"),
  input_audio: z.object({
    data: z.string(),
    format: z.enum(["wav", "mp3"]),
  }),
});
export type ModelAudioContentPart = z.infer<typeof ModelAudioContentPartSchema>;

// Documented extension for direct video inspection on OpenAI-compatible endpoints
export const ModelVideoContentPartSchema = z.object({
  type: z.literal("video_url"),
  video_url: z.object({
    url: z.string(), // data:video/mp4;base64,... or asset URL
  }),
});
export type ModelVideoContentPart = z.infer<typeof ModelVideoContentPartSchema>;

export const ModelContentPartSchema = z.union([
  ModelTextContentPartSchema,
  ModelImageContentPartSchema,
  ModelAudioContentPartSchema,
  ModelVideoContentPartSchema,
]);
export type ModelContentPart = z.infer<typeof ModelContentPartSchema>;

export const ModelContentSchema = z.union([
  z.string(),
  z.array(ModelContentPartSchema),
]);
export type ModelContent = z.infer<typeof ModelContentSchema>;

export const ModelToolCallFunctionSchema = z.object({
  name: z.string(),
  arguments: z.string(),
});
export type ModelToolCallFunction = z.infer<typeof ModelToolCallFunctionSchema>;

export const ModelToolCallSchema = z.object({
  id: z.string(),
  type: z.literal("function").default("function"),
  function: ModelToolCallFunctionSchema,
});
export type ModelToolCall = z.infer<typeof ModelToolCallSchema>;

export const ModelMessageSchema = z.object({
  role: ModelMessageRoleEnum,
  content: ModelContentSchema.nullable().optional(),
  name: z.string().optional(),
  tool_call_id: z.string().optional(),
  tool_calls: z.array(ModelToolCallSchema).optional(),
});
export type ModelMessage = z.infer<typeof ModelMessageSchema>;

export const ModelToolDefinitionSchema = z.object({
  type: z.literal("function").default("function"),
  function: z.object({
    name: z.string(),
    description: z.string().optional(),
    parameters: z.record(z.string(), z.unknown()),
  }),
});
export type ModelToolDefinition = z.infer<typeof ModelToolDefinitionSchema>;

export const ResponseFormatSchema = z.object({
  type: z.enum(["text", "json_object", "json_schema"]),
  json_schema: z
    .object({
      name: z.string(),
      strict: z.boolean().optional(),
      schema: z.record(z.string(), z.unknown()),
    })
    .optional(),
});
export type ResponseFormat = z.infer<typeof ResponseFormatSchema>;

export const AgentModelInputSchema = z.object({
  messages: z.array(ModelMessageSchema),
  tools: z.array(ModelToolDefinitionSchema).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  responseFormat: ResponseFormatSchema.optional(),
  stop: z.array(z.string()).optional(),
});
export type AgentModelInput = z.infer<typeof AgentModelInputSchema>;

export const ModelUsageSchema = z.object({
  promptTokens: z.number().int().optional(),
  completionTokens: z.number().int().optional(),
  totalTokens: z.number().int().optional(),
});
export type ModelUsage = z.infer<typeof ModelUsageSchema>;

export const AgentModelOutputSchema = z.object({
  text: z.string().default(""),
  toolCalls: z.array(ModelToolCallSchema).optional(),
  structuredJson: z.unknown().optional(),
  usage: ModelUsageSchema.optional(),
  finishReason: z.string().optional(),
});
export type AgentModelOutput = z.infer<typeof AgentModelOutputSchema>;

// SSE Event Stream Types
export const AgentModelStreamEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("text_delta"),
    delta: z.string(),
  }),
  z.object({
    type: z.literal("thought_delta"),
    delta: z.string(),
  }),
  z.object({
    type: z.literal("tool_call_start"),
    index: z.number().int(),
    id: z.string(),
    name: z.string(),
  }),
  z.object({
    type: z.literal("tool_call_delta"),
    index: z.number().int(),
    argumentsDelta: z.string(),
  }),
  z.object({
    type: z.literal("tool_call_complete"),
    index: z.number().int(),
    toolCall: ModelToolCallSchema,
  }),
  z.object({
    type: z.literal("done"),
    finishReason: z.string().optional(),
    usage: ModelUsageSchema.optional(),
  }),
  z.object({
    type: z.literal("error"),
    error: z.string(),
  }),
]);
export type AgentModelStreamEvent = z.infer<typeof AgentModelStreamEventSchema>;

// Media Inspection Schemas
export const MediaLocatorSchema = z.object({
  type: z.enum(["page_range", "bounding_box", "time_range", "text_offset"]),
  pageStart: z.number().int().optional(),
  pageEnd: z.number().int().optional(),
  timeStartMs: z.number().int().optional(),
  timeEndMs: z.number().int().optional(),
  box: z
    .object({
      top: z.number(),
      left: z.number(),
      bottom: z.number(),
      right: z.number(),
    })
    .optional(),
  startOffset: z.number().int().optional(),
  endOffset: z.number().int().optional(),
});
export type MediaLocator = z.infer<typeof MediaLocatorSchema>;

export const MediaArtifactSchema = z.object({
  type: z.enum(["transcript", "description", "summary", "ocr_text", "analysis"]),
  content: z.string(),
  locator: MediaLocatorSchema.optional(),
  confidence: z.number().min(0).max(1).optional(),
  metadata: MetadataSchema.optional(),
});
export type MediaArtifact = z.infer<typeof MediaArtifactSchema>;

export const ImageInspectionInputSchema = z.object({
  imageUrl: z.string(), // data: URL or accessible URL
  prompt: z.string(),
  detail: z.enum(["auto", "low", "high"]).optional(),
});
export type ImageInspectionInput = z.infer<typeof ImageInspectionInputSchema>;

export const AudioInspectionInputSchema = z.object({
  audioBase64: z.string().optional(),
  audioUrl: z.string().optional(),
  format: z.enum(["wav", "mp3"]).default("mp3"),
  prompt: z.string(),
});
export type AudioInspectionInput = z.infer<typeof AudioInspectionInputSchema>;

export const VideoInspectionInputSchema = z.object({
  videoUrl: z.string(), // data:video/mp4;base64,... or stream URL
  prompt: z.string(),
  clipStartMs: z.number().int().optional(),
  clipEndMs: z.number().int().optional(),
});
export type VideoInspectionInput = z.infer<typeof VideoInspectionInputSchema>;

export const DocumentInspectionInputSchema = z.object({
  documentText: z.string(),
  prompt: z.string(),
  pageNumber: z.number().int().optional(),
});
export type DocumentInspectionInput = z.infer<typeof DocumentInspectionInputSchema>;

// Capability Probing and Status
export const RoleCapabilityStatusSchema = z.object({
  configuredModel: z.string(),
  available: z.boolean(),
  error: z.string().optional(),
  latencyMs: z.number().int().optional(),
});
export type RoleCapabilityStatus = z.infer<typeof RoleCapabilityStatusSchema>;

export const ModelCapabilityHealthSchema = z.object({
  available: z.boolean(),
  baseUrl: z.string(),
  roles: z.record(ModelRoleEnum, RoleCapabilityStatusSchema),
  capabilities: z.object({
    textStreaming: z.boolean(),
    toolCalling: z.boolean(),
    structuredOutputs: z.boolean(),
    imageInspection: z.boolean(),
    audioInspection: z.boolean(),
    videoDirect: z.boolean(),
    embeddings: z.boolean(),
  }),
  checkedAt: z.string(),
  videoExtension: z.enum(["video_url", "none"]),
});
export type ModelCapabilityHealth = z.infer<typeof ModelCapabilityHealthSchema>;
