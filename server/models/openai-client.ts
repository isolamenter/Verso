import type {
  AgentModelInput,
  AgentModelOutput,
  AgentModelStreamEvent,
} from "../../shared/schemas/model-capabilities";
import type { ModelRequestOptions, OpenAIClientConfig } from "./types";
import { redactSecrets } from "./redact";

export class ModelError extends Error {
  public statusCode?: number;
  public details?: unknown;

  constructor(message: string, statusCode?: number, details?: unknown) {
    super(redactSecrets(message));
    this.name = "ModelError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class ModelTimeoutError extends ModelError {
  constructor(timeoutMs: number) {
    super(`Model request timed out after ${timeoutMs}ms`);
    this.name = "ModelTimeoutError";
  }
}

export class ModelCancellationError extends ModelError {
  constructor() {
    super("Model request was cancelled by client");
    this.name = "ModelCancellationError";
  }
}

export class ModelStructuredOutputError extends ModelError {
  public rawOutput: string;
  public parseError?: unknown;

  constructor(message: string, rawOutput: string, parseError?: unknown) {
    super(`Model returned invalid structured output: ${message}`);
    this.name = "ModelStructuredOutputError";
    this.rawOutput = rawOutput;
    this.parseError = parseError;
  }
}

export class ModelUnavailableError extends ModelError {
  constructor(role: string, modelName: string, reason?: string) {
    super(`Model role '${role}' (${modelName}) is unavailable${reason ? `: ${reason}` : ""}`);
    this.name = "ModelUnavailableError";
  }
}

export class VideoDirectUnavailableError extends ModelError {
  constructor(reason?: string) {
    super(`Native video understanding is not supported by the configured endpoint${reason ? `: ${reason}` : ""}`);
    this.name = "VideoDirectUnavailableError";
  }
}

export class OpenAICompatibleClient {
  private config: OpenAIClientConfig;

  constructor(config: OpenAIClientConfig) {
    this.config = {
      ...config,
      baseUrl: config.baseUrl.replace(/\/+$/, ""), // strip trailing slash
    };
  }

  public getConfig(): Readonly<OpenAIClientConfig> {
    return this.config;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (this.config.apiKey) {
      headers["Authorization"] = `Bearer ${this.config.apiKey}`;
    }
    return headers;
  }

  private createAbortSignal(options?: ModelRequestOptions): {
    signal: AbortSignal;
    cleanup: () => void;
    timedOut: { value: boolean };
  } {
    const timeoutMs = options?.timeoutMs ?? this.config.defaultTimeoutMs;
    const controller = new AbortController();
    const timedOut = { value: false };

    let timer: NodeJS.Timeout | null = null;
    if (timeoutMs > 0 && timeoutMs !== Infinity) {
      timer = setTimeout(() => {
        timedOut.value = true;
        controller.abort(new ModelTimeoutError(timeoutMs));
      }, timeoutMs);
    }

    const onCallerAbort = () => {
      controller.abort(new ModelCancellationError());
    };

    if (options?.signal) {
      if (options.signal.aborted) {
        controller.abort(new ModelCancellationError());
      } else {
        options.signal.addEventListener("abort", onCallerAbort);
      }
    }

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      if (options?.signal) {
        options.signal.removeEventListener("abort", onCallerAbort);
      }
    };

    return { signal: controller.signal, cleanup, timedOut };
  }

  public async chatCompletions(
    model: string,
    input: AgentModelInput,
    options?: ModelRequestOptions
  ): Promise<AgentModelOutput> {
    const { signal, cleanup, timedOut } = this.createAbortSignal(options);

    try {
      const url = `${this.config.baseUrl}/chat/completions`;
      const body: Record<string, unknown> = {
        model,
        messages: input.messages,
      };

      if (input.tools && input.tools.length > 0) {
        body.tools = input.tools;
      }
      if (typeof options?.temperature === "number" || typeof input.temperature === "number") {
        body.temperature = options?.temperature ?? input.temperature;
      }
      if (typeof options?.maxTokens === "number" || typeof input.maxTokens === "number") {
        body.max_tokens = options?.maxTokens ?? input.maxTokens;
      }
      if (input.responseFormat) {
        body.response_format = input.responseFormat;
      }
      if (input.stop) {
        body.stop = input.stop;
      }

      const response = await fetch(url, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(body),
        signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new ModelError(
          `OpenAI API error (${response.status} ${response.statusText}): ${errorText}`,
          response.status
        );
      }

      const json = (await response.json()) as any;
      const choice = json.choices?.[0];
      const message = choice?.message;

      const output: AgentModelOutput = {
        text: message?.content ?? "",
        finishReason: choice?.finish_reason,
      };

      if (message?.tool_calls && Array.isArray(message.tool_calls)) {
        output.toolCalls = message.tool_calls.map((tc: any) => ({
          id: tc.id || "",
          type: "function" as const,
          function: {
            name: tc.function?.name || "",
            arguments: tc.function?.arguments || "",
          },
        }));
      }

      if (json.usage) {
        output.usage = {
          promptTokens: json.usage.prompt_tokens,
          completionTokens: json.usage.completion_tokens,
          totalTokens: json.usage.total_tokens,
        };
      }

      return output;
    } catch (err: any) {
      if (timedOut.value || err.name === "ModelTimeoutError") {
        throw new ModelTimeoutError(options?.timeoutMs ?? this.config.defaultTimeoutMs);
      }
      if (err.name === "AbortError" || err.name === "ModelCancellationError") {
        throw new ModelCancellationError();
      }
      if (err instanceof ModelError) {
        throw err;
      }
      throw new ModelError(err.message || String(err));
    } finally {
      cleanup();
    }
  }

  public async *chatCompletionsStream(
    model: string,
    input: AgentModelInput,
    options?: ModelRequestOptions
  ): AsyncIterable<AgentModelStreamEvent> {
    const { signal, cleanup, timedOut } = this.createAbortSignal(options);

    try {
      const url = `${this.config.baseUrl}/chat/completions`;
      const body: Record<string, unknown> = {
        model,
        messages: input.messages,
        stream: true,
      };

      if (input.tools && input.tools.length > 0) {
        body.tools = input.tools;
      }
      if (typeof options?.temperature === "number" || typeof input.temperature === "number") {
        body.temperature = options?.temperature ?? input.temperature;
      }
      if (typeof options?.maxTokens === "number" || typeof input.maxTokens === "number") {
        body.max_tokens = options?.maxTokens ?? input.maxTokens;
      }
      if (input.responseFormat) {
        body.response_format = input.responseFormat;
      }
      if (input.stop) {
        body.stop = input.stop;
      }

      const response = await fetch(url, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(body),
        signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new ModelError(
          `OpenAI API stream error (${response.status} ${response.statusText}): ${errorText}`,
          response.status
        );
      }

      if (!response.body) {
        throw new ModelError("No response body received for streaming response");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      // Track active in-flight tool calls across stream chunks
      const activeToolCalls: Map<number, { id: string; name: string; arguments: string }> = new Map();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith(":")) continue; // heartbeat / comment

            if (trimmed.startsWith("data:")) {
              const dataStr = trimmed.slice(5).trim();
              if (dataStr === "[DONE]") {
                // Emit completed tool calls if any are pending
                for (const [index, tc] of activeToolCalls.entries()) {
                  yield {
                    type: "tool_call_complete",
                    index,
                    toolCall: {
                      id: tc.id,
                      type: "function",
                      function: {
                        name: tc.name,
                        arguments: tc.arguments,
                      },
                    },
                  };
                }
                activeToolCalls.clear();

                yield {
                  type: "done",
                  finishReason: "stop",
                };
                return;
              }

              try {
                const parsed = JSON.parse(dataStr);
                const choice = parsed.choices?.[0];
                const delta = choice?.delta;

                // Reasoning / Thought delta (e.g. DeepSeek-R1 / OpenAI reasoning tokens)
                if (delta?.reasoning_content || delta?.thought) {
                  yield {
                    type: "thought_delta",
                    delta: delta.reasoning_content || delta.thought,
                  };
                }

                // Text content delta
                if (delta?.content) {
                  yield {
                    type: "text_delta",
                    delta: delta.content,
                  };
                }

                // Tool calls delta
                if (delta?.tool_calls && Array.isArray(delta.tool_calls)) {
                  for (const tcDelta of delta.tool_calls) {
                    const idx = tcDelta.index ?? 0;
                    if (!activeToolCalls.has(idx)) {
                      const id = tcDelta.id || `call_${idx}_${Date.now()}`;
                      const name = tcDelta.function?.name || "";
                      activeToolCalls.set(idx, {
                        id,
                        name,
                        arguments: tcDelta.function?.arguments || "",
                      });
                      yield {
                        type: "tool_call_start",
                        index: idx,
                        id,
                        name,
                      };
                    } else {
                      const current = activeToolCalls.get(idx)!;
                      if (tcDelta.function?.arguments) {
                        current.arguments += tcDelta.function.arguments;
                        yield {
                          type: "tool_call_delta",
                          index: idx,
                          argumentsDelta: tcDelta.function.arguments,
                        };
                      }
                    }
                  }
                }

                // Check finish reason
                if (choice?.finish_reason) {
                  for (const [index, tc] of activeToolCalls.entries()) {
                    yield {
                      type: "tool_call_complete",
                      index,
                      toolCall: {
                        id: tc.id,
                        type: "function",
                        function: {
                          name: tc.name,
                          arguments: tc.arguments,
                        },
                      },
                    };
                  }
                  activeToolCalls.clear();

                  yield {
                    type: "done",
                    finishReason: choice.finish_reason,
                    usage: parsed.usage ? {
                      promptTokens: parsed.usage.prompt_tokens,
                      completionTokens: parsed.usage.completion_tokens,
                      totalTokens: parsed.usage.total_tokens,
                    } : undefined,
                  };
                }
              } catch (parseErr) {
                // Ignore chunk json parse errors on malformed non-JSON data lines
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (err: any) {
      if (timedOut.value || err.name === "ModelTimeoutError") {
        throw new ModelTimeoutError(options?.timeoutMs ?? this.config.defaultTimeoutMs);
      }
      if (err.name === "AbortError" || err.name === "ModelCancellationError") {
        throw new ModelCancellationError();
      }
      if (err instanceof ModelError) {
        throw err;
      }
      throw new ModelError(err.message || String(err));
    } finally {
      cleanup();
    }
  }

  public async createEmbeddings(
    model: string,
    texts: string[],
    options?: ModelRequestOptions
  ): Promise<number[][]> {
    if (!texts || texts.length === 0) return [];
    const { signal, cleanup, timedOut } = this.createAbortSignal(options);

    try {
      const url = `${this.config.baseUrl}/embeddings`;
      const response = await fetch(url, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({
          model,
          input: texts,
        }),
        signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new ModelError(
          `OpenAI Embeddings API error (${response.status} ${response.statusText}): ${errorText}`,
          response.status
        );
      }

      const json = (await response.json()) as any;
      if (!json.data || !Array.isArray(json.data)) {
        throw new ModelError("Invalid embeddings response structure: missing data array");
      }

      // Sort embeddings by index to preserve exact order
      const sorted = [...json.data].sort((a: any, b: any) => (a.index ?? 0) - (b.index ?? 0));
      return sorted.map((item: any) => item.embedding);
    } catch (err: any) {
      if (timedOut.value || err.name === "ModelTimeoutError") {
        throw new ModelTimeoutError(options?.timeoutMs ?? this.config.defaultTimeoutMs);
      }
      if (err.name === "AbortError" || err.name === "ModelCancellationError") {
        throw new ModelCancellationError();
      }
      if (err instanceof ModelError) {
        throw err;
      }
      throw new ModelError(err.message || String(err));
    } finally {
      cleanup();
    }
  }
}
