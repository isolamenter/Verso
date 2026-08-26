import type {
  ImageInspectionInput,
  AudioInspectionInput,
  VideoInspectionInput,
  DocumentInspectionInput,
  MediaArtifact,
  AgentModelInput,
} from "../../shared/schemas/model-capabilities";
import type { MediaCapabilityModel, ModelRequestOptions } from "./types";
import { type OpenAICompatibleClient, VideoDirectUnavailableError } from "./openai-client";

export class DefaultMediaCapabilityModel implements MediaCapabilityModel {
  private client: OpenAICompatibleClient;
  private modelName: string;
  private nativeVideoSupported: boolean | null = null;

  constructor(
    client: OpenAICompatibleClient,
    modelName: string,
    initialVideoSupported?: boolean
  ) {
    this.client = client;
    this.modelName = modelName;
    if (typeof initialVideoSupported === "boolean") {
      this.nativeVideoSupported = initialVideoSupported;
    }
  }

  public setNativeVideoSupported(supported: boolean): void {
    this.nativeVideoSupported = supported;
  }

  public async supportsNativeVideo(): Promise<boolean> {
    if (this.nativeVideoSupported !== null) {
      return this.nativeVideoSupported;
    }
    return false;
  }

  public async inspectImage(
    input: ImageInspectionInput,
    options?: ModelRequestOptions
  ): Promise<MediaArtifact> {
    const modelInput: AgentModelInput = {
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: input.prompt,
            },
            {
              type: "image_url",
              image_url: {
                url: input.imageUrl,
                detail: input.detail ?? "auto",
              },
            },
          ],
        },
      ],
      temperature: options?.temperature ?? 0.2,
    };

    const response = await this.client.chatCompletions(this.modelName, modelInput, options);
    return {
      type: "description",
      content: response.text,
      metadata: {
        model: this.modelName,
        detail: input.detail ?? "auto",
      },
    };
  }

  public async inspectAudio(
    input: AudioInspectionInput,
    options?: ModelRequestOptions
  ): Promise<MediaArtifact> {
    const parts: any[] = [{ type: "text", text: input.prompt }];
    if (input.audioBase64) {
      parts.push({
        type: "input_audio",
        input_audio: {
          data: input.audioBase64,
          format: input.format,
        },
      });
    }

    const modelInput: AgentModelInput = {
      messages: [
        {
          role: "user",
          content: parts,
        },
      ],
      temperature: options?.temperature ?? 0.2,
    };

    const response = await this.client.chatCompletions(this.modelName, modelInput, options);
    return {
      type: "transcript",
      content: response.text,
      metadata: {
        model: this.modelName,
        format: input.format,
      },
    };
  }

  public async inspectVideo(
    input: VideoInspectionInput,
    options?: ModelRequestOptions
  ): Promise<MediaArtifact> {
    const supported = await this.supportsNativeVideo();
    if (!supported) {
      throw new VideoDirectUnavailableError(
        "Direct video understanding is disabled or not supported by endpoint. Use fallback audio/frame extraction."
      );
    }

    const promptText = input.clipStartMs !== undefined && input.clipEndMs !== undefined
      ? `${input.prompt}\n(Target clip range: ${input.clipStartMs}ms - ${input.clipEndMs}ms)`
      : input.prompt;

    const modelInput: AgentModelInput = {
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: promptText,
            },
            {
              type: "video_url",
              video_url: {
                url: input.videoUrl,
              },
            },
          ],
        },
      ],
      temperature: options?.temperature ?? 0.2,
    };

    try {
      const response = await this.client.chatCompletions(this.modelName, modelInput, options);
      return {
        type: "analysis",
        content: response.text,
        locator: input.clipStartMs !== undefined && input.clipEndMs !== undefined ? {
          type: "time_range",
          timeStartMs: input.clipStartMs,
          timeEndMs: input.clipEndMs,
        } : undefined,
        metadata: {
          model: this.modelName,
          nativeVideo: true,
        },
      };
    } catch (err: any) {
      // If endpoint returns 400/404/unsupported schema for video_url
      if (err.message && (err.message.includes("video_url") || err.message.includes("not supported") || err.statusCode === 400)) {
        this.nativeVideoSupported = false;
        throw new VideoDirectUnavailableError(err.message);
      }
      throw err;
    }
  }

  public async inspectDocument(
    input: DocumentInspectionInput,
    options?: ModelRequestOptions
  ): Promise<MediaArtifact> {
    const promptText = input.pageNumber !== undefined
      ? `[Document Page ${input.pageNumber}]\n${input.documentText}\n\nTask: ${input.prompt}`
      : `${input.documentText}\n\nTask: ${input.prompt}`;

    const modelInput: AgentModelInput = {
      messages: [
        {
          role: "user",
          content: promptText,
        },
      ],
      temperature: options?.temperature ?? 0.2,
    };

    const response = await this.client.chatCompletions(this.modelName, modelInput, options);
    return {
      type: "summary",
      content: response.text,
      locator: input.pageNumber !== undefined ? {
        type: "page_range",
        pageStart: input.pageNumber,
        pageEnd: input.pageNumber,
      } : undefined,
      metadata: {
        model: this.modelName,
        pageNumber: input.pageNumber,
      },
    };
  }
}

