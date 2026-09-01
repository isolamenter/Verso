import { agentRepository, projectRepository } from "../../domain";
import { reasoningModel } from "../../models";
import { runEventBus } from "./run-event-bus";
import { proposalToolsEngine } from "../tools/proposal-tools";
import {
  readToolsEngine,
  type ToolExecutionContext,
} from "../tools/read-tools";
import { skillRuntime } from "../../skills/skill-runtime";
import type {
  AgentRun,
  AgentRunEvent,
  AgentRunEventType,
} from "../../../shared/schemas/agent";
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
          changeSetTitle: {
            type: "string",
            description: "切分提案标题，如'前三章分场重组方案'",
          },
          changeSetObjective: {
            type: "string",
            description: "切分目的与核心依据",
          },
          sceneId: {
            type: "string",
            description: "需要切分的目标场景ID（可选，默认为当前主场景）",
          },
          splits: {
            type: "array",
            description: "分场规划清单（至少2场，全量覆盖全文）",
            items: {
              type: "object",
              properties: {
                title: {
                  type: "string",
                  description: "该场标题，如'第一场：破晓时分'",
                },
                summary: {
                  type: "string",
                  description: "该场一句话剧情事件与戏剧张力",
                },
                startQuote: {
                  type: "string",
                  description:
                    "该场在原文分界线处的起始句锚点（15~30字原文，必须与原文逐字完全一致）",
                },
                pov: { type: "string", description: "视点人物（可选）" },
                timeframe: { type: "string", description: "时间跨度（可选）" },
              },
              required: ["title", "startQuote"],
            },
          },
          rationale: {
            type: "string",
            description: "文学取舍与节奏分断考量说明",
          },
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
      description:
        "列出当前作品的所有场景(scene)、设定(knowledge)与记忆(memory)。",
      parameters: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["all", "scene", "knowledge", "memory"],
          },
          limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "read_resource",
      description:
        "读取指定资源（scene/knowledge/memory/manuscript）。type=manuscript 时读取全项目拼接正文（id 传任意 manuscriptId 或 projectId均可）；支持 offset/maxLength 分段读取。当 isTruncated=true 时必须继续用 offset 读取剩余部分。",
      parameters: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["scene", "knowledge", "memory", "manuscript"],
          },
          id: {
            type: "string",
            description: "资源ID；manuscript 类型可传 projectId 表示全项目",
          },
          offset: { type: "number", description: "起始字符偏移量，默认为0" },
          maxLength: {
            type: "number",
            description: "最大读取字符数，默认为100000",
          },
        },
        required: ["type", "id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "read_full_manuscript",
      description:
        "【首选】一次性读取当前作品全篇正文（服务端自动聚合所有场景并拼接）。无需事先 list_resources，不知道 sceneId 也能直接调用。支持 offset/maxLength 分页，isTruncated=true 时继续分页读取。",
      parameters: {
        type: "object",
        properties: {
          manuscriptId: {
            type: "string",
            description:
              "可选：指定 manuscriptId，只读该文稿；不传则读取全项目所有场景拼接",
          },
          offset: { type: "number", description: "起始字符偏移量，默认为0" },
          maxLength: {
            type: "number",
            description: "最大读取字符数，默认为100000",
          },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "search_manuscript",
      description:
        "在全篇正文中关键词搜索，返回含上下文的片段与偏移量，用于定位细节后再精读。",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "搜索关键词" },
          manuscriptId: {
            type: "string",
            description: "可选 manuscriptId 限定范围",
          },
          limit: { type: "number", description: "最大结果数，默认10" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "search_knowledge",
      description: "在知识库（人物/世界观/设定）中搜索。",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "搜索关键词" },
          category: { type: "string", description: "可选知识类型过滤" },
          limit: { type: "number", description: "最大结果数，默认10" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "read_knowledge_source",
      description: "读取知识节点详情及关联附件。",
      parameters: {
        type: "object",
        properties: { nodeId: { type: "string", description: "知识节点ID" } },
        required: ["nodeId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "inspect_media_segment",
      description: "查看媒体片段的转写与视觉描述。",
      parameters: {
        type: "object",
        properties: {
          segmentId: { type: "string", description: "媒体片段ID" },
        },
        required: ["segmentId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_revision",
      description: "获取场景的历史版本内容。",
      parameters: {
        type: "object",
        properties: {
          sceneId: { type: "string", description: "场景ID" },
          revisionNumber: { type: "number", description: "版本号" },
          revisionId: { type: "string", description: "版本ID" },
        },
        required: ["sceneId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "compare_revisions",
      description: "对比两个版本字数与差异。",
      parameters: {
        type: "object",
        properties: {
          sceneId: { type: "string", description: "场景ID" },
          baseRevisionNumber: { type: "number" },
          targetRevisionNumber: { type: "number" },
        },
        required: ["sceneId", "baseRevisionNumber", "targetRevisionNumber"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "query_memory",
      description: "查询记忆（口味/规则/画像）条目。",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          scope: {
            type: "string",
            enum: ["all", "taste", "rules", "profile"],
            description: "默认 all",
          },
          limit: { type: "number", description: "默认10" },
        },
      },
    },
  },
];

const DEFAULT_SYSTEM_PROMPT = `你是 Verso 严肃文学创作与审读工作台的专属文学助手。
你恪守纯文学编辑原则：创作者主体性（Author First）、非破坏性改稿（Change Sets）、诊断重于生成、减法法则。

【上下文自动获取 · 强制规则】
- 当用户要求涉及正文内容时（阅读全文/通读/分析全篇/分章/分场/梳理结构/审读/总结情节/人物梳理/扩写/改稿等），严禁要求用户粘贴原文，你必须主动调用工具获取上下文。
- 首选调用 read_full_manuscript 一次性获取全项目拼接正文（无需事先 list_resources）；若返回 isTruncated=true，必须立即用 offset 分段继续读取直到完整，严禁在未读完前盲猜或臆造情节、锚点、人物与章节。
- 需定位细节时可配合 search_manuscript / read_resource(scene) 精读；需要背景设定时用 search_knowledge / read_knowledge_source。
- 严禁回吐大段原文给用户；需要提交改动时必须通过 propose_text_change / propose_scene_splits 等 Change Set 工具。

【分章/分场额外要求】
1. 依据自然时空、情节转折与叙事节奏切分；
2. 调用 propose_scene_splits 出具方案，每场必须提供准确的原文开头 15~30 字作为 startQuote 切分锚点，且必须完整覆盖从头到尾的所有内容；
3. 完成后向创作者简要陈述分场的文学依据与节奏考量。`;

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
    payload: Record<string, unknown>,
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
    const {
      projectId,
      threadId,
      userPrompt,
      attachedQuote,
      skillId,
      modelRole,
      systemPrompt,
    } = options;

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
    this.executeRunLoop(
      run,
      threadId,
      projectId,
      userPrompt,
      attachedQuote,
      systemPrompt,
      abortController,
    ).catch(async (err) => {
      console.error(`[AgentRuntime] Run ${run.id} failed with error:`, err);
    });

    return { run };
  }

  private async executeRunLoop(
    run: AgentRun,
    threadId: string,
    projectId: string,
    userPrompt: string,
    attachedQuote?: string,
    systemPrompt?: string,
    abortController?: AbortController,
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
            // 基础上下文工具始终保留，确保自动获取全文能力不受 skill 过滤影响
            const BASE_CONTEXT_TOOLS = new Set([
              "read_full_manuscript",
              "read_resource",
              "list_resources",
              "search_manuscript",
            ]);
            const filtered = AGENT_TOOLS.filter(
              (t) =>
                assembled.supportedTools.includes(t.function.name) ||
                BASE_CONTEXT_TOOLS.has(t.function.name),
            );
            if (filtered.length > 0) {
              activeTools = filtered;
            }
          }
        } catch (err) {
          console.warn(
            `[AgentRuntime] Failed to assemble skill prompt for ${run.skillId}:`,
            err,
          );
        }
      }

      // 注入项目上下文摘要（场景清单），让模型无需 list 也能直接 read
      let contextSummary = "";
      try {
        const scenes = await projectRepository.listScenesByProject(projectId);
        if (scenes.length > 0) {
          const lines = scenes
            .slice(0, 20)
            .map(
              (s: any) =>
                `- [${s.id}] ${s.title || "未命名场景"} (${s.characterCount ?? 0}字)`,
            );
          const more =
            scenes.length > 20
              ? `\n…还有 ${scenes.length - 20} 个场景未列出`
              : "";
          contextSummary = `\n\n【当前作品上下文摘要 · 已自动注入，无需再要求用户粘贴】\n项目 ${projectId} 共有 ${scenes.length} 个场景：\n${lines.join("\n")}${more}\n你可直接调用 read_full_manuscript 获取全文，或用 read_resource(type=scene, id=场景ID) 精读单场。`;
        } else {
          contextSummary = `\n\n【当前作品上下文摘要】项目 ${projectId} 暂无场景内容。`;
        }
      } catch (e) {
        console.warn("[AgentRuntime] Failed to build context summary:", e);
      }

      messages.push({
        role: "system",
        content: (finalSystemPrompt || DEFAULT_SYSTEM_PROMPT) + contextSummary,
      });

      let contentToSend = userPrompt;
      if (attachedQuote) {
        contentToSend = `【参考引文】\n"${attachedQuote}"\n\n【创作要求】\n${userPrompt}`;
      }
      messages.push({ role: "user", content: contentToSend });

      let accumulatedText = "";
      let accumulatedThought = "";
      const maxTurns = 8;
      let turn = 0;

      while (turn < maxTurns) {
        turn++;
        let turnText = "";
        const turnToolCalls: Array<{
          id: string;
          name: string;
          arguments: string;
        }> = [];

        const stream = reasoningModel.stream(
          {
            messages,
            tools: activeTools,
          },
          {
            signal: abortController?.signal,
          },
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
              const res = await proposalToolsEngine.proposeSceneSplits(
                parsedArgs,
                toolCtx,
              );
              toolResult = res;
              await this.emitEvent(runId, threadId, projectId, "change_set", {
                changeSetId: res.changeSetId,
                status: res.status,
                operationType: "split_scene",
                sceneCount: res.sceneCount,
                coverage: res.coverage,
              });
            } else if (tc.name === "propose_text_change") {
              const res = await proposalToolsEngine.proposeTextChange(
                parsedArgs,
                toolCtx,
              );
              toolResult = res;
              await this.emitEvent(runId, threadId, projectId, "change_set", {
                changeSetId: res.changeSetId,
                status: res.status,
              });
            } else if (tc.name === "list_resources") {
              toolResult = await readToolsEngine.listResources(
                parsedArgs,
                toolCtx,
              );
            } else if (tc.name === "read_resource") {
              toolResult = await readToolsEngine.readResource(
                parsedArgs,
                toolCtx,
              );
            } else if (tc.name === "read_full_manuscript") {
              toolResult = await readToolsEngine.readFullManuscript(
                projectId,
                parsedArgs,
              );
              // 同步记录 receipt
              toolCtx.receiptBuilder?.recordItem({
                resourceType: "scene",
                resourceId: (toolResult as any).id || projectId,
                inclusionMode: (toolResult as any).isTruncated
                  ? "excerpt"
                  : "full",
                excerptLength: (toolResult as any).content?.length ?? 0,
                reason: "Read full manuscript via read_full_manuscript",
              });
            } else if (tc.name === "search_manuscript") {
              toolResult = await readToolsEngine.searchManuscript(
                parsedArgs,
                toolCtx,
              );
            } else if (tc.name === "search_knowledge") {
              toolResult = await readToolsEngine.searchKnowledge(
                parsedArgs,
                toolCtx,
              );
            } else if (tc.name === "read_knowledge_source") {
              toolResult = await readToolsEngine.readKnowledgeSource(
                parsedArgs,
                toolCtx,
              );
            } else if (tc.name === "inspect_media_segment") {
              toolResult = await readToolsEngine.inspectMediaSegment(
                parsedArgs,
                toolCtx,
              );
            } else if (tc.name === "get_revision") {
              toolResult = await readToolsEngine.getRevision(
                parsedArgs,
                toolCtx,
              );
            } else if (tc.name === "compare_revisions") {
              toolResult = await readToolsEngine.compareRevisions(
                parsedArgs,
                toolCtx,
              );
            } else if (tc.name === "query_memory") {
              toolResult = await readToolsEngine.queryMemory(
                parsedArgs,
                toolCtx,
              );
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
    if (
      run &&
      run.status !== "completed" &&
      run.status !== "cancelled" &&
      run.status !== "failed"
    ) {
      await agentRepository.updateRun(runId, {
        status: "cancelled",
        completedAt: new Date().toISOString(),
      });

      await this.emitEvent(
        runId,
        run.threadId,
        run.projectId,
        "status_change",
        {
          status: "cancelled",
        },
      );
      this.runSeqCounters.delete(runId);
      return true;
    }

    return false;
  }
}

export const agentRuntime = new AgentRuntime();
