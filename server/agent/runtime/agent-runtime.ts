import crypto from "node:crypto";
import { db } from "../../db/client";
import { changeSets } from "../../db/schema";
import { eq } from "drizzle-orm";
import { env } from "../../config/env";
import { resolveTask } from "../context/task-context";
import { ContextReceiptBuilder } from "../context/context-receipt-builder";
import type { TaskRequest, TaskSnapshot } from "../../../shared/schemas/task";
import {
  agentRepository,
  projectRepository,
  memoryService,
  changeSetRepository,
} from "../../domain";
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
      name: "propose_knowledge_create",
      description:
        "提出待作者确认的新设定，指出正文依据和不确定性；不会自动写入设定。",
      parameters: {
        type: "object",
        properties: {
          kind: { type: "string" },
          title: { type: "string" },
          content: { type: "string" },
          explanation: { type: "string" },
        },
        required: ["kind", "title", "content", "explanation"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "propose_knowledge_update",
      description: "提出待作者确认的设定修订，列出冲突来源；不会自动修改设定。",
      parameters: {
        type: "object",
        properties: {
          nodeId: { type: "string" },
          content: { type: "string" },
          explanation: { type: "string" },
        },
        required: ["nodeId", "content", "explanation"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "save_draft",
      description: "保存尚未选入正文的局部试写。不要把试写当成已成立的情节。",
      parameters: {
        type: "object",
        properties: { title: { type: "string" }, content: { type: "string" } },
        required: ["content"],
      },
    },
  },
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
            description: "需要切分的目标场景ID（必填，必须属于本轮目标）",
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
        required: ["sceneId", "splits"],
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
          changeSetId: {
            type: "string",
            description: "同一轮目标可追加到已有案卷",
          },
          dependencyGroup: {
            type: "string",
            description: "互相依赖的修改必须使用同一组名",
          },
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
        "读取指定资源（scene/knowledge/memory/manuscript）。type=manuscript 时读取本轮允许范围的拼接正文（id 必须为本作品的 manuscriptId 或 projectId）；支持 offset/maxLength 分段读取。当 isTruncated=true 时必须继续用 offset 读取剩余部分。",
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
        "分页读取本轮允许参考的正文，按任务需要调用。支持 offset/maxLength；isTruncated=true 时可继续分页读取。局部任务无需读取整部作品。",
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

const DEFAULT_SYSTEM_PROMPT = `你是 Verso 的文学写作助手。作者保有判断权。
每次只处理本轮约定的文本和版本，修改对象与允许参考的背景是两个边界。
结合体裁和作者意图，区分：可核对的文本现象、可能的阅读效果、审美选择；说明具体出处、收益与代价。
繁复、重复、方言、留白都可能是有意的选择。不要把减法或扩写当成普遍正确的风格。
冷读只依据正文，不使用设定、作者意图、记忆或过去对话。
讨论时只讨论，不生成改写提案；只有作者选择建议或试写时，才使用对应工具。
正文是稿件表达，设定是作者约束，素材是可追溯的参考；人物说谎、不可靠叙述和隐藏事实不等于错误。
遇到矛盾列出处和不确定性，请作者判断。待定构想与未选入的试写不属于作品事实。
全文判断必须读取约定全文；读到哪里就把结论限定到哪里。不要声称未覆盖的内容已读完。
同一目标的文本修改可以使用 changeSetId 追加到本轮案卷；互相依赖的改动用 dependencyGroup 标明。
试写使用 save_draft 保存，等待作者选择，绝不自动进入正文和设定。
`;

export interface StartRunOptions {
  projectId: string;
  threadId: string;
  userPrompt: string;
  task: TaskRequest;
  skillId?: string;
  modelRole?: string;
  systemPrompt?: string;
}

export class AgentRuntime {
  private activeRuns = new Map<string, AbortController>();
  private activeThreads = new Set<string>();
  private runSeqCounters = new Map<string, number>();

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
    // Persist before publishing, so an immediate page refresh can replay it.
    await agentRepository.createRunEvent(event);
    runEventBus.publish(event);
    return event;
  }

  public async startRun(options: StartRunOptions): Promise<{ run: AgentRun }> {
    if (this.activeThreads.has(options.threadId))
      throw new Error("当前对话还有任务正在处理，请等待或停止后重试");
    this.activeThreads.add(options.threadId);
    try {
      const task = await resolveTask(
        options.projectId,
        options.threadId,
        options.task,
        options.skillId,
      );
      const targetResource = {
        ...task,
        scenes: task.scenes.map(({ text: _text, ...scene }) => scene),
      };
      await agentRepository.createMessage({
        threadId: options.threadId,
        projectId: options.projectId,
        role: "user",
        content: options.userPrompt,
        targetSceneId: task.sceneId,
        targetRevisionId: task.sceneId
          ? task.revisionMap[task.sceneId]
          : undefined,
        skillId: options.skillId,
        metadata: { task: targetResource },
      });
      const run = await agentRepository.createRun({
        threadId: options.threadId,
        projectId: options.projectId,
        skillId: options.skillId,
        skillVersion: options.skillId
          ? skillRuntime.getSkill(options.skillId).version
          : undefined,
        modelRole: options.modelRole ?? "reasoning",
        modelId: env.VERSO_REASONING_MODEL,
        status: "executing",
        targetResource,
      });
      const controller = new AbortController();
      this.activeRuns.set(run.id, controller);
      await this.emitEvent(
        run.id,
        run.threadId,
        run.projectId,
        "status_change",
        { status: "planning" },
      );
      void this.execute(run, task, options, controller).catch((err) =>
        console.error("[AgentRuntime] Unable to persist task result:", err),
      );
      return { run };
    } catch (err) {
      this.activeThreads.delete(options.threadId);
      throw err;
    }
  }

  private async execute(
    run: AgentRun,
    task: TaskSnapshot,
    options: StartRunOptions,
    controller: AbortController,
  ) {
    const { id: runId, threadId, projectId } = run;
    const receipt = new ContextReceiptBuilder(runId, threadId, projectId);
    const skill = run.skillId
      ? skillRuntime.assemblePrompt(run.skillId)
      : undefined;
    const ctx: ToolExecutionContext = {
      projectId,
      threadId,
      runId,
      task,
      isColdReader: task.coldRead,
      receiptBuilder: receipt,
      allowedKnowledgeKinds: skill?.contextPolicy.allowedKnowledgeKinds,
    };
    let text = "",
      thought = "",
      stopReason: string | undefined,
      status: "completed" | "partial" | "cancelled" | "failed" = "completed";
    const messages: ModelMessage[] = [];
    const taskSummary = {
      ...task,
      scenes: task.scenes.map(({ text: _text, ...s }) => s),
    };
    const activeTools = AGENT_TOOLS.filter((t) => {
      const name = t.function.name;
      if (
        task.participation === "discuss" &&
        (name.startsWith("propose_") || name === "save_draft")
      )
        return false;
      if (name === "save_draft")
        return task.mode === "write" && task.participation === "draft";
      if (name.startsWith("propose_") && task.participation === "draft")
        return false;
      if (name.includes("knowledge") && !task.useKnowledge) return false;
      if (name === "query_memory" && !task.useMemory) return false;
      if (name === "inspect_media_segment" && !task.useMedia) return false;
      if (
        (task.coldRead || task.background === "none") &&
        (name === "get_revision" || name === "compare_revisions")
      )
        return false;
      const common = [
        "read_resource",
        "list_resources",
        "read_full_manuscript",
        "search_manuscript",
        "save_draft",
      ];
      return (
        !skill || common.includes(name) || skill.supportedTools.includes(name)
      );
    });
    try {
      await agentRepository.updateRun(runId, {
        status: "executing",
        startedAt: new Date().toISOString(),
      });
      await this.emitEvent(runId, threadId, projectId, "status_change", {
        status: "executing",
      });
      messages.push({
        role: "system",
        content:
          DEFAULT_SYSTEM_PROMPT +
          (options.systemPrompt || skill?.systemPrompt || "") +
          "\n本轮约定：" +
          JSON.stringify(taskSummary),
      });
      for (const scene of task.scenes)
        if (scene.summary)
          receipt.recordItem({
            resourceType: "scene",
            resourceId: scene.id,
            revisionId: scene.revisionId,
            inclusionMode: "summary",
            excerptLength: scene.summary.length,
            locator: { title: scene.title, stale: scene.structureStale },
          });
      if (task.useKnowledge) {
        const settings = await projectRepository.getProjectSettings(projectId);
        const intent = settings?.tonePreferences;
        if (intent && Object.keys(intent).length) {
          messages.push({
            role: "system",
            content: "作品创作意图（本轮目标优先）：" + JSON.stringify(intent),
          });
          receipt.recordItem({
            resourceType: "project_convention",
            resourceId: projectId,
            inclusionMode: "full",
            excerptLength: JSON.stringify(intent).length,
          });
        }
      }
      if (task.useMemory) {
        const memory = await memoryService.getScopedMemories({ projectId });
        const preferences = memory.tastes.map((t) => ({
          id: t.id,
          preference: t.preference,
          conditions: t.conditions,
          scope: t.scope,
        }));
        messages.push({
          role: "system",
          content:
            "作者已确认偏好（本轮要求优先）：" + JSON.stringify(preferences),
        });
        for (const taste of memory.tastes)
          receipt.recordItem({
            resourceType: "taste_entry",
            resourceId: taste.id,
            inclusionMode: "full",
            excerptLength: taste.preference.length,
            locator: { title: taste.preference },
          });
      }
      if (task.continueRunId && !task.coldRead) {
        const previous = await agentRepository.getRunById(task.continueRunId);
        const previousTask =
          previous?.targetResource as unknown as TaskSnapshot;
        if (
          !previousTask ||
          previousTask.useKnowledge !== task.useKnowledge ||
          previousTask.useMemory !== task.useMemory ||
          previousTask.useMedia !== task.useMedia ||
          Object.entries(previousTask.revisionMap).some(
            ([id, revision]) => task.revisionMap[id] !== revision,
          ) ||
          Object.keys(previousTask.revisionMap).length !==
            Object.keys(task.revisionMap).length ||
          previousTask.scope !== task.scope ||
          previousTask.sceneId !== task.sceneId ||
          previousTask.background !== task.background ||
          JSON.stringify(previousTask.selection) !==
            JSON.stringify(task.selection)
        )
          throw new Error("上一轮的版本或背景范围与本轮不同，请发起新任务");
        const previousMessages = (
          await agentRepository.listMessagesByThread(threadId)
        ).filter(
          (m) => m.runId === task.continueRunId && m.role === "assistant",
        );
        for (const m of previousMessages)
          messages.push({ role: "assistant", content: m.content });
      }
      // Local tasks already have a natural object. Inject that saved passage once;
      // project tasks use bounded reads so coverage can be reported honestly.
      if (task.scope !== "project") {
        const scene = task.scenes.find((s) => s.id === task.sceneId)!;
        const from =
          task.scope === "selection" ? task.selection!.from : scene.from;
        const to = Math.min(
          task.scope === "selection" ? task.selection!.to : scene.to,
          from + Math.min(12000, env.VERSO_CONTEXT_BUDGET),
        );
        messages.push({
          role: "user",
          content: `目标原文（${scene.title}，第 ${scene.revisionNumber} 稿）：\n${scene.text.slice(from, to)}`,
        });
        receipt.recordItem({
          resourceType: "scene",
          resourceId: scene.id,
          revisionId: scene.revisionId,
          inclusionMode:
            from === 0 && to === scene.text.length ? "full" : "excerpt",
          excerptLength: to - from,
          locator: { from, to },
        });
      }
      messages.push({ role: "user", content: options.userPrompt });
      let finished = false;
      for (let turn = 0; turn < 16; turn++) {
        if (controller.signal.aborted)
          throw new DOMException("Stopped", "AbortError");
        const estimated = messages.reduce(
          (n, m) => n + (typeof m.content === "string" ? m.content.length : 0),
          0,
        );
        if (
          estimated + env.VERSO_MAX_OUTPUT_TOKENS >
          env.VERSO_CONTEXT_BUDGET
        ) {
          stopReason = "已达到本轮上下文预算";
          status = "partial";
          break;
        }
        let turnText = "";
        const calls: Array<{ id: string; name: string; arguments: string }> =
          [];
        for await (const chunk of reasoningModel.stream(
          {
            messages,
            tools: activeTools,
            maxTokens: env.VERSO_MAX_OUTPUT_TOKENS,
          },
          { signal: controller.signal },
        )) {
          if (controller.signal.aborted)
            throw new DOMException("Stopped", "AbortError");
          if (chunk.type === "text_delta" && chunk.delta) {
            turnText += chunk.delta;
            text += chunk.delta;
            await this.emitEvent(runId, threadId, projectId, "text_delta", {
              delta: chunk.delta,
            });
          } else if (chunk.type === "thought_delta" && chunk.delta) {
            thought += chunk.delta;
            await this.emitEvent(runId, threadId, projectId, "thought_delta", {
              delta: chunk.delta,
            });
          } else if (chunk.type === "tool_call_complete" && chunk.toolCall)
            calls.push({
              id: chunk.toolCall.id,
              name: chunk.toolCall.function.name,
              arguments: chunk.toolCall.function.arguments,
            });
        }
        if (!calls.length) {
          finished = true;
          break;
        }
        messages.push({
          role: "assistant",
          content: turnText || null,
          tool_calls: calls.map((c) => ({
            id: c.id,
            type: "function",
            function: { name: c.name, arguments: c.arguments },
          })),
        });
        for (const call of calls) {
          if (controller.signal.aborted)
            throw new DOMException("Stopped", "AbortError");
          await this.emitEvent(runId, threadId, projectId, "tool_call", {
            id: call.id,
            name: call.name,
          });
          let result: Record<string, unknown>;
          try {
            if (!activeTools.some((t) => t.function.name === call.name))
              throw new Error("本轮未开放此能力");
            const args = JSON.parse(call.arguments || "{}");
            if (
              call.name === "read_resource" ||
              call.name === "read_full_manuscript"
            )
              args.maxLength = Math.min(
                Math.max(1, Number(args.maxLength) || 12000),
                12000,
                Math.max(
                  0,
                  env.VERSO_CONTEXT_BUDGET -
                    estimated -
                    env.VERSO_MAX_OUTPUT_TOKENS,
                ),
              );
            if (call.name === "propose_text_change")
              result = await proposalToolsEngine.proposeTextChange(args, ctx);
            else if (call.name === "propose_scene_splits")
              result = await proposalToolsEngine.proposeSceneSplits(args, ctx);
            else if (call.name === "propose_knowledge_create")
              result = await proposalToolsEngine.proposeKnowledgeCreate(
                args,
                ctx,
              );
            else if (call.name === "propose_knowledge_update")
              result = await proposalToolsEngine.proposeKnowledgeUpdate(
                args,
                ctx,
              );
            else if (call.name === "save_draft") {
              if (typeof args.content !== "string" || !args.content.trim())
                throw new Error("试写内容为空");
              const artifact = await agentRepository.createArtifact({
                runId,
                threadId,
                projectId,
                type: "scene_draft",
                title: args.title || "局部试写",
                content: args.content,
                metadata: {
                  targetSceneId: task.sceneId,
                  targetRevisionId: task.sceneId
                    ? task.revisionMap[task.sceneId]
                    : undefined,
                },
              });
              result = { artifactId: artifact.id, saved: true };
              await this.emitEvent(runId, threadId, projectId, "artifact", {
                artifactId: artifact.id,
                type: "scene_draft",
              });
            } else if (call.name === "read_full_manuscript")
              result = await readToolsEngine.readFullManuscript(
                projectId,
                args,
                ctx,
              );
            else {
              const method = (
                {
                  list_resources: "listResources",
                  read_resource: "readResource",
                  search_manuscript: "searchManuscript",
                  search_knowledge: "searchKnowledge",
                  read_knowledge_source: "readKnowledgeSource",
                  inspect_media_segment: "inspectMediaSegment",
                  get_revision: "getRevision",
                  compare_revisions: "compareRevisions",
                  query_memory: "queryMemory",
                } as const
              )[call.name as "read_resource"];
              if (!method) throw new Error("未知工具");
              result = await readToolsEngine[method](args, ctx);
            }
            if (result.changeSetId)
              await this.emitEvent(runId, threadId, projectId, "change_set", {
                ...result,
                operationType:
                  call.name === "propose_scene_splits"
                    ? "split_scene"
                    : call.name === "propose_knowledge_create"
                      ? "create_knowledge"
                      : call.name === "propose_knowledge_update"
                        ? "update_knowledge"
                        : "replace_text_range",
              });
          } catch (err) {
            result = {
              error: err instanceof Error ? err.message : "工具执行失败",
            };
          }
          await this.emitEvent(runId, threadId, projectId, "tool_result", {
            id: call.id,
            name: call.name,
            result,
          });
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify(result),
          });
        }
      }
      if (!finished && !stopReason) {
        status = "partial";
        stopReason = "本轮处理步数已用完";
      }
      const targets = task.scenes
        .filter((s) => task.scope === "project" || s.id === task.sceneId)
        .map((s) =>
          task.scope === "selection"
            ? { ...s, from: task.selection!.from, to: task.selection!.to }
            : s,
        );
      if (!receipt.coverage({ ...task, scenes: targets }).complete) {
        status = "partial";
        stopReason ||= "尚未覆盖全部目标正文，结论仅适用于已读取部分";
      }
    } catch (err) {
      status = controller.signal.aborted ? "cancelled" : "failed";
      stopReason =
        status === "cancelled"
          ? "作者停止了本轮任务"
          : err instanceof Error
            ? err.message
            : "本轮任务失败";
    }
    try {
      const coverage = receipt.coverage(task, stopReason);
      const saved = await receipt.finalize({
        coverage,
        task: { mode: task.mode, scope: task.scope, objective: task.objective },
        modelEndpoint: task.modelEndpoint,
      });
      await this.emitEvent(runId, threadId, projectId, "receipt", {
        receiptId: saved.receipt.id,
        coverage,
      });
      await agentRepository.createMessage({
        threadId,
        projectId,
        runId,
        role: "assistant",
        content: text || stopReason || "本轮完成，请查看结果。",
        targetSceneId: task.sceneId,
        targetRevisionId: task.sceneId
          ? task.revisionMap[task.sceneId]
          : undefined,
        metadata: {
          task: taskSummary,
          coverage,
          status,
          thought: thought || undefined,
        },
      });
      const changes = (
        await changeSetRepository.listChangeSetsByProject(projectId)
      ).filter((c) => c.runId === runId);
      for (const change of changes)
        await db
          .update(changeSets)
          .set({ contextReceiptId: saved.receipt.id })
          .where(eq(changeSets.id, change.id));
      await agentRepository.updateRun(runId, {
        status,
        error: status === "failed" ? stopReason : undefined,
        completedAt: new Date().toISOString(),
        metadata: { coverage },
      });
      await this.emitEvent(runId, threadId, projectId, "status_change", {
        status,
        error: status === "failed" ? stopReason : undefined,
        coverage,
      });
    } finally {
      this.activeRuns.delete(runId);
      this.activeThreads.delete(threadId);
      this.runSeqCounters.delete(runId);
    }
  }

  public async cancelRun(runId: string): Promise<boolean> {
    const controller = this.activeRuns.get(runId);
    if (controller) {
      controller.abort();
      return true;
    }
    const run = await agentRepository.getRunById(runId);
    if (
      !run ||
      ["completed", "partial", "failed", "cancelled"].includes(run.status)
    )
      return false;
    await agentRepository.updateRun(runId, {
      status: "cancelled",
      completedAt: new Date().toISOString(),
      metadata: {
        ...run.metadata,
        interruption: "运行进程已结束，本轮未完整完成",
      },
    });
    await this.emitEvent(runId, run.threadId, run.projectId, "status_change", {
      status: "cancelled",
    });
    return true;
  }
}

export const agentRuntime = new AgentRuntime();
