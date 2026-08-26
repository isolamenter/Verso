import { env } from "../config/env";
import { OpenAICompatibleClient } from "./openai-client";
import { DefaultReasoningModel } from "./reasoning-model";
import { DefaultFastModel } from "./fast-model";
import { DefaultEmbeddingModel } from "./embedding-model";
import { DefaultMediaCapabilityModel } from "./media-model";
import { DefaultCapabilityProbeService } from "./capability-probe";
import type { OpenAIClientConfig } from "./types";

export * from "./types";
export * from "./openai-client";
export * from "./reasoning-model";
export * from "./fast-model";
export * from "./embedding-model";
export * from "./media-model";
export * from "./capability-probe";
export * from "./redact";

const clientConfig: OpenAIClientConfig = {
  baseUrl: env.VERSO_OPENAI_BASE_URL,
  apiKey: env.VERSO_OPENAI_API_KEY,
  defaultTimeoutMs: env.VERSO_REQUEST_TIMEOUT_MS,
  reasoningModel: env.VERSO_REASONING_MODEL,
  fastModel: env.VERSO_FAST_MODEL,
  mediaModel: env.VERSO_MEDIA_MODEL,
  embeddingModel: env.VERSO_EMBEDDING_MODEL,
};

export const modelClient = new OpenAICompatibleClient(clientConfig);
export const reasoningModel = new DefaultReasoningModel(modelClient, clientConfig.reasoningModel);
export const fastModel = new DefaultFastModel(modelClient, clientConfig.fastModel);
export const embeddingModel = new DefaultEmbeddingModel(modelClient, clientConfig.embeddingModel);
export const mediaModel = new DefaultMediaCapabilityModel(modelClient, clientConfig.mediaModel);
export const capabilityProbe = new DefaultCapabilityProbeService(modelClient, clientConfig);

