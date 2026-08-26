import type {
  ModelCapabilityHealth,
  RoleCapabilityStatus,
} from "../../shared/schemas/model-capabilities";
import type { CapabilityProbeService, OpenAIClientConfig } from "./types";
import { OpenAICompatibleClient } from "./openai-client";
import { redactSecrets } from "./redact";

export class DefaultCapabilityProbeService implements CapabilityProbeService {
  private client: OpenAICompatibleClient;
  private config: OpenAIClientConfig;
  private cachedHealth: ModelCapabilityHealth | null = null;
  private lastProbeTime = 0;
  private probeTtlMs = 60000; // 1 minute cache TTL

  constructor(client: OpenAICompatibleClient, config: OpenAIClientConfig) {
    this.client = client;
    this.config = config;
  }

  public getCachedCapabilities(): ModelCapabilityHealth | null {
    return this.cachedHealth;
  }

  public async probeCapabilities(forceRefresh = false): Promise<ModelCapabilityHealth> {
    const now = Date.now();
    if (!forceRefresh && this.cachedHealth && now - this.lastProbeTime < this.probeTtlMs) {
      return this.cachedHealth;
    }

    const roles: Record<string, RoleCapabilityStatus> = {};
    let allAvailable = true;

    // 1. Probe Reasoning Role
    const reasoningStart = Date.now();
    try {
      await this.client.chatCompletions(
        this.config.reasoningModel,
        {
          messages: [{ role: "user", content: "ping" }],
          maxTokens: 5,
        },
        { timeoutMs: 5000 }
      );
      roles.reasoning = {
        configuredModel: this.config.reasoningModel,
        available: true,
        latencyMs: Date.now() - reasoningStart,
      };
    } catch (err: any) {
      allAvailable = false;
      roles.reasoning = {
        configuredModel: this.config.reasoningModel,
        available: false,
        error: redactSecrets(err.message || String(err)),
        latencyMs: Date.now() - reasoningStart,
      };
    }

    // 2. Probe Fast Role
    const fastStart = Date.now();
    try {
      await this.client.chatCompletions(
        this.config.fastModel,
        {
          messages: [{ role: "user", content: "ping" }],
          maxTokens: 5,
        },
        { timeoutMs: 5000 }
      );
      roles.fast = {
        configuredModel: this.config.fastModel,
        available: true,
        latencyMs: Date.now() - fastStart,
      };
    } catch (err: any) {
      allAvailable = false;
      roles.fast = {
        configuredModel: this.config.fastModel,
        available: false,
        error: redactSecrets(err.message || String(err)),
        latencyMs: Date.now() - fastStart,
      };
    }

    // 3. Probe Embedding Role
    const embedStart = Date.now();
    let embeddingsAvailable = false;
    try {
      await this.client.createEmbeddings(
        this.config.embeddingModel,
        ["test"],
        { timeoutMs: 5000 }
      );
      embeddingsAvailable = true;
      roles.embedding = {
        configuredModel: this.config.embeddingModel,
        available: true,
        latencyMs: Date.now() - embedStart,
      };
    } catch (err: any) {
      allAvailable = false;
      roles.embedding = {
        configuredModel: this.config.embeddingModel,
        available: false,
        error: redactSecrets(err.message || String(err)),
        latencyMs: Date.now() - embedStart,
      };
    }

    // 4. Probe Media Role
    const mediaStart = Date.now();
    try {
      await this.client.chatCompletions(
        this.config.mediaModel,
        {
          messages: [{ role: "user", content: "ping" }],
          maxTokens: 5,
        },
        { timeoutMs: 5000 }
      );
      roles.media = {
        configuredModel: this.config.mediaModel,
        available: true,
        latencyMs: Date.now() - mediaStart,
      };
    } catch (err: any) {
      allAvailable = false;
      roles.media = {
        configuredModel: this.config.mediaModel,
        available: false,
        error: redactSecrets(err.message || String(err)),
        latencyMs: Date.now() - mediaStart,
      };
    }

    // 5. Check Direct Video Extension support
    let videoDirect = false;
    let videoExtension: "video_url" | "none" = "none";
    try {
      // Test video_url content part with 1x1 transparent dummy video base64
      await this.client.chatCompletions(
        this.config.mediaModel,
        {
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: "ping" },
                {
                  type: "video_url",
                  video_url: {
                    url: "data:video/mp4;base64,AAAAHGZ0eXBtcDQyAAAAAG1wNDJpc29tYXZjMQAAAA==",
                  },
                },
              ],
            },
          ],
          maxTokens: 5,
        },
        { timeoutMs: 5000 }
      );
      videoDirect = true;
      videoExtension = "video_url";
    } catch {
      // Not supported by endpoint
      videoDirect = false;
      videoExtension = "none";
    }

    const health: ModelCapabilityHealth = {
      available: allAvailable,
      baseUrl: redactSecrets(this.config.baseUrl),
      roles: {
        reasoning: roles.reasoning!,
        fast: roles.fast!,
        embedding: roles.embedding!,
        media: roles.media!,
      },
      capabilities: {
        textStreaming: roles.reasoning?.available ?? false,
        toolCalling: roles.reasoning?.available ?? false,
        structuredOutputs: roles.fast?.available ?? false,
        imageInspection: roles.media?.available ?? false,
        audioInspection: roles.media?.available ?? false,
        videoDirect,
        embeddings: embeddingsAvailable,
      },
      checkedAt: new Date().toISOString(),
      videoExtension,
    };

    this.cachedHealth = health;
    this.lastProbeTime = now;

    return health;
  }
}

