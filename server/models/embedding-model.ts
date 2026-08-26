import type { EmbeddingModel, ModelRequestOptions } from "./types";
import type { OpenAICompatibleClient } from "./openai-client";

export class DefaultEmbeddingModel implements EmbeddingModel {
  private client: OpenAICompatibleClient;
  private modelName: string;

  constructor(client: OpenAICompatibleClient, modelName: string) {
    this.client = client;
    this.modelName = modelName;
  }

  public async embedDocuments(
    texts: string[],
    options?: ModelRequestOptions
  ): Promise<number[][]> {
    if (!texts || texts.length === 0) return [];
    return this.client.createEmbeddings(this.modelName, texts, options);
  }

  public async embedQuery(
    text: string,
    options?: ModelRequestOptions
  ): Promise<number[]> {
    const results = await this.client.createEmbeddings(this.modelName, [text], options);
    if (!results[0]) {
      throw new Error("No embedding returned for query");
    }
    return results[0];
  }
}

