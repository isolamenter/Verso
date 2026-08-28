import { agentRepository } from "../../domain";
import { reasoningModel } from "../../models";
import { runEventBus } from "./run-event-bus";
import { proposalToolsEngine } from "../tools/proposal-tools";
import { readToolsEngine, type ToolExecutionContext } from "../tools/read-tools";
import { skillRuntime } from "../../skills/skill-runtime";
import type { AgentRun, AgentRunEvent, AgentRunEventType } from "../../../shared/schemas/agent";
import type { ModelMessage } from "../../../shared/schemas/model-capabilities";

export const AGENT_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "propose_scene_splits",
      description:
        "向作者出具长篇文稿或超长场景的智能分场/分章切分方案案卷（Change Set）。必须全量覆盖文稿从头到尾的所有内容，严禁回吐大段全文，必须通过每场的起始句锚点（startQuote，15~30字原文）进行高保真无损切片。",
      parameters: {
        type: "object",
        properties: {
          changeSetTitle: { type: "string", description: "切分提案标题，如'前三章分场重组方案'" },
          changeSetObjective: { type: "string", description: "切分目的与核心依据" },
          sceneId: { type: "string", description: "需要切分的目标场景ID（可选，默认为当前主场景）" },
          splits: {
            type: "array",
            description: "分场规划清单（至少2场，全量覆盖全文）",
            items: {
              type: "object",
              properties: {
                title: { type: "string", description: "该场标题，如'第一场：破晓时分'" },
                summary: { type: "string", description: "该场一句话剧情事件与戏剧张力" },
                startQuote: {
                  type: "string",
                  description: "该场在原文分界线处的起始句锚点（15~30字原文，必须与原文逐字完全一致）",
                },
                pov: { type: "string", description: "视点人物（可选）" },
                timeframe: { type: "string", description: "时间跨度（可选）" },
              },
              required: ["title", "startQuote"],
            },
          },
          rationale: { type: "string", description: "文学取舍与节奏分断考量说明" },
        },
        required: ["splits"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "propose_text_change",
      description: "向作者出具带定位锚点的正文字句修订单（Change Set）。",
      parameters: {
        type: "object",
        properties: {
          sceneId: { type: "string", description: "目标场景ID" },
          quote: { type: "string", description: "待替换的原文字句" },
          prefixAnchor: { type: "string", description: "前置定位锚点" },
          suffixAnchor: { type: "string", description: "后置定位锚点" },
          replacementText: { type: "string", description: "修改后的替换文本" },
          explanation: { type: "string", description: "文学机理与改动考量" },
        },
        required: ["sceneId", "quote", "replacementText"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_resources",
      description: "列出当前作品的所有场景(scene)、设定(knowledge)与记忆(memory)。",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["all", "scene", "knowledge", "memory"] },
          limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "read_resource",
      description: "读取指定资源（如某个场景scene的正文全文）。支持通过 offset 和 maxLength 进行分段读取或完整读取全篇。",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["scene", "knowledge", "memory", "manuscript"] },
          id: { type: "string", description: "资源ID" },
          offset: { type: "number", description: "起始字符偏移量，默认为0" },
          maxLength: { type: "number", description: "最大读取字符数，默认为100000（足以容纳全篇长篇小说）" },
        },
        required: ["type", "id"],
      },
    },
  },
];

const DEFAULT_SYSTEM_PROMPT = `你是 Verso 严肃文学创作与审读工作台的专属文学助手。
你恪守纯文学编辑原则：创作者主体性（Author First）、非破坏性改稿（Change Sets）、诊断重于生成、减法法则。
当作者要求你分章、分场或梳理全篇结构时：
1. 若尚未读取全文，必须先调用 read_resource 获知正文；若正文超长且返回 isTruncated 为 true，必须使用 offset 分段读取完整，严禁在未读取到全篇真实内容前盲猜或臆造章节与锚点；
2. 依据自然时空、情节转折与叙事节奏切分；
3. 调用 propose_scene_splits 出具分场方案。注意：严禁回吐大段正文，每场必须提供准确的原文开头 15~30 字作为 startQuote 切分锚点，且必须完整覆盖从头到尾的所有内容；
4. 切分完成后向创作者简要陈述分场的文学依据与节奏考量。`;

export interface StartRunOptions {
  projectId: string;
  threadId: string;
  userPrompt: string;
  attachedQuote?: string;
  skillId?: string;
  modelRole?: string;
  systemPrompt?: string;
}

export class AgentRuntime {
  private activeRuns: Map<string, AbortController> = new Map();
  private runSeqCounters: Map<string, number> = new Map();

  /**
   * Broadcasts an event via the event bus immediately and persists it with monotonic sequence number.
   */
  public async emitEvent(
    runId: string,
    threadId: string,
    projectId: string,
    type: AgentRunEventType,
    payload: Record<string, unknown>
  ): Promise<AgentRunEvent> {
    const seq = (this.runSeqCounters.get(runId) ?? 0) + 1;
    this.runSeqCounters.set(runId, seq);

    const event: AgentRunEvent = {
      id: crypto.randomUUID(),
      runId,
      threadId,
      projectId,
      sequenceNumber: seq,
      type,
      payload,
      createdAt: new Date().toISOString(),
    };

    // Broadcast immediately so client SSE gets real-time zero-delay streaming
    runEventBus.publish(event);

    // Persist with known sequenceNumber (avoids SELECT MAX on every chunk)
    await agentRepository.createRunEvent({
      id: event.id,
      runId,
      threadId,
      projectId,
      sequenceNumber: seq,
      type,
      payload,
    });

    return event;
  }

  /**
   * Starts an asynchronous agent run for a thread with streaming SSE events.
   */
  public async startRun(options: StartRunOptions): Promise<{ run: AgentRun }> {
    const { projectId, threadId, userPrompt, attachedQuote, skillId, modelRole, systemPrompt } = options;

    // 1. Create User Message in Thread
    await agentRepository.createMessage({
      threadId,
      projectId,
      role: "user",
      content: userPrompt,
      metadata: attachedQuote ? { attachedQuote } : {},
    });

    // 2. Create Agent Run
    const run = await agentRepository.createRun({
      threadId,
      projectId,
      skillId,
      modelRole: modelRole ?? "reasoning",
      status: "queued",
    });

    // 3. Emit run_started status event
    await this.emitEvent(run.id, threadId, projectId, "status_change", {
      status: "planning",
    });

    const abortController = new AbortController();
    this.activeRuns.set(run.id, abortController);

    // Execute run in background
    this.executeRunLoop(run, threadId, projectId, userPrompt, attachedQuote, systemPrompt, abortController).catch(
      async (err) => {
        console.error(`[AgentRuntime] Run ${run.id} failed with error:`, err);
      }
    );

    return { run };
  }

  private async executeRunLoop(
    run: AgentRun,
    threadId: string,
    projectId: string,
    userPrompt: string,
    attachedQuote?: string,
    systemPrompt?: string,
    abortController?: AbortController
  ): Promise<void> {
    const runId = run.id;

    try {
      await agentRepository.updateRun(runId, {
        status: "executing",
        startedAt: new Date().toISOString(),
      });

      await this.emitEvent(runId, threadId, projectId, "status_change", {
        status: "executing",
      });

      // Prepare conversation messages
      const messages: ModelMessage[] = [];
      let finalSystemPrompt = systemPrompt;
      let activeTools = AGENT_TOOLS;

      if (!finalSystemPrompt && run.skillId) {
        try {
          const assembled = skillRuntime.assemblePrompt(run.skillId);
          finalSystemPrompt = assembled.systemPrompt;
          if (assembled.supportedTools && assembled.supportedTools.length > 0) {
            const filtered = AGENT_TOOLS.filter((t) =>
              assembled.supportedTools.includes(t.function.name)
            );
            if (filtered.length > 0) {
              activeTools = filtered;
            }
          }
        } catch (err) {
          console.warn(`[AgentRuntime] Failed to assemble skill prompt for ${run.skillId}:`, err);
        }
      }

      messages.push({ role: "system", content: finalSystemPrompt || DEFAULT_SYSTEM_PROMPT });

      let contentToSend = userPrompt;
      if (attachedQuote) {
        contentToSend = `【参考引文】\n"${attachedQuote}"\n\n【创作要求】\n${userPrompt}`;
      }
      messages.push({ role: "user", content: contentToSend });

      let accumulatedText = "";
      let accumulatedThought = "";
      const maxTurns = 3;
      let turn = 0;

      while (turn < maxTurns) {
        turn++;
        let turnText = "";
        const turnToolCalls: Array<{ id: string; name: string; arguments: string }> = [];

        const stream = reasoningModel.stream(
          {
            messages,
            tools: activeTools,
          },
          {
            signal: abortController?.signal,
          }
        );

        for await (const chunk of stream) {
          if (abortController?.signal.aborted) {
            throw new DOMException("The user aborted a request.", "AbortError");
          }

          if (chunk.type === "thought_delta" && chunk.delta) {
            accumulatedThought += chunk.delta;
            await this.emitEvent(runId, threadId, projectId, "thought_delta", {
              delta: chunk.delta,
            });
          } else if (chunk.type === "text_delta" && chunk.delta) {
            turnText += chunk.delta;
            accumulatedText += chunk.delta;
            await this.emitEvent(runId, threadId, projectId, "text_delta", {
              delta: chunk.delta,
            });
          } else if (chunk.type === "tool_call_complete" && chunk.toolCall) {
            turnToolCalls.push({
              id: chunk.toolCall.id,
              name: chunk.toolCall.function.name,
              arguments: chunk.toolCall.function.arguments,
            });
          }
        }

        if (turnToolCalls.length === 0) {
          break;
        }

        // Add assistant message with tool calls
        messages.push({
          role: "assistant",
          content: turnText || null,
          tool_calls: turnToolCalls.map((tc) => ({
            id: tc.id,
            type: "function",
            function: {
              name: tc.name,
              arguments: tc.arguments,
            },
          })),
        });

        // Execute each tool call
        const toolCtx: ToolExecutionContext = {
          projectId,
          runId,
          threadId,
        };

        for (const tc of turnToolCalls) {
          await this.emitEvent(runId, threadId, projectId, "tool_call", {
            id: tc.id,
            name: tc.name,
            arguments: tc.arguments,
          });

          let toolResult: Record<string, unknown> = {};
          try {
            const parsedArgs = JSON.parse(tc.arguments || "{}");
            if (tc.name === "propose_scene_splits") {
              const res = await proposalToolsEngine.proposeSceneSplits(parsedArgs, toolCtx);
              toolResult = res;
              await this.emitEvent(runId, threadId, projectId, "change_set", {
                changeSetId: res.changeSetId,
                status: res.status,
                operationType: "split_scene",
                sceneCount: res.sceneCount,
                coverage: res.coverage,
              });
            } else if (tc.name === "propose_text_change") {
              const res = await proposalToolsEngine.proposeTextChange(parsedArgs, toolCtx);
              toolResult = res;
              await this.emitEvent(runId, threadId, projectId, "change_set", {
                changeSetId: res.changeSetId,
                status: res.status,
              });
            } else if (tc.name === "list_resources") {
              toolResult = await readToolsEngine.listResources(parsedArgs, toolCtx);
            } else if (tc.name === "read_resource") {
              toolResult = await readToolsEngine.readResource(parsedArgs, toolCtx);
            } else {
              toolResult = { error: `Unknown tool: ${tc.name}` };
            }
          } catch (err: any) {
            toolResult = { error: err.message };
          }

          await this.emitEvent(runId, threadId, projectId, "tool_result", {
            id: tc.id,
            name: tc.name,
            result: toolResult,
          });

          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify(toolResult),
          });
        }
      }

      // Persist assistant message
      await agentRepository.createMessage({
        threadId,
        projectId,
        role: "assistant",
        content: accumulatedText || "审读完成，已出具相关改稿与分场方案。",
        metadata: {
          runId,
          thought: accumulatedThought || undefined,
        },
      });

      // Mark run completed
      await agentRepository.updateRun(runId, {
        status: "completed",
        completedAt: new Date().toISOString(),
      });

      await this.emitEvent(runId, threadId, projectId, "status_change", {
        status: "completed",
      });
    } catch (err: any) {
      if (err.name === "AbortError" || abortController?.signal.aborted) {
        await agentRepository.updateRun(runId, {
          status: "cancelled",
          completedAt: new Date().toISOString(),
        });

        await this.emitEvent(runId, threadId, projectId, "status_change", {
          status: "cancelled",
        });
      } else {
        await agentRepository.updateRun(runId, {
          status: "failed",
          error: err.message,
          completedAt: new Date().toISOString(),
        });

        await this.emitEvent(runId, threadId, projectId, "status_change", {
          status: "failed",
          error: err.message,
        });

        await this.emitEvent(runId, threadId, projectId, "error", {
          error: err.message,
        });

        await agentRepository.createMessage({
          threadId,
          projectId,
          role: "assistant",
          content: `【模型调用失败】${err.message}`,
          metadata: {
            runId,
            status: "failed",
            isError: true,
            error: err.message,
          },
        });
      }
    } finally {
      this.activeRuns.delete(runId);
      this.runSeqCounters.delete(runId);
    }
  }

  /**
   * Idempotent cooperative cancellation of an active run.
   */
  public async cancelRun(runId: string): Promise<boolean> {
    const controller = this.activeRuns.get(runId);
    if (controller) {
      controller.abort();
      return true;
    }

    const run = await agentRepository.getRunById(runId);
    if (run && run.status !== "completed" && run.status !== "cancelled" && run.status !== "failed") {
      await agentRepository.updateRun(runId, {
        status: "cancelled",
        completedAt: new Date().toISOString(),
      });

      await this.emitEvent(runId, run.threadId, run.projectId, "status_change", {
        status: "cancelled",
      });
      this.runSeqCounters.delete(runId);
      return true;
    }

    return false;
  }
}

export const agentRuntime = new AgentRuntime();
