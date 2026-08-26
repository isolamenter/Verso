import { z } from "zod";
import type {
  AgentModelInput,
  AgentModelOutput,
} from "../../shared/schemas/model-capabilities";
import type { FastModel, ModelRequestOptions } from "./types";
import { type OpenAICompatibleClient, ModelStructuredOutputError } from "./openai-client";

export class DefaultFastModel implements FastModel {
  private client: OpenAICompatibleClient;
  private modelName: string;

  constructor(client: OpenAICompatibleClient, modelName: string) {
    this.client = client;
    this.modelName = modelName;
  }

  public async respond(
    input: AgentModelInput,
    options?: ModelRequestOptions
  ): Promise<AgentModelOutput> {
    return this.client.chatCompletions(this.modelName, input, options);
  }

  public async classify<T>(
    input: {
      prompt: string;
      schema: z.ZodType<T>;
      systemPrompt?: string;
      schemaName?: string;
    },
    options?: ModelRequestOptions
  ): Promise<T> {
    const systemMessage = input.systemPrompt ?? "You are a precise classifier and structured data extractor. Return only valid JSON.";
    
    const messages = [
      { role: "system" as const, content: systemMessage },
      { role: "user" as const, content: input.prompt },
    ];

    const modelInput: AgentModelInput = {
      messages,
      responseFormat: {
        type: "json_object",
      },
      temperature: options?.temperature ?? 0,
    };

    const response = await this.client.chatCompletions(this.modelName, modelInput, options);
    const rawText = response.text.trim();

    // Extract JSON block if wrapped in markdown code fence
    let jsonString = rawText;
    const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonString = jsonMatch[1].trim();
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(jsonString);
    } catch (parseErr: any) {
      throw new ModelStructuredOutputError(
        `Failed to parse JSON response: ${parseErr.message}`,
        rawText,
        parseErr
      );
    }

    const validationResult = input.schema.safeParse(parsedJson);
    if (!validationResult.success) {
      throw new ModelStructuredOutputError(
        `Output schema validation failed: ${validationResult.error.message}`,
        rawText,
        validationResult.error
      );
    }

    return validationResult.data;
  }
}

