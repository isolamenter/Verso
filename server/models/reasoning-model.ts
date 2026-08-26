import type {
  AgentModelInput,
  AgentModelOutput,
  AgentModelStreamEvent,
} from "../../shared/schemas/model-capabilities";
import type { ModelRequestOptions, ReasoningModel } from "./types";
import type { OpenAICompatibleClient } from "./openai-client";

export class DefaultReasoningModel implements ReasoningModel {
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

  public async *stream(
    input: AgentModelInput,
    options?: ModelRequestOptions
  ): AsyncIterable<AgentModelStreamEvent> {
    yield* this.client.chatCompletionsStream(this.modelName, input, options);
  }
}

