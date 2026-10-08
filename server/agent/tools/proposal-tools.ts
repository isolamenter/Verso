import {
  changeSetService,
  changeSetRepository,
  manuscriptService,
  knowledgeRepository,
} from "../../domain";
import crypto from "node:crypto";
import { KnowledgeKindEnum } from "../../../shared/schemas/knowledge";
import type { ToolExecutionContext } from "./read-tools";
import {
  splitManuscriptTextByAnchors,
  computeSplitCoverage,
  findBestAnchorMatch,
} from "../../../shared/manuscript";
import type { ProposeSceneSplitsInput } from "../../../shared/schemas/tools";

export interface ProposeTextChangeInput {
  changeSetTitle?: string;
  changeSetObjective?: string;
  changeSetId?: string;
  dependencyGroup?: string;
  sceneId: string;
  baseRevisionId?: string;
  quote: string;
  prefixAnchor?: string;
  suffixAnchor?: string;
  replacementText: string;
  explanation?: string;
}

export interface ProposeKnowledgeCreateInput {
  changeSetTitle?: string;
  kind: string;
  title: string;
  content: string;
  explanation?: string;
}

export interface ProposeKnowledgeUpdateInput {
  changeSetTitle?: string;
  nodeId: string;
  content: string;
  explanation?: string;
}

export interface ProposeKnowledgeArchiveInput {
  changeSetTitle?: string;
  nodeId: string;
  explanation?: string;
}

export class ProposalToolsEngine {
  /**
   * 1. propose_text_change
   */
  public async proposeTextChange(
    input: ProposeTextChangeInput,
    ctx: ToolExecutionContext,
  ) {
    const snapshot = ctx.task?.scenes.find((s) => s.id === input.sceneId);
    if (
      ctx.task &&
      (!snapshot ||
        (ctx.task.scope !== "project" && input.sceneId !== ctx.task.sceneId))
    )
      throw new Error("修改对象不在本轮范围内");
    if (ctx.task?.scope === "selection") {
      const anchor = findBestAnchorMatch({
        plainText: snapshot!.text,
        quote: input.quote,
        prefixAnchor: input.prefixAnchor,
        suffixAnchor: input.suffixAnchor,
      });
      if (
        !anchor.found ||
        !anchor.range ||
        anchor.range.from < ctx.task.selection!.from ||
        anchor.range.to > ctx.task.selection!.to
      )
        throw new Error("提案超出作者选定段落");
    }
    const operation = {
      targetType: "scene" as const,
      targetId: input.sceneId,
      baseRevisionId: snapshot?.revisionId || input.baseRevisionId,
      operationType: "replace_text_range" as const,
      quote: input.quote,
      prefixAnchor: input.prefixAnchor,
      suffixAnchor: input.suffixAnchor,
      replacementContent: input.replacementText,
      literaryTradeoff: input.explanation,
      metadata: { dependencyGroup: input.dependencyGroup },
    };
    const existing = input.changeSetId
      ? await changeSetRepository.getChangeSetById(input.changeSetId)
      : undefined;
    if (existing) {
      if (
        existing.projectId !== ctx.projectId ||
        existing.runId !== ctx.runId ||
        !["proposed", "needs_rebase"].includes(existing.status)
      )
        throw new Error("不能向其他任务或已处理案卷追加修改");
      await changeSetRepository.createOperation({
        ...operation,
        projectId: ctx.projectId,
        changeSetId: existing.id,
      });
      await changeSetService.validateChangeSet(existing.id, ctx.projectId);
      return {
        success: true,
        changeSetId: existing.id,
        status: (await changeSetRepository.getChangeSetById(existing.id))!
          .status,
      };
    }
    if (input.changeSetId) throw new Error("案卷不存在");
    const result = await changeSetService.createChangeSetWithOperations(
      {
        projectId: ctx.projectId,
        threadId: ctx.threadId,
        runId: ctx.runId,
        title: input.changeSetTitle || "本轮修订",
        objective:
          ctx.task?.objective ||
          input.changeSetObjective ||
          "根据作者目标推敲正文",
        rationale: input.explanation,
      },
      [operation],
    );
    return {
      success: true,
      changeSetId: result.changeSet.id,
      status: result.changeSet.status,
      operationCount: result.operations.length,
    };
  }

  /**
   * 2. propose_knowledge_create
   */
  public async proposeKnowledgeCreate(
    input: ProposeKnowledgeCreateInput,
    ctx: ToolExecutionContext,
  ) {
    const kind = KnowledgeKindEnum.parse(input.kind);
    if (!input.title?.trim() || !input.content?.trim())
      throw new Error("设定标题和内容不能为空");
    if (
      ctx.task &&
      (!ctx.task.useKnowledge || ctx.task.participation !== "suggest")
    )
      throw new Error("本轮未允许提出设定修改");
    if (
      ctx.allowedKnowledgeKinds?.length &&
      !ctx.allowedKnowledgeKinds.includes(kind)
    )
      throw new Error("此技能不允许提出该类设定");
    const result = await changeSetService.createChangeSetWithOperations(
      {
        projectId: ctx.projectId,
        threadId: ctx.threadId,
        runId: ctx.runId,
        title: input.changeSetTitle || `新增设定: ${input.title}`,
        objective: "根据故事展开新增设定条目",
        rationale: input.explanation,
      },
      [
        {
          targetType: "knowledge_node",
          targetId: crypto.randomUUID(),
          operationType: "create_knowledge",
          replacementContent: input.content,
          structuredPayload: {
            kind,
            title: input.title,
            sceneId:
              ctx.task?.scope === "project" ? undefined : ctx.task?.sceneId,
          },
          literaryTradeoff: input.explanation,
        },
      ],
    );

    return {
      success: true,
      changeSetId: result.changeSet.id,
      status: result.changeSet.status,
    };
  }

  /**
   * 3. propose_knowledge_update
   */
  public async proposeKnowledgeUpdate(
    input: ProposeKnowledgeUpdateInput,
    ctx: ToolExecutionContext,
  ) {
    if (
      ctx.task &&
      (!ctx.task.useKnowledge || ctx.task.participation !== "suggest")
    )
      throw new Error("本轮未允许提出设定修改");
    const node = await knowledgeRepository.getNodeById(input.nodeId);
    if (!node || node.projectId !== ctx.projectId || node.status !== "active")
      throw new Error("设定不存在或尚未确认");
    if (
      ctx.task &&
      ((node.sceneId && !ctx.task.scenes.some((s) => s.id === node.sceneId)) ||
        (node.manuscriptId &&
          !ctx.task.scenes.some((s) => s.manuscriptId === node.manuscriptId)))
    )
      throw new Error("设定不在本轮范围内");
    if (
      ctx.allowedKnowledgeKinds?.length &&
      !ctx.allowedKnowledgeKinds.includes(node.kind)
    )
      throw new Error("此技能不允许修改该类设定");
    if (!input.content?.trim()) throw new Error("设定内容不能为空");
    const result = await changeSetService.createChangeSetWithOperations(
      {
        projectId: ctx.projectId,
        threadId: ctx.threadId,
        runId: ctx.runId,
        title: input.changeSetTitle || "更新设定条目",
        objective: "根据最新章节情节修正设定内容",
        rationale: input.explanation,
      },
      [
        {
          targetType: "knowledge_node",
          targetId: input.nodeId,
          operationType: "update_knowledge",
          replacementContent: input.content,
          quote: node.content,
          metadata: {
            baseKnowledgeContent: node.content,
            targetTitle: node.title,
          },
          literaryTradeoff: input.explanation,
        },
      ],
    );

    return {
      success: true,
      changeSetId: result.changeSet.id,
      status: result.changeSet.status,
    };
  }

  /**
   * 4. propose_knowledge_archive
   */
  public async proposeKnowledgeArchive(
    input: ProposeKnowledgeArchiveInput,
    ctx: ToolExecutionContext,
  ) {
    const result = await changeSetService.createChangeSetWithOperations(
      {
        projectId: ctx.projectId,
        threadId: ctx.threadId,
        runId: ctx.runId,
        title: input.changeSetTitle || "归档已废弃设定条目",
        objective: "归档不再适用的设定",
        rationale: input.explanation,
      },
      [
        {
          targetType: "knowledge_node",
          targetId: input.nodeId,
          operationType: "archive_knowledge",
          literaryTradeoff: input.explanation,
        },
      ],
    );

    return {
      success: true,
      changeSetId: result.changeSet.id,
      status: result.changeSet.status,
    };
  }

  /**
   * 5. propose_scene_splits
   */
  public async proposeSceneSplits(
    input: ProposeSceneSplitsInput,
    ctx: ToolExecutionContext,
  ) {
    const targetSceneId = input.sceneId;
    if (!targetSceneId) throw new Error("分章必须明确指定目标章节");
    if (
      ctx.task &&
      (ctx.task.scope === "selection" ||
        (ctx.task.scope !== "project" && targetSceneId !== ctx.task.sceneId) ||
        !ctx.task.scenes.some((s) => s.id === targetSceneId))
    )
      throw new Error("分章超出本轮修改范围");
    const scene = await manuscriptService.getSceneById(
      targetSceneId,
      ctx.projectId,
    );
    if (!scene) {
      throw new Error(`Target scene not found: ${targetSceneId}`);
    }

    const snapshot = ctx.task?.scenes.find((s) => s.id === targetSceneId);
    if (snapshot && scene.currentRevisionId !== snapshot.revisionId)
      throw new Error("正文已更新，请以新版本重新提出分章方案");
    const sourceText = scene.content;
    const splitResults = splitManuscriptTextByAnchors(sourceText, input.splits);
    const coverage = computeSplitCoverage(sourceText, splitResults);

    // Detect any splits that could not be matched by startQuote anchors
    const matchedTitles = new Set(splitResults.map((s) => s.title));
    const unmatchedSplits = input.splits
      .filter((s) => !matchedTitles.has(s.title))
      .map((s) => ({ title: s.title, startQuote: s.startQuote }));

    if (unmatchedSplits.length > 0) {
      console.warn(
        `[ProposalTools] ${unmatchedSplits.length} split(s) failed to match anchors in scene ${scene.id}:`,
        unmatchedSplits,
      );
    }

    const changeSetTitle =
      input.changeSetTitle || `分场规划方案：${splitResults.length} 场`;
    const changeSetObjective =
      input.changeSetObjective ||
      `将《${scene.title}》细化拆分为 ${splitResults.length} 个独立场景/章节`;

    const result = await changeSetService.createChangeSetWithOperations(
      {
        projectId: ctx.projectId,
        threadId: ctx.threadId,
        runId: ctx.runId,
        title: changeSetTitle,
        objective: changeSetObjective,
        rationale: input.rationale,
      },
      [
        {
          targetType: "scene",
          targetId: scene.id,
          baseRevisionId: scene.currentRevisionId || undefined,
          operationType: "split_scene",
          quote: splitResults[0]?.startQuote || "",
          replacementContent: JSON.stringify(splitResults),
          literaryTradeoff: input.rationale,
          structuredPayload: {
            coverage,
            sceneCount: splitResults.length,
            splits: splitResults,
            unmatchedSplits:
              unmatchedSplits.length > 0 ? unmatchedSplits : undefined,
            originalSceneTitle: scene.title,
            manuscriptId: scene.manuscriptId,
          },
        },
      ],
    );

    return {
      success: true,
      changeSetId: result.changeSet.id,
      status: result.changeSet.status,
      coverage,
      sceneCount: splitResults.length,
      unmatchedSplits: unmatchedSplits.length > 0 ? unmatchedSplits : undefined,
      splits: splitResults.map((s) => ({
        title: s.title,
        summary: s.summary,
        characterCount: s.characterCount,
        startQuote: s.startQuote,
        range: s.range,
        pov: s.pov,
        timeframe: s.timeframe,
      })),
    };
  }
}

export const proposalToolsEngine = new ProposalToolsEngine();
