import { z } from "zod";
import type {
  AgentModelInput,
  AgentModelOutput,
  AgentModelStreamEvent,
  ImageInspectionInput,
  AudioInspectionInput,
  VideoInspectionInput,
  DocumentInspectionInput,
  MediaArtifact,
  ModelCapabilityHealth,
} from "../../shared/schemas/model-capabilities";

export interface ModelRequestOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  maxTokens?: number;
  temperature?: number;
}

export interface ReasoningModel {
  respond(input: AgentModelInput, options?: ModelRequestOptions): Promise<AgentModelOutput>;
  stream(input: AgentModelInput, options?: ModelRequestOptions): AsyncIterable<AgentModelStreamEvent>;
}

export interface FastModel {
  respond(input: AgentModelInput, options?: ModelRequestOptions): Promise<AgentModelOutput>;
  classify<T>(input: {
    prompt: string;
    schema: z.ZodType<T>;
    systemPrompt?: string;
    schemaName?: string;
  }, options?: ModelRequestOptions): Promise<T>;
}

export interface EmbeddingModel {
  embedDocuments(texts: string[], options?: ModelRequestOptions): Promise<number[][]>;
  embedQuery(text: string, options?: ModelRequestOptions): Promise<number[]>;
}

export interface MediaCapabilityModel {
  inspectImage(input: ImageInspectionInput, options?: ModelRequestOptions): Promise<MediaArtifact>;
  inspectAudio(input: AudioInspectionInput, options?: ModelRequestOptions): Promise<MediaArtifact>;
  inspectVideo(input: VideoInspectionInput, options?: ModelRequestOptions): Promise<MediaArtifact>;
  inspectDocument(input: DocumentInspectionInput, options?: ModelRequestOptions): Promise<MediaArtifact>;
  supportsNativeVideo(): Promise<boolean>;
}

export interface CapabilityProbeService {
  probeCapabilities(forceRefresh?: boolean): Promise<ModelCapabilityHealth>;
  getCachedCapabilities(): ModelCapabilityHealth | null;
}

export interface OpenAIClientConfig {
  baseUrl: string;
  apiKey: string;
  defaultTimeoutMs: number;
  reasoningModel: string;
  fastModel: string;
  mediaModel: string;
  embeddingModel: string;
}
