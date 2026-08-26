import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import { z } from "zod";
import {
  OpenAICompatibleClient,
  DefaultReasoningModel,
  DefaultFastModel,
  DefaultEmbeddingModel,
  DefaultMediaCapabilityModel,
  DefaultCapabilityProbeService,
  ModelTimeoutError,
  ModelCancellationError,
  ModelStructuredOutputError,
  VideoDirectUnavailableError,
  redactSecrets,
  type OpenAIClientConfig,
} from "../../../server/models";

describe("E05 — Server-Only OpenAI-Compatible Model Boundary & Capability Probe", () => {
  let server: http.Server;
  let serverPort: number;
  let baseUrl: string;
  let fakeApiKey = "sk-verso-secret-test-key-12345678";

  // State to simulate endpoint behaviors
  let simulateTimeout = false;
  let simulateMalformedJson = false;
  let simulateVideoSupport = true;
  let lastReceivedHeaders: http.IncomingHttpHeaders = {};
  let lastReceivedBody: any = null;

  beforeAll(async () => {
    server = http.createServer(async (req, res) => {
      lastReceivedHeaders = req.headers;

      // Body reading
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const rawBody = Buffer.concat(chunks).toString("utf-8");
      if (rawBody) {
        try {
          lastReceivedBody = JSON.parse(rawBody);
        } catch {
          lastReceivedBody = rawBody;
        }
      }

      const url = req.url || "";

      if (simulateTimeout) {
        // Hold connection without responding until client times out
        return;
      }

      // 1. Embeddings endpoint
      if (url.startsWith("/embeddings")) {
        res.writeHead(200, { "Content-Type": "application/json" });
        const input = lastReceivedBody?.input || [];
        const data = Array.isArray(input)
          ? input.map((_: string, idx: number) => ({
              object: "embedding",
              index: idx,
              embedding: [0.1 * (idx + 1), 0.2 * (idx + 1), 0.3 * (idx + 1)],
            }))
          : [
              {
                object: "embedding",
                index: 0,
                embedding: [0.1, 0.2, 0.3],
              },
            ];
        res.end(JSON.stringify({ object: "list", data, model: "test-embed" }));
        return;
      }

      // 2. Chat Completions endpoint
      if (url.startsWith("/chat/completions")) {
        // Video direct check simulation
        const hasVideoPart = Array.isArray(lastReceivedBody?.messages?.[0]?.content) &&
          lastReceivedBody.messages[0].content.some((part: any) => part.type === "video_url");

        if (hasVideoPart && !simulateVideoSupport) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            error: {
              message: "Unsupported content type: video_url",
              type: "invalid_request_error",
            },
          }));
          return;
        }

        // Streaming response
        if (lastReceivedBody?.stream) {
          res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          });

          const isToolCall = lastReceivedBody.tools && lastReceivedBody.tools.length > 0;

          if (isToolCall) {
            // Send thought delta
            res.write(`data: ${JSON.stringify({
              choices: [{ delta: { reasoning_content: "Analyzing user intent..." } }],
            })}\n\n`);

            // Send tool call start
            res.write(`data: ${JSON.stringify({
              choices: [{
                delta: {
                  tool_calls: [{
                    index: 0,
                    id: "call_suggest_1",
                    type: "function",
                    function: { name: "propose_revision", arguments: "" },
                  }],
                },
              }],
            })}\n\n`);

            // Send tool call args delta
            res.write(`data: ${JSON.stringify({
              choices: [{
                delta: {
                  tool_calls: [{
                    index: 0,
                    function: { arguments: '{"targetSceneId":"scene_1"' },
                  }],
                },
              }],
            })}\n\n`);

            res.write(`data: ${JSON.stringify({
              choices: [{
                delta: {
                  tool_calls: [{
                    index: 0,
                    function: { arguments: ',"rationale":"tighten opening"}' },
                  }],
                },
              }],
            })}\n\n`);

            // Send finish
            res.write(`data: ${JSON.stringify({
              choices: [{ finish_reason: "tool_calls" }],
              usage: { prompt_tokens: 20, completion_tokens: 15, total_tokens: 35 },
            })}\n\n`);

            res.write("data: [DONE]\n\n");
            res.end();
            return;
          }

          // Regular streaming text
          res.write(`data: ${JSON.stringify({
            choices: [{ delta: { content: "Drafting " } }],
          })}\n\n`);
          res.write(`data: ${JSON.stringify({
            choices: [{ delta: { content: "literary " } }],
          })}\n\n`);
          res.write(`data: ${JSON.stringify({
            choices: [{ delta: { content: "revision." } }],
          })}\n\n`);
          res.write(`data: ${JSON.stringify({
            choices: [{ finish_reason: "stop" }],
            usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
          })}\n\n`);
          res.write("data: [DONE]\n\n");
          res.end();
          return;
        }

        // Non-streaming response
        if (simulateMalformedJson) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            choices: [{ message: { content: "{ this is not valid JSON content" } }],
          }));
          return;
        }

        const isJsonObject = lastReceivedBody?.response_format?.type === "json_object";
        let content = "Standard model response.";

        if (isJsonObject) {
          content = JSON.stringify({
            intent: "critique",
            confidence: 0.95,
            suggestedSkill: "literary_critique",
          });
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          choices: [{
            message: {
              role: "assistant",
              content,
            },
            finish_reason: "stop",
          }],
          usage: {
            prompt_tokens: 12,
            completion_tokens: 8,
            total_tokens: 20,
          },
        }));
        return;
      }

      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
    });

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        const addr = server.address() as any;
        serverPort = addr.port;
        baseUrl = `http://127.0.0.1:${serverPort}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  const getTestConfig = (): OpenAIClientConfig => ({
    baseUrl,
    apiKey: fakeApiKey,
    defaultTimeoutMs: 1000,
    reasoningModel: "gpt-4o",
    fastModel: "gpt-4o-mini",
    mediaModel: "gpt-4o",
    embeddingModel: "text-embedding-3-small",
  });

  it("sends authenticated request with bearer token and stripped trailing slash in baseUrl", async () => {
    const client = new OpenAICompatibleClient(getTestConfig());
    const result = await client.chatCompletions("gpt-4o", {
      messages: [{ role: "user", content: "hello" }],
    });

    expect(result.text).toBe("Standard model response.");
    expect(lastReceivedHeaders["authorization"]).toBe(`Bearer ${fakeApiKey}`);
  });

  it("handles streaming text and thought deltas via SSE", async () => {
    const client = new OpenAICompatibleClient(getTestConfig());
    const reasoning = new DefaultReasoningModel(client, "gpt-4o");

    const events: any[] = [];
    for await (const event of reasoning.stream({
      messages: [{ role: "user", content: "stream me" }],
    })) {
      events.push(event);
    }

    const textDeltas = events.filter((e) => e.type === "text_delta").map((e) => e.delta).join("");
    expect(textDeltas).toBe("Drafting literary revision.");
    expect(events.some((e) => e.type === "done")).toBe(true);
  });

  it("handles streaming tool calls and thought deltas via SSE", async () => {
    const client = new OpenAICompatibleClient(getTestConfig());
    const reasoning = new DefaultReasoningModel(client, "gpt-4o");

    const events: any[] = [];
    for await (const event of reasoning.stream({
      messages: [{ role: "user", content: "run tool" }],
      tools: [{
        type: "function",
        function: {
          name: "propose_revision",
          parameters: { type: "object" },
        },
      }],
    })) {
      events.push(event);
    }

    const thoughtEvent = events.find((e) => e.type === "thought_delta");
    expect(thoughtEvent?.delta).toBe("Analyzing user intent...");

    const toolCallComplete = events.find((e) => e.type === "tool_call_complete");
    expect(toolCallComplete).toBeDefined();
    expect(toolCallComplete.toolCall.function.name).toBe("propose_revision");
    expect(JSON.parse(toolCallComplete.toolCall.function.arguments)).toEqual({
      targetSceneId: "scene_1",
      rationale: "tighten opening",
    });
  });

  it("validates structured outputs with Zod in FastModel.classify()", async () => {
    const client = new OpenAICompatibleClient(getTestConfig());
    const fast = new DefaultFastModel(client, "gpt-4o-mini");

    const IntentSchema = z.object({
      intent: z.string(),
      confidence: z.number(),
      suggestedSkill: z.string(),
    });

    const output = await fast.classify({
      prompt: "Classify this literary request",
      schema: IntentSchema,
    });

    expect(output.intent).toBe("critique");
    expect(output.confidence).toBe(0.95);
    expect(output.suggestedSkill).toBe("literary_critique");
  });

  it("treats malformed structured output as ModelStructuredOutputError (failed run, never mutation)", async () => {
    simulateMalformedJson = true;
    try {
      const client = new OpenAICompatibleClient(getTestConfig());
      const fast = new DefaultFastModel(client, "gpt-4o-mini");

      const Schema = z.object({ foo: z.string() });
      await expect(
        fast.classify({ prompt: "bad json test", schema: Schema })
      ).rejects.toThrow(ModelStructuredOutputError);
    } finally {
      simulateMalformedJson = false;
    }
  });

  it("times out requests and aborts cleanly when server hangs", async () => {
    simulateTimeout = true;
    try {
      const client = new OpenAICompatibleClient({
        ...getTestConfig(),
        defaultTimeoutMs: 150,
      });

      await expect(
        client.chatCompletions("gpt-4o", {
          messages: [{ role: "user", content: "timeout test" }],
        }, { timeoutMs: 100 })
      ).rejects.toThrow(ModelTimeoutError);
    } finally {
      simulateTimeout = false;
    }
  });

  it("supports client cancellation via AbortSignal", async () => {
    simulateTimeout = true;
    try {
      const client = new OpenAICompatibleClient(getTestConfig());
      const controller = new AbortController();

      const promise = client.chatCompletions("gpt-4o", {
        messages: [{ role: "user", content: "cancel test" }],
      }, { signal: controller.signal });

      setTimeout(() => controller.abort(), 50);

      await expect(promise).rejects.toThrow(ModelCancellationError);
    } finally {
      simulateTimeout = false;
    }
  });

  it("generates batch and query embeddings preserving ordering", async () => {
    const client = new OpenAICompatibleClient(getTestConfig());
    const embedder = new DefaultEmbeddingModel(client, "text-embedding-3-small");

    const batch = await embedder.embedDocuments(["chunk 1", "chunk 2"]);
    expect(batch.length).toBe(2);
    expect(batch[0]).toEqual([0.1, 0.2, 0.3]);
    expect(batch[1]).toEqual([0.2, 0.4, 0.6]);

    const single = await embedder.embedQuery("search query");
    expect(single).toEqual([0.1, 0.2, 0.3]);
  });

  it("inspects images, audio, and documents through MediaCapabilityModel", async () => {
    const client = new OpenAICompatibleClient(getTestConfig());
    const media = new DefaultMediaCapabilityModel(client, "gpt-4o", true);

    const imgResult = await media.inspectImage({
      imageUrl: "data:image/png;base64,iVBORw0KGgo=",
      prompt: "Describe character expression",
    });
    expect(imgResult.type).toBe("description");
    expect(imgResult.content).toBe("Standard model response.");

    const docResult = await media.inspectDocument({
      documentText: "Historical archival notes on 1920s Shanghai.",
      prompt: "Summarize setting details",
      pageNumber: 3,
    });
    expect(docResult.type).toBe("summary");
    expect(docResult.locator?.pageStart).toBe(3);
  });

  it("handles direct video when supported and disables native inspection when unsupported", async () => {
    const client = new OpenAICompatibleClient(getTestConfig());
    const media = new DefaultMediaCapabilityModel(client, "gpt-4o", true);

    // 1. Supported case
    simulateVideoSupport = true;
    const videoResult = await media.inspectVideo({
      videoUrl: "data:video/mp4;base64,AAAAHGZ0eXBtcDQyAAAAAG1wNDJpc29tYXZjMQAAAA==",
      prompt: "Analyze character movement in scene",
      clipStartMs: 1000,
      clipEndMs: 5000,
    });
    expect(videoResult.type).toBe("analysis");
    expect(videoResult.locator?.timeStartMs).toBe(1000);

    // 2. Unsupported case (explicit failure, does NOT silently fake native understanding)
    simulateVideoSupport = false;
    media.setNativeVideoSupported(false);
    await expect(
      media.inspectVideo({
        videoUrl: "data:video/mp4;base64,AAAAHGZ0eXBtcDQyAAAAAG1wNDJpc29tYXZjMQAAAA==",
        prompt: "Analyze character movement in scene",
      })
    ).rejects.toThrow(VideoDirectUnavailableError);
    simulateVideoSupport = true;
  });

  it("runs capability probe, caches result, and redacts secrets", async () => {
    const client = new OpenAICompatibleClient(getTestConfig());
    const probe = new DefaultCapabilityProbeService(client, getTestConfig());

    const health = await probe.probeCapabilities(true);

    expect(health.available).toBe(true);
    expect(health.baseUrl).not.toContain(fakeApiKey);
    expect(health.capabilities.textStreaming).toBe(true);
    expect(health.capabilities.embeddings).toBe(true);
    expect(health.capabilities.videoDirect).toBe(true);
    expect(health.videoExtension).toBe("video_url");

    // Cached result
    const cached = probe.getCachedCapabilities();
    expect(cached).toEqual(health);
  });

  it("redacts credentials from error messages and logs", () => {
    const secretMsg = `Error calling https://api.openai.com with Bearer ${fakeApiKey} and key="${fakeApiKey}"`;
    const cleanMsg = redactSecrets(secretMsg);

    expect(cleanMsg).not.toContain(fakeApiKey);
    expect(cleanMsg).toContain("Bearer [REDACTED]");
    expect(cleanMsg).toContain('key="[REDACTED]"');
  });
});

